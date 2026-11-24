import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { aiInsights, auditLog, companies, deals, inventory, invoices, salesOrders, users } from "../db/schema";
import { DEAL_STAGE } from "../entities/crm-options";
import { addDaysISO, presetRange, todayIST } from "../filters/dates";
import { serializeFilter } from "../filters/parse";
import type { Condition } from "../filters/types";
import { PORTAL_BASE } from "../nav";

/** Dashboard numbers. Every KPI carries a link to the filtered list that explains it. Server-only. */

export interface Kpi {
  key: string;
  label: string;
  value: number;
  format: "inr" | "count" | "pct";
  sub?: string;
  delta?: { value: number; label: string }; // relative change, e.g. 0.12 = +12%
  href: string;
}
export interface Point {
  label: string;
  value: number;
  detail?: string;
  href?: string;
}
export interface FeedItem {
  id: number;
  at: string;
  summary: string;
  actor: string | null;
  action: string;
  href?: string;
}
export interface Signal {
  id: number;
  kind: string;
  severity: number;
  title: string;
  detail: string;
  method: string;
  computedAt: string;
  href?: string;
}
export interface Dashboard {
  kpis: Kpi[];
  revenue: Point[];
  funnel: Point[];
  aging: Point[];
  topCustomers: Point[];
  feed: FeedItem[];
  signals: Signal[];
}

const list = (entity: string, conditions: Condition[], extra = "") =>
  `${PORTAL_BASE}/${entity}?f=${encodeURIComponent(serializeFilter({ combinator: "and", conditions })!)}${extra}`;

/** audit_log.entity (table) → portal URL slug */
const SLUG: Record<string, string> = { sales_orders: "sales-orders", purchase_orders: "purchase-orders" };
const LINKABLE = new Set(["companies", "contacts", "leads", "deals", "products", "inventory", "sales-orders", "purchase-orders", "invoices", "payments"]);

const n = (v: unknown) => Number(v ?? 0);
const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

export async function loadDashboard(now = new Date()): Promise<Dashboard> {
  const db = await getDb();
  const today = todayIST(now);
  const month = presetRange("this_month", now);
  const lastMonth = presetRange("last_month", now);
  // same number of days into last month, for a fair month-to-date comparison
  const dayOfMonth = Number(today.slice(8, 10));
  const lastMtdEnd = addDaysISO(lastMonth.from!, dayOfMonth);
  const notCancelled = sql`${salesOrders.status} <> 'cancelled'`;
  const open = ["new", "qualified", "proposal", "negotiation"] as const;
  const unpaid = inArray(invoices.status, ["sent", "partially_paid"]);
  const start12 = (() => {
    const [y, m] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 12, 1)).toISOString().slice(0, 10);
  })();

  const [[mtd], [prevMtd], [pipe], [ar], [low], [closed], [toFulfil], byMonth, funnelRows, agingRows, top, feedRows] = await Promise.all([
    db.select({ s: sql`coalesce(sum(${salesOrders.total}), 0)`, c: sql`count(*)` }).from(salesOrders).where(and(notCancelled, gte(salesOrders.orderDate, month.from!), lt(salesOrders.orderDate, month.to!))),
    db.select({ s: sql`coalesce(sum(${salesOrders.total}), 0)` }).from(salesOrders).where(and(notCancelled, gte(salesOrders.orderDate, lastMonth.from!), lt(salesOrders.orderDate, lastMtdEnd))),
    db.select({ s: sql`coalesce(sum(${deals.value}), 0)`, w: sql`coalesce(sum(${deals.value} * ${deals.probability} / 100.0), 0)`, c: sql`count(*)` }).from(deals).where(inArray(deals.stage, [...open])),
    db
      .select({ s: sql`coalesce(sum(${invoices.total} - ${invoices.amountPaid}), 0)`, o: sql`coalesce(sum(${invoices.total} - ${invoices.amountPaid}) filter (where ${invoices.dueDate} < ${today}), 0)`, c: sql`count(*) filter (where ${invoices.dueDate} < ${today})` })
      .from(invoices)
      .where(unpaid),
    db.select({ c: sql`count(*)` }).from(inventory).where(sql`${inventory.qtyOnHand} = 0 or ${inventory.qtyOnHand} - ${inventory.qtyReserved} < ${inventory.reorderLevel}`),
    db
      .select({ won: sql`count(*) filter (where ${deals.stage} = 'won')`, lost: sql`count(*) filter (where ${deals.stage} = 'lost')` })
      .from(deals)
      .where(sql`${deals.closedAt} >= ${addDaysISO(today, -89)}::date`),
    db.select({ c: sql`count(*)` }).from(salesOrders).where(eq(salesOrders.status, "confirmed")),
    db
      .select({ m: sql<string>`to_char(date_trunc('month', ${salesOrders.orderDate}), 'YYYY-MM-01')`, s: sql`coalesce(sum(${salesOrders.total}), 0)`, c: sql`count(*)` })
      .from(salesOrders)
      .where(and(notCancelled, gte(salesOrders.orderDate, start12)))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db.select({ stage: deals.stage, s: sql`coalesce(sum(${deals.value}), 0)`, c: sql`count(*)` }).from(deals).where(inArray(deals.stage, [...open])).groupBy(deals.stage),
    db
      .select({
        b: sql<string>`case when ${invoices.dueDate} >= ${today} then 'not_due' when ${today}::date - ${invoices.dueDate} <= 30 then '1_30' when ${today}::date - ${invoices.dueDate} <= 60 then '31_60' when ${today}::date - ${invoices.dueDate} <= 90 then '61_90' else '90_plus' end`,
        s: sql`coalesce(sum(${invoices.total} - ${invoices.amountPaid}), 0)`,
        c: sql`count(*)`,
      })
      .from(invoices)
      .where(unpaid)
      .groupBy(sql`1`),
    db
      .select({ id: companies.id, name: companies.name, s: sql`sum(${salesOrders.total})` })
      .from(salesOrders)
      .innerJoin(companies, eq(companies.id, salesOrders.companyId))
      .where(and(notCancelled, gte(salesOrders.orderDate, addDaysISO(today, -364))))
      .groupBy(companies.id, companies.name)
      .orderBy(desc(sql`sum(${salesOrders.total})`))
      .limit(6),
    db.select({ l: auditLog, actor: users.name }).from(auditLog).leftJoin(users, eq(users.id, auditLog.actorId)).orderBy(desc(auditLog.at), desc(auditLog.id)).limit(14),
  ]);
  const signalRows = await db
    .select()
    .from(aiInsights)
    .orderBy(sql`case when ${aiInsights.kind} = 'forecast' then 0 else 1 end`, desc(aiInsights.severity), desc(aiInsights.value))
    .limit(7)
    .catch(() => []);

  const winRate = n(closed.won) + n(closed.lost) ? n(closed.won) / (n(closed.won) + n(closed.lost)) : 0;
  const prev = n(prevMtd.s);

  const kpis: Kpi[] = [
    {
      key: "revenue",
      label: "Orders booked this month",
      value: n(mtd.s),
      format: "inr",
      sub: `${n(mtd.c)} orders, incl. GST`,
      delta: prev ? { value: (n(mtd.s) - prev) / prev, label: `vs same days last month` } : undefined,
      href: list("sales-orders", [{ field: "orderDate", op: "preset", value: "this_month" }, { field: "status", op: "in", value: ["draft", "confirmed", "fulfilled"] }]),
    },
    {
      key: "pipeline",
      label: "Open pipeline",
      value: n(pipe.s),
      format: "inr",
      sub: `${n(pipe.c)} deals · weighted ₹${(n(pipe.w) / 1e7).toFixed(2)} Cr`,
      href: list("deals", [{ field: "stage", op: "in", value: [...open] }], "&sort=-weighted"),
    },
    {
      key: "overdue",
      label: "Overdue receivables",
      value: n(ar.o),
      format: "inr",
      sub: `${n(ar.c)} invoices · ₹${(n(ar.s) / 1e7).toFixed(2)} Cr outstanding`,
      href: list("invoices", [{ field: "daysOverdue", op: "gt", value: 0 }], "&sort=-daysOverdue"),
    },
    {
      key: "win",
      label: "Win rate, last 90 days",
      value: winRate,
      format: "pct",
      sub: `${n(closed.won)} won · ${n(closed.lost)} lost`,
      href: list("deals", [{ field: "stage", op: "in", value: ["won", "lost"] }, { field: "closedAt", op: "within_last", value: 90 }]),
    },
    {
      key: "fulfil",
      label: "Orders to fulfil",
      value: n(toFulfil.c),
      format: "count",
      sub: "confirmed, stock reserved",
      href: list("sales-orders", [{ field: "status", op: "in", value: ["confirmed"] }], "&sort=orderDate"),
    },
    {
      key: "stock",
      label: "Stock below reorder",
      value: n(low.c),
      format: "count",
      sub: "product × warehouse",
      href: list("inventory", [{ field: "status", op: "in", value: ["low", "out"] }]),
    },
  ];

  // 12 calendar months, including empty ones, current month marked partial
  const months: Point[] = [];
  for (let i = 11; i >= 0; i--) {
    const [y, m] = today.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = first.toISOString().slice(0, 10);
    const row = byMonth.find((r) => r.m === key);
    const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    months.push({
      label: monthLabel.format(first) + (i === 0 ? "*" : ""),
      value: n(row?.s),
      detail: `${n(row?.c)} orders${i === 0 ? " · month to date" : ""}`,
      href: list("sales-orders", [{ field: "orderDate", op: "between", value: [key, addDaysISO(next, -1)] }]),
    });
  }

  const AGING_LABEL: Record<string, string> = { not_due: "Not yet due", "1_30": "1–30 days", "31_60": "31–60 days", "61_90": "61–90 days", "90_plus": "90+ days" };
  return {
    kpis,
    revenue: months,
    funnel: open.map((s) => {
      const r = funnelRows.find((x) => x.stage === s);
      return { label: DEAL_STAGE.find((o) => o.value === s)!.label, value: n(r?.s), detail: `${n(r?.c)} deals`, href: list("deals", [{ field: "stage", op: "in", value: [s] }]) };
    }),
    aging: Object.keys(AGING_LABEL).map((b) => {
      const r = agingRows.find((x) => x.b === b);
      return {
        label: AGING_LABEL[b],
        value: n(r?.s),
        detail: `${n(r?.c)} invoices`,
        href: list("invoices", [{ field: "aging", op: "in", value: [b] }], "&sort=-balance"),
      };
    }),
    topCustomers: top.map((t) => ({ label: t.name, value: n(t.s), href: `${PORTAL_BASE}/companies/${t.id}` })),
    signals: signalRows.map((r) => ({
      id: r.id,
      kind: r.kind,
      severity: r.severity,
      title: r.title,
      detail: r.detail,
      method: r.method,
      computedAt: r.computedAt.toISOString(),
      href: r.entity && r.entityId && LINKABLE.has(r.entity) ? `${PORTAL_BASE}/${r.entity}/${r.entityId}` : undefined,
    })),
    feed: feedRows.map(({ l, actor }) => {
      const slug = SLUG[l.entity] ?? l.entity;
      return { id: l.id, at: l.at.toISOString(), summary: l.summary ?? l.action, actor, action: l.action, href: LINKABLE.has(slug) ? `${PORTAL_BASE}/${slug}/${l.entityId}` : undefined };
    }),
  };
}
