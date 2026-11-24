import { z } from "zod";
import { getEntityMeta } from "../entities";
import { countConditions, parseFilter, parseSort, serializeFilter } from "../filters/parse";
import { DATE_PRESET_LABELS, type DatePreset } from "../filters/types";
import { DIMENSIONS, LIST_ENTITIES, METRICS, PERIODS, dimensionOf, metricOf, type Period } from "./semantic";

/**
 * The plan Claude returns for a question, validated twice: by structured outputs (JSON schema below) and here
 * (zod + semantic checks). Bump PROMPT_VERSION whenever the system prompt or this contract changes — eval runs and
 * traces are tagged with it.
 */

export const PROMPT_VERSION = "v1";

export const PlanSchema = z.object({
  kind: z.enum(["metric", "list", "unsupported"]),
  title: z.string().max(120),
  explanation: z.string().max(600),
  metric: z
    .object({
      metric: z.string(),
      groupBy: z.string().nullable(),
      filters: z.array(z.object({ dimension: z.string(), values: z.array(z.string().max(120)).max(20) })).max(6),
      period: z.string(),
      compare: z.enum(["none", "previous_period"]),
      sort: z.enum(["desc", "asc"]),
      limit: z.number().int(),
    })
    .nullable(),
  list: z.object({ entity: z.string(), filter: z.string().max(4000), sort: z.string().max(200).nullable() }).nullable(),
});
export type Plan = z.infer<typeof PlanSchema>;

/** JSON schema for structured outputs (no numeric/string constraints — those are enforced by zod above). */
export const PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "title", "explanation", "metric", "list"],
  properties: {
    kind: { type: "string", enum: ["metric", "list", "unsupported"] },
    title: { type: "string", description: "Short heading for the answer, e.g. 'Orders by region, last month vs previous'" },
    explanation: { type: "string", description: "One or two sentences: how the question was read and any assumptions" },
    metric: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["metric", "groupBy", "filters", "period", "compare", "sort", "limit"],
          properties: {
            metric: { type: "string", enum: METRICS.map((m) => m.key) },
            groupBy: { anyOf: [{ type: "null" }, { type: "string", enum: DIMENSIONS.map((d) => d.key) }] },
            filters: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["dimension", "values"],
                properties: { dimension: { type: "string", enum: DIMENSIONS.map((d) => d.key) }, values: { type: "array", items: { type: "string" } } },
              },
            },
            period: { type: "string", enum: [...PERIODS] },
            compare: { type: "string", enum: ["none", "previous_period"] },
            sort: { type: "string", enum: ["desc", "asc"] },
            limit: { type: "integer" },
          },
        },
      ],
    },
    list: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["entity", "filter", "sort"],
          properties: {
            entity: { type: "string", enum: [...LIST_ENTITIES] },
            filter: { type: "string", description: "Compact filter JSON, e.g. [[\"stage\",\"in\",[\"won\"]],[\"value\",\"gte\",500000]]" },
            sort: { anyOf: [{ type: "null" }, { type: "string" }] },
          },
        },
      ],
    },
  },
} as const;

export interface ValidPlan {
  plan: Plan;
  /** non-fatal adjustments made while validating (shown to the user, recorded on the trace) */
  notes: string[];
}

const norm = (s: string) => s.trim().toLowerCase();

/** Semantic validation: known metric/dimensions for the fact, known values for fixed dimensions, a parseable list filter. */
export function validatePlan(input: unknown): { ok: true; value: ValidPlan } | { ok: false; error: string } {
  const parsed = PlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: `Plan didn't match the schema: ${parsed.error.issues[0]?.message ?? "invalid"}` };
  const plan = structuredClone(parsed.data);
  const notes: string[] = [];

  if (plan.kind === "metric") {
    const m = plan.metric;
    if (!m) return { ok: false, error: "Metric plan without a metric" };
    const def = metricOf(m.metric);
    if (!def) return { ok: false, error: `Unknown metric “${m.metric}”` };
    if (m.groupBy) {
      const g = dimensionOf(m.groupBy);
      if (!g || !g.facts.includes(def.fact)) return { ok: false, error: `Can't group ${def.label} by “${m.groupBy}”` };
    }
    for (const f of m.filters) {
      const d = dimensionOf(f.dimension);
      if (!d || !d.facts.includes(def.fact)) return { ok: false, error: `Can't filter ${def.label} by “${f.dimension}”` };
      if (!f.values.length) return { ok: false, error: `Empty filter on ${d.label}` };
      if (d.values) {
        const mapped = f.values.map((val) => d.values!.find((o) => norm(o.value) === norm(val) || norm(o.label) === norm(val))?.value);
        if (mapped.some((x) => !x)) return { ok: false, error: `Unknown ${d.label.toLowerCase()} value in ${JSON.stringify(f.values)}` };
        f.values = mapped as string[];
      }
      if (d.key === "month" && f.values.some((x) => !/^\d{4}-\d{2}$/.test(x))) return { ok: false, error: "Month filters must look like 2026-10" };
    }
    if (!(PERIODS as readonly string[]).includes(m.period)) return { ok: false, error: `Unknown period “${m.period}”` };
    if (!def.timed && m.period !== "all_time") {
      notes.push(`${def.label} is a current snapshot, so the period was ignored`);
      m.period = "all_time";
    }
    if (m.compare === "previous_period" && (m.period === "all_time" || !def.timed)) {
      notes.push("Comparison needs a time period, so it was dropped");
      m.compare = "none";
    }
    if (m.limit < 1 || m.limit > 50) m.limit = Math.min(50, Math.max(1, m.limit || 10));
    plan.list = null;
  } else if (plan.kind === "list") {
    const l = plan.list;
    if (!l) return { ok: false, error: "List plan without a list" };
    const meta = getEntityMeta(l.entity);
    if (!meta || !(LIST_ENTITIES as readonly string[]).includes(l.entity)) return { ok: false, error: `Unknown list “${l.entity}”` };
    let raw: unknown;
    try {
      raw = JSON.parse(l.filter || "[]");
    } catch {
      return { ok: false, error: "List filter isn't valid JSON" };
    }
    const given = Array.isArray(raw) ? raw.length : 1;
    const filter = parseFilter(meta, JSON.stringify(raw));
    const kept = countConditions(filter);
    if (given > 0 && kept === 0) return { ok: false, error: "None of the list filter conditions were valid" };
    if (kept < given) notes.push(`${given - kept} filter condition(s) weren't valid and were dropped`);
    l.filter = serializeFilter(filter) ?? "[]";
    if (l.sort && !parseSort(meta, l.sort)) {
      notes.push("Sort wasn't valid and was ignored");
      l.sort = null;
    }
    plan.metric = null;
  } else {
    plan.metric = null;
    plan.list = null;
  }
  return { ok: true, value: { plan, notes } };
}

/** Human-readable query, shown under every answer ("show your work"). */
export function describePlan(plan: Plan): string {
  if (plan.kind === "list" && plan.list) return `LIST ${plan.list.entity} WHERE ${plan.list.filter === "[]" ? "(everything)" : plan.list.filter}${plan.list.sort ? ` SORT ${plan.list.sort}` : ""}`;
  if (plan.kind !== "metric" || !plan.metric) return "—";
  const m = plan.metric;
  const def = metricOf(m.metric)!;
  const parts = [`${def.label.toUpperCase()}`];
  if (m.groupBy) parts.push(`BY ${dimensionOf(m.groupBy)!.label.toLowerCase()}`);
  if (def.timed) parts.push(`IN ${periodLabel(m.period as Period)}`);
  if (m.filters.length) parts.push(`WHERE ${m.filters.map((f) => `${dimensionOf(f.dimension)!.label.toLowerCase()} ∈ {${f.values.join(", ")}}`).join(" AND ")}`);
  if (m.compare === "previous_period") parts.push("VS PREVIOUS PERIOD");
  if (m.groupBy && m.groupBy !== "month") parts.push(`TOP ${m.limit} ${m.sort.toUpperCase()}`);
  return parts.join(" ");
}

export const periodLabel = (p: Period) => (p === "all_time" ? "all time" : p === "last_12_months" ? "the last 12 months" : DATE_PRESET_LABELS[p as DatePreset]);
