import type { Expected } from "./golden";
import type { Plan } from "./plan";

/** Turns a golden expectation into a full plan (used for examples when AI is off). */
export function planFromExpected(e: Expected, question: string): Plan {
  const explanation = "Hand-written example plan — AI is off on this deployment, so this shows the engine without the model.";
  if (e.kind === "metric")
    return {
      kind: "metric",
      title: question,
      explanation,
      metric: { metric: e.metric, groupBy: e.groupBy, filters: e.filters.map(([dimension, values]) => ({ dimension, values })), period: e.period, compare: e.compare, sort: e.compare === "previous_period" ? "asc" : "desc", limit: /top 5/i.test(question) ? 5 : 10 },
      list: null,
    };
  if (e.kind === "list") return { kind: "list", title: question, explanation, metric: null, list: { entity: e.entity, filter: JSON.stringify(e.conditions), sort: null } };
  return { kind: "unsupported", title: question, explanation, metric: null, list: null };
}

