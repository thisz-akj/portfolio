import { entityMetas } from "../entities";
import { USERS, WAREHOUSES } from "../db/seed/reference";
import { DATE_PRESET_LABELS, OPS } from "../filters/types";
import { DIMENSIONS, LIST_ENTITIES, METRICS, PERIODS } from "./semantic";
import { PROMPT_VERSION } from "./plan";

/**
 * System prompt for "Ask Ops Suite", generated from the semantic layer and entity metadata so it can never drift
 * from what the validator accepts. Deterministic output (stable order, no dates) so prompt caching hits; the date
 * and persona go in the user message. Exported verbatim to ops-ai/contract.json for the Python eval harness.
 */

function catalogue(): string {
  const metrics = METRICS.map((m) => `- ${m.key}: ${m.label} — ${m.description}${m.timed ? "" : " (snapshot: use period all_time)"}`).join("\n");
  const dims = DIMENSIONS.map((d) => {
    const vals = d.values ? ` values: ${d.values.map((v) => (v.value === v.label ? v.value : `${v.value} (${v.label})`)).join(", ")}` : "";
    return `- ${d.key}: ${d.label}${d.description ? ` — ${d.description}` : ""}. Available on: ${d.facts.join(", ")}.${vals}`;
  }).join("\n");
  const facts = METRICS.reduce<Record<string, string[]>>((acc, m) => ((acc[m.fact] ??= []).push(m.key), acc), {});
  const factLines = Object.entries(facts)
    .map(([f, ms]) => `- ${f}: ${ms.join(", ")} · dimensions: ${DIMENSIONS.filter((d) => d.facts.includes(f as never)).map((d) => d.key).join(", ")}`)
    .join("\n");
  const periods = PERIODS.map((p) => `${p}${p in DATE_PRESET_LABELS ? ` (${DATE_PRESET_LABELS[p as keyof typeof DATE_PRESET_LABELS]})` : ""}`).join(", ");

  const lists = LIST_ENTITIES.map((key) => {
    const meta = entityMetas[key];
    const fields = meta.fields
      .filter((f) => f.filterable !== false)
      .map((f) => {
        const opts = f.options ? ` [${f.options.map((o) => o.value).join("|")}]` : "";
        const note = f.type === "relation" ? " (numeric ids)" : f.type === "money" ? " (rupees)" : f.unit ? ` (${f.unit})` : "";
        return `${f.key}:${f.type}${note}${opts}`;
      })
      .join("; ");
    return `- ${key} (${meta.label}): ${fields}`;
  }).join("\n");
  const ops = Object.entries(OPS).map(([t, o]) => `${t}: ${o.join(", ")}`).join("\n");
  const owners = USERS.map((u, i) => `${i + 1}=${u.name} (${u.role})`).join(", ");
  const whs = WAREHOUSES.map((w, i) => `${i + 1}=${w.code} ${w.name}`).join(", ");
  return `## Metrics (metric plans)\n${metrics}\n\n## Dimensions (group by or filter)\n${dims}\n\n## Facts — metrics and the dimensions they allow\n${factLines}\n\n## Periods\n${periods}\n\n## Lists (list plans) — entity: field:type[enum values]\n${lists}\n\n## Filter operators by field type\n${ops}\n\n## Relation ids\nowner / createdBy / actor (users): ${owners}\nwarehouse: ${whs}`;
}

export const SYSTEM_PROMPT = `You turn business questions about "Ops Suite" — the CRM, ERP and data portal of an Indian B2B industrial-supplies distributor (amounts in ₹, GST-inclusive unless stated; India time; financial year April–March, FY quarters Q1 = Apr–Jun) — into a query plan. You never write SQL and never invent metrics, dimensions, fields or values: use only the catalogue below. The server validates your plan and runs it read-only.

Choose exactly one kind:
- "metric" — a number, ranking, breakdown, trend or comparison. Pick the metric that matches the question, groupBy for "by X" / "which X" / "top X" (month for trends), filters for constraints, a period, and compare = previous_period for "vs last …", "change", "drop", "grew". For "top N" set limit N (default 10) and sort desc; for "lowest"/"biggest drop" sort asc. Snapshot metrics (outstanding, overdue, pipeline, stock) always use period all_time.
- "list" — when the user wants to see, find or open records ("show", "which invoices", "list deals that…"). Give the entity and a compact filter: a JSON array of conditions [field, op, value?] that are ANDed, or {"or":[…]} for alternatives. Values: enum → array of values; relation → array of numeric ids; money/number → number (5 lakh = 500000, 1 crore = 10000000); date preset → one preset name; is_empty/is_not_empty/is_true/is_false take no value. Sort is "field" or "-field" (descending), or null.
- "unsupported" — forecasts or predictions (point the user to the Signals panel on the dashboard), anything that would change data, questions outside this business data, or anything the catalogue can't express. Explain briefly in "explanation" and set metric and list to null.

Rules: fill "title" with a short heading and "explanation" with one or two sentences on how you read the question, including any assumption (e.g. which period "recently" means). Prefer the simplest plan that answers the question. Map words to catalogue values (e.g. "Mumbai warehouse" → BHW-01, "marketplace" → indiamart, "South India" → south). For people, use the exact full name from the relation list.

${catalogue()}

Prompt version ${PROMPT_VERSION}.`;

/** The user message, shared verbatim with the Python eval harness (contract.json → userTemplate). */
export const USER_TEMPLATE = "Today (India time): {today}. Asked by: {persona}.\n\nQuestion: {question}";
export const userMessage = (v: { today: string; persona: string; question: string }) =>
  USER_TEMPLATE.replace("{today}", v.today).replace("{persona}", v.persona).replace("{question}", v.question);
