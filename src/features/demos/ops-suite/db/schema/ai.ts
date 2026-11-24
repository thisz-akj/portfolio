import { bigserial, boolean, index, integer, jsonb, numeric, pgEnum, pgTable, serial, smallint, text, timestamp } from "drizzle-orm/pg-core";

/**
 * AI layer: live question traces (monitoring), offline eval runs/results (written by the Python harness in /ops-ai),
 * and statistical insights (forecasts, anomalies — also written by Python). Not touched by the nightly reset,
 * so monitoring history survives it; insights are recomputed after each reset.
 */

export const aiTraceStatusEnum = pgEnum("ai_trace_status", ["ok", "invalid", "refused", "error", "example"]);

export const aiTraces = pgTable(
  "ai_traces",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    persona: text("persona"),
    question: text("question").notNull(),
    status: aiTraceStatusEnum("status").notNull(),
    plan: jsonb("plan"),
    error: text("error"),
    model: text("model"),
    servedBy: text("served_by"), // differs from model when a server-side fallback answered
    effort: text("effort"),
    promptVersion: text("prompt_version"),
    latencyMs: integer("latency_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6, mode: "number" }),
    rows: integer("rows"),
    feedback: smallint("feedback"), // 1 = helpful, -1 = not helpful
  },
  (t) => [index("ai_traces_at_idx").on(t.at), index("ai_traces_status_idx").on(t.status)],
);

export const aiEvalRuns = pgTable("ai_eval_runs", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(), // e.g. "opus-5-5 · effort low · prompt v1"
  model: text("model").notNull(),
  effort: text("effort").notNull(),
  promptVersion: text("prompt_version").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  cases: integer("cases").notNull().default(0),
  passed: integer("passed").notNull().default(0),
  p50Ms: integer("p50_ms"),
  p95Ms: integer("p95_ms"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6, mode: "number" }),
  notes: text("notes"),
});

export const aiEvalResults = pgTable(
  "ai_eval_results",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => aiEvalRuns.id, { onDelete: "cascade" }),
    caseId: text("case_id").notNull(),
    question: text("question").notNull(),
    expected: jsonb("expected").notNull(),
    got: jsonb("got"),
    pass: boolean("pass").notNull(),
    reason: text("reason"),
    latencyMs: integer("latency_ms"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6, mode: "number" }),
  },
  (t) => [index("ai_eval_results_run_idx").on(t.runId)],
);

export const aiInsightKindEnum = pgEnum("ai_insight_kind", ["forecast", "customer_drop", "stockout_risk", "order_anomaly"]);

export const aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  kind: aiInsightKindEnum("kind").notNull(),
  severity: smallint("severity").notNull().default(1), // 1 info · 2 watch · 3 act
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  entity: text("entity"), // portal slug to link, e.g. "companies"
  entityId: integer("entity_id"),
  value: numeric("value", { precision: 16, scale: 2, mode: "number" }),
  data: jsonb("data"), // series or evidence for charts
  method: text("method").notNull(), // e.g. "Holt linear trend (statsmodels)"
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});
