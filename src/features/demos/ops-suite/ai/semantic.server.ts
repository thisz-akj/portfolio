import { sql, type SQL } from "drizzle-orm";
import { getDb } from "../db/client";
import { listEntity } from "../data/list";
import { getEntityServer } from "../entities/server";
import { addDaysISO, presetRange, todayIST, type DateRange } from "../filters/dates";
import { parseFilter, parseSort, serializeFilter, serializeListQuery } from "../filters/parse";
import { defaultQuery, type DatePreset } from "../filters/types";
import { PORTAL_BASE } from "../nav";
import { dimensionOf, metricOf, type Fact, type Period } from "./semantic";
import { periodLabel, type Plan } from "./plan";
import type { AnswerRow, ListAnswer, MetricAnswer } from "./types";

/**
 * Executes a validated plan. SQL is assembled ONLY from the constant fragments below (keyed by metric/dimension
 * names that validatePlan already checked); every user/model value is a bound parameter. Each query runs in a
 * read-only transaction with a statement timeout. Server-only.
 */

const FACTS: Record<Fact, { from: string; date: string | null; base: string }> = {
  orders: {
    from: "sales_orders so join companies c on c.id = so.company_id left join users u on u.id = so.owner_id join warehouses w on w.id = so.warehouse_id",
    date: "so.order_date",
    base: "so.status <> 'cancelled'",
  },
  order_lines: {
    from: "sales_order_lines l join sales_orders so on so.id = l.sales_order_id join products p on p.id = l.product_id join companies c on c.id = so.company_id join warehouses w on w.id = so.warehouse_id",
    date: "so.order_date",
    base: "so.status <> 'cancelled'",
  },
  invoices: { from: "invoices i join companies c on c.id = i.company_id left join users u on u.id = c.owner_id", date: "i.issue_date", base: "i.status <> 'void'" },
  deals: { from: "deals d join companies c on c.id = d.company_id left join users u on u.id = d.owner_id", date: "(d.closed_at at time zone 'Asia/Kolkata')::date", base: "true" },
  leads: { from: "leads le left join users u on u.id = le.owner_id", date: "(le.created_at at time zone 'Asia/Kolkata')::date", base: "true" },
  payments: { from: "payments pm join invoices i on i.id = pm.invoice_id join companies c on c.id = i.company_id", date: "(pm.paid_at at time zone 'Asia/Kolkata')::date", base: "true" },
  stock: { from: "inventory inv join products p on p.id = inv.product_id join warehouses w on w.id = inv.warehouse_id", date: null, base: "p.active" },
};

const TODAY = "(now() at time zone 'Asia/Kolkata')::date";
const OPEN = "('new','qualified','proposal','negotiation')";

const METRIC_SQL: Record<string, { agg: string; where?: string }> = {
  orders_value: { agg: "sum(so.total)" },
  orders_count: { agg: "count(*)" },
  units_sold: { agg: "sum(l.qty)" },
  sales_ex_gst: { agg: "sum(l.line_total)" },
  invoiced_value: { agg: "sum(i.total)" },
  outstanding: { agg: "sum(i.total - i.amount_paid)", where: "i.status in ('sent','partially_paid')" },
  overdue: { agg: "sum(i.total - i.amount_paid)", where: `i.status in ('sent','partially_paid') and i.due_date < ${TODAY}` },
  payments_received: { agg: "sum(pm.amount)" },
  pipeline_value: { agg: "sum(d.value)", where: `d.stage in ${OPEN}` },
  deals_won_value: { agg: "sum(d.value)", where: "d.stage = 'won'" },
  deals_won_count: { agg: "count(*)", where: "d.stage = 'won'" },
  deals_lost_count: { agg: "count(*)", where: "d.stage = 'lost'" },
  win_rate: { agg: "count(*) filter (where d.stage = 'won')::numeric / nullif(count(*), 0)", where: "d.stage in ('won','lost')" },
  new_leads: { agg: "count(*)" },
  stock_value: { agg: "sum(inv.qty_on_hand * p.cost)" },
  low_stock_items: { agg: "count(*)", where: "inv.qty_on_hand - inv.qty_reserved < inv.reorder_level" },
};

const AGING = `(case when i.due_date >= ${TODAY} then 'not_due' when ${TODAY} - i.due_date <= 30 then '1_30' when ${TODAY} - i.due_date <= 60 then '31_60' when ${TODAY} - i.due_date <= 90 then '61_90' else '90_plus' end)`;

/** dimension → SQL per fact (text-valued) */
function dimSql(dim: string, fact: Fact): string {
  const f = FACTS[fact];
  switch (dim) {
    case "month":
      return `to_char(${f.date}, 'YYYY-MM')`;
    case "region":
      return "c.region::text";
    case "state":
      return fact === "leads" ? "le.state" : "c.state";
    case "industry":
      return "c.industry::text";
    case "size":
      return "c.size::text";
    case "lifecycle":
      return "c.lifecycle::text";
    case "company":
      return "c.name";
    case "owner":
      return "coalesce(u.name, 'Unassigned')";
    case "warehouse":
      return "w.code";
    case "category":
      return "p.category::text";
    case "product":
      return "(p.sku || ' · ' || p.name)";
    case "order_status":
      return "so.status::text";
    case "invoice_status":
      return "i.status::text";
    case "stage":
      return "d.stage::text";
    case "source":
      return fact === "leads" ? "le.source::text" : "coalesce(d.source::text, 'unknown')";
    case "lead_status":
      return "le.status::text";
    case "method":
      return "pm.method::text";
    case "aging":
      return AGING;
  }
  throw new Error(`no SQL for dimension ${dim}`);
}

function filterSql(dim: string, fact: Fact, values: string[]): SQL {
  const d = dimensionOf(dim)!;
  if (dim === "product") {
    const lower = values.map((x) => x.toLowerCase());
    return sql`(lower(p.sku) in ${lower} or lower(p.name) in ${lower})`;
  }
  if (dim === "owner" && values.some((x) => x.toLowerCase() === "unassigned")) return sql`(u.name is null or lower(u.name) in ${values.map((x) => x.toLowerCase())})`;
  if (d.values) return sql`${sql.raw(dimSql(dim, fact))} in ${values}`;
  return sql`lower(${sql.raw(dimSql(dim, fact))}) in ${values.map((x) => x.toLowerCase())}`;
}

// ── periods ─────────────────────────────────────────────────────────────────
const addMonths = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10);
};
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function periodRange(p: Period, now = new Date()): DateRange {
  if (p === "all_time") return {};
  if (p === "last_12_months") {
    const today = todayIST(now);
    return { from: addMonths(`${today.slice(0, 7)}-01`, -11), to: addDaysISO(today, 1) };
  }
  return presetRange(p as DatePreset, now);
}

/** The comparable previous window. Periods still in progress compare the same number of days into the previous one. */
export function previousRange(p: Period, now = new Date()): { range: DateRange; label: string } | null {
  const r = periodRange(p, now);
  if (!r.from || !r.to) return null;
  const today = todayIST(now);
  const months = p === "this_month" || p === "last_month" ? 1 : p === "this_quarter" || p === "last_quarter" ? 3 : p === "this_fy" || p === "last_fy" || p === "last_12_months" ? 12 : 0;
  if (months) {
    const from = addMonths(r.from, -months);
    const inProgress = r.to > today;
    const to = inProgress ? addDaysISO(from, days(r.from, addDaysISO(today, 1))) : r.from;
    return { range: { from, to }, label: inProgress ? `same ${days(r.from, addDaysISO(today, 1))} days of the previous period` : "the previous period" };
  }
  const len = days(r.from, r.to);
  return { range: { from: addDaysISO(r.from, -len), to: r.from }, label: `the previous ${len} days` };
}

// ── execution ───────────────────────────────────────────────────────────────
async function readOnly<T>(fn: (tx: Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0]) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction read only`);
    await tx.execute(sql.raw("set local statement_timeout = 5000"));
    return fn(tx);
  });
}

const rowsOf = (res: unknown): Record<string, unknown>[] => (Array.isArray(res) ? res : ((res as { rows?: Record<string, unknown>[] }).rows ?? []));

export async function executeMetric(plan: Plan, now = new Date()): Promise<MetricAnswer> {
  const m = plan.metric!;
  const def = metricOf(m.metric)!;
  const fact = FACTS[def.fact];
  const ms = METRIC_SQL[m.metric];
  const group = m.groupBy ? dimSql(m.groupBy, def.fact) : null;
  const where = (range: DateRange) => {
    const parts: SQL[] = [sql.raw(fact.base)];
    if (ms.where) parts.push(sql.raw(ms.where));
    if (fact.date && def.timed) {
      if (range.from) parts.push(sql`${sql.raw(fact.date)} >= ${range.from}::date`);
      if (range.to) parts.push(sql`${sql.raw(fact.date)} < ${range.to}::date`);
    }
    for (const f of m.filters) parts.push(filterSql(f.dimension, def.fact, f.values));
    return sql.join(parts, sql` and `);
  };
  const timeSeries = m.groupBy === "month";
  // "which X dropped/grew most" → rank groups by change, not by current value (limit applied after ranking)
  const rankByChange = m.compare === "previous_period" && !!m.groupBy && !timeSeries;
  const query = (range: DateRange) =>
    group
      ? sql`select ${sql.raw(group)} as label, ${sql.raw(ms.agg)} as value from ${sql.raw(fact.from)} where ${where(range)} group by 1 order by ${timeSeries ? sql.raw("1 asc") : sql.raw(`2 ${m.sort} nulls last, 1`)} limit ${timeSeries ? 36 : rankByChange ? 500 : m.limit}`
      : sql`select 'Total' as label, ${sql.raw(ms.agg)} as value from ${sql.raw(fact.from)} where ${where(range)}`;

  const current = periodRange(m.period as Period, now);
  const prev = m.compare === "previous_period" ? previousRange(m.period as Period, now) : null;
  const [cur, before, totals] = await readOnly(async (tx) => [
    rowsOf(await tx.execute(query(current))),
    prev ? rowsOf(await tx.execute(group ? sql`select ${sql.raw(group)} as label, ${sql.raw(ms.agg)} as value from ${sql.raw(fact.from)} where ${where(prev.range)} group by 1` : query(prev.range))) : [],
    group && def.unit !== "pct" ? rowsOf(await tx.execute(sql`select ${sql.raw(ms.agg)} as value from ${sql.raw(fact.from)} where ${where(current)}`)) : [],
  ]);

  const dim = m.groupBy ? dimensionOf(m.groupBy) : undefined;
  const labelOf = (raw: string) => dim?.values?.find((o) => o.value === raw)?.label ?? raw;
  const prevBy = new Map(before.map((r) => [String(r.label), r.value === null ? null : Number(r.value)]));
  const rows: AnswerRow[] = cur.map((r) => {
    const value = r.value === null ? 0 : Number(r.value);
    const previous = prev ? (prevBy.get(String(r.label)) ?? 0) : undefined;
    return {
      key: String(r.label),
      label: labelOf(String(r.label)),
      value,
      previous,
      change: previous !== undefined && previous !== null && previous !== 0 ? (value - previous) / Math.abs(previous) : null,
    };
  });
  if (rankByChange) {
    const dir = m.sort === "asc" ? 1 : -1;
    rows.sort((x, y) => (x.change === null || x.change === undefined ? 1 : y.change === null || y.change === undefined ? -1 : dir * (x.change - y.change)));
    rows.splice(m.limit);
  }
  return {
    kind: "metric",
    unit: def.unit,
    metricLabel: def.label,
    groupLabel: dim?.label ?? null,
    periodLabel: def.timed ? periodLabel(m.period as Period) : "right now",
    previousLabel: prev?.label ?? null,
    timeSeries,
    rows,
    total: group ? (totals[0]?.value === undefined || totals[0]?.value === null ? null : Number(totals[0].value)) : (rows[0]?.value ?? 0),
    previousTotal: prev && !group ? (before[0]?.value === null || before[0]?.value === undefined ? 0 : Number(before[0].value)) : null,
  };
}

export async function executeList(plan: Plan, now = new Date()): Promise<ListAnswer> {
  const l = plan.list!;
  const ent = getEntityServer(l.entity)!;
  const meta = ent.meta;
  const filter = parseFilter(meta, l.filter);
  const query = { ...defaultQuery(meta), filter, sort: (l.sort && parseSort(meta, l.sort)) || meta.defaultSort, pageSize: 25 };
  const res = await listEntity(ent, query, now);
  const primary = meta.fields.find((f) => f.primary)!;
  const params = serializeListQuery(meta, query);
  return {
    kind: "list",
    entity: l.entity,
    entityLabel: meta.label,
    href: `${PORTAL_BASE}/${l.entity}${params.size ? `?${params}` : ""}`,
    total: res.total,
    preview: res.rows.slice(0, 6).map((r) => ({ id: r.id, title: String(r[primary.key] ?? `#${r.id}`), href: meta.rowHref ? (meta.rowHref(r) ?? undefined) : `${PORTAL_BASE}/${l.entity}/${r.id}` })),
    filter: serializeFilter(filter) ?? "[]",
  };
}

export async function executePlan(plan: Plan, now = new Date()): Promise<MetricAnswer | ListAnswer | { kind: "unsupported" }> {
  if (plan.kind === "metric") return executeMetric(plan, now);
  if (plan.kind === "list") return executeList(plan, now);
  return { kind: "unsupported" };
}
