import type { Plan } from "./plan";
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

export interface AskUsage {
  model: string;
  servedBy: string;
  effort: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
}

export type AskResult =
  | {
      ok: true;
      mode: "ai" | "example";
      traceId: number | null;
      question: string;
      plan: Plan;
      notes: string[];
      query: string;
      answer: MetricAnswer | ListAnswer | { kind: "unsupported" };
      usage: AskUsage | null;
    }
  | { ok: false; reason: "no_key" | "limit" | "invalid" | "refused" | "error" | "denied"; message: string; traceId?: number | null };
