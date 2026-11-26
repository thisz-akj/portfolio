import type { Unit } from "./semantic";

/** Client-safe shapes returned by "Ask Ops Suite". */

export interface AnswerRow {
  key: string;
  label: string;
  value: number;
  previous?: number | null;
  change?: number | null; // relative, e.g. -0.18
}

export interface MetricAnswer {
  kind: "metric";
  unit: Unit;
  metricLabel: string;
  groupLabel: string | null;
  periodLabel: string;
  previousLabel: string | null;
  timeSeries: boolean;
  rows: AnswerRow[];
  total: number | null;
  previousTotal: number | null;
}

export interface ListAnswer {
  kind: "list";
  entity: string;
  entityLabel: string;
  href: string;
  total: number;
  preview: { id: number; title: string; href?: string }[];
  filter: string;
}

/** What the browser sees about a live answer. Model, tokens and cost stay server-side (traces only). */
export interface AskUsage {
  latencyMs: number;
}

export type AskResult =
  | {
      ok: true;
      mode: "ai" | "example";
      traceId: number | null;
      question: string;
      /** Title and explanation of the answer — the internal plan itself never leaves the server. */
      title: string;
      explanation: string;
      notes: string[];
      answer: MetricAnswer | ListAnswer | { kind: "unsupported" };
      usage: AskUsage | null;
      /** Free questions left today (null for examples, which are free). */
      remaining: number | null;
    }
  | { ok: false; reason: "no_key" | "limit" | "quota" | "invalid" | "refused" | "error" | "denied"; message: string; traceId?: number | null };
