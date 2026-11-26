"use server";

import { and, count, eq, gte, ne, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { aiTraces } from "../db/schema";
import { getPersona } from "../auth/persona.server";
import { ROLE_LABEL } from "../auth/permissions";
import { todayIST } from "../filters/dates";
import { allow, LIMITS } from "../lib/rateLimit";
import { refundAiQuestion, takeAiQuestion } from "@/lib/aiQuota";
import { aiConfigured, requestPlan, type PlanCall } from "./llm.server";
import { getCachedPlan, putCachedPlan } from "./planCache";
import { planFromExpected } from "./examples";
import { GOLDEN } from "./golden";
import { PROMPT_VERSION, validatePlan } from "./plan";
import { executePlan } from "./semantic.server";
import type { AskResult } from "./types";

/** Server actions for "Ask Ops Suite". Public endpoints: inputs are re-checked, rate-limited and budget-capped. */

const DAILY_LIMIT = Number(process.env.OPS_AI_DAILY_LIMIT ?? 300);

async function clientKey() {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
  } catch {
    return "local";
  }
}

async function trace(row: typeof aiTraces.$inferInsert): Promise<number | null> {
  try {
    const db = await getDb();
    const [t] = await db.insert(aiTraces).values(row).returning({ id: aiTraces.id });
    return t.id;
  } catch (err) {
    console.error("[ops-suite] trace write failed:", err);
    return null;
  }
}

export async function aiStatusAction(): Promise<{ configured: boolean; examples: { id: string; question: string }[] }> {
  return { configured: aiConfigured(), examples: GOLDEN.filter((g) => g.example).map((g) => ({ id: g.id, question: g.question })) };
}

export async function askAction(raw: unknown): Promise<AskResult> {
  const question = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (question.length < 3 || question.length > 300) return { ok: false, reason: "invalid", message: "Ask a question between 3 and 300 characters." };
  if (!aiConfigured()) return { ok: false, reason: "no_key", message: "Free-form questions are off in this preview. Try one of the example questions." };
  if (!allow(`ai:${await clientKey()}`, LIMITS.ai)) return { ok: false, reason: "limit", message: "That's a lot of questions in a short time — please wait a few minutes." };

  const db = await getDb();
  const startOfDay = new Date(`${todayIST()}T00:00:00+05:30`);
  const [{ n }] = await db.select({ n: count() }).from(aiTraces).where(and(gte(aiTraces.at, startOfDay), ne(aiTraces.status, "example")));
  if (n >= DAILY_LIMIT) return { ok: false, reason: "limit", message: "Today's question budget for this public demo is used up — it resets at midnight India time." };

  // Free questions per visitor per day (examples don't count); then the UI invites a message instead.
  const visitor = await clientKey();
  const quota = takeAiQuestion("ops-ask", visitor);
  if (!quota.ok) return { ok: false, reason: "quota", message: "You've used today's free questions." };

  const persona = await getPersona();
  const personaLabel = persona ? `${persona.name} (${ROLE_LABEL[persona.role]})` : "Demo Admin (Admin)";
  // Same question asked before today (same persona) → reuse its plan: zero tokens, still run on live data.
  const cacheCtx = { today: todayIST(), persona: personaLabel, version: PROMPT_VERSION };
  const cachedJson = getCachedPlan(question, cacheCtx);
  const call: PlanCall = cachedJson
    ? { ok: true, status: "ok", json: cachedJson, model: "cache", servedBy: "cache", effort: "-", latencyMs: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsd: 0 }
    : await requestPlan(question, { today: cacheCtx.today, persona: personaLabel });
  const base = {
    persona: personaLabel,
    question,
    model: call.model,
    servedBy: call.servedBy,
    effort: call.effort,
    promptVersion: PROMPT_VERSION,
    latencyMs: call.latencyMs,
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
    cacheReadTokens: call.cacheReadTokens,
    costUsd: call.costUsd,
  };
  if (!call.ok) {
    if (call.status === "error") refundAiQuestion("ops-ask", visitor); // service trouble shouldn't cost a question
    const traceId = await trace({ ...base, status: call.status === "refused" ? "refused" : "error", error: call.error });
    const message = call.status === "refused" ? "I can only answer questions about this business's data." : "Something went wrong — please try again.";
    return { ok: false, reason: call.status === "refused" ? "refused" : "error", message, traceId };
  }
  const valid = validatePlan(call.json);
  if (valid.ok && !cachedJson) putCachedPlan(question, cacheCtx, call.json);
  if (!valid.ok) {
    const traceId = await trace({ ...base, status: "invalid", plan: call.json as object, error: valid.error });
    return { ok: false, reason: "invalid", message: "I couldn't answer that safely. Try rephrasing the question.", traceId };
  }
  try {
    const answer = await executePlan(valid.value.plan);
    const rows = answer.kind === "metric" ? answer.rows.length : answer.kind === "list" ? answer.total : 0;
    const traceId = await trace({ ...base, status: "ok", plan: valid.value.plan, rows, error: valid.value.notes.join("; ") || null });
    return {
      ok: true,
      mode: "ai",
      traceId,
      question,
      title: valid.value.plan.title,
      explanation: valid.value.plan.explanation,
      notes: valid.value.notes,
      answer,
      usage: { latencyMs: call.latencyMs },
      remaining: quota.remaining,
    };
  } catch (err) {
    console.error("[ops-suite] plan execution failed:", err);
    const traceId = await trace({ ...base, status: "error", plan: valid.value.plan, error: "Query failed to run" });
    return { ok: false, reason: "error", message: "The query couldn't run — the demo database may be unavailable.", traceId };
  }
}

export async function runExampleAction(id: unknown): Promise<AskResult> {
  const g = GOLDEN.find((x) => x.example && x.id === id);
  if (!g) return { ok: false, reason: "invalid", message: "Unknown example" };
  const valid = validatePlan(await planFromExpected(g.expected, g.question));
  if (!valid.ok) return { ok: false, reason: "invalid", message: "This example couldn't run." };
  const answer = await executePlan(valid.value.plan);
  const persona = await getPersona();
  const traceId = await trace({ persona: persona?.name ?? null, question: g.question, status: "example", plan: valid.value.plan, promptVersion: PROMPT_VERSION, rows: answer.kind === "metric" ? answer.rows.length : answer.kind === "list" ? answer.total : 0 });
  return { ok: true, mode: "example", traceId, question: g.question, title: valid.value.plan.title, explanation: valid.value.plan.explanation, notes: valid.value.notes, answer, usage: null, remaining: null };
}

export async function feedbackAction(traceId: unknown, value: unknown): Promise<{ ok: boolean }> {
  if (typeof traceId !== "number" || !Number.isInteger(traceId) || traceId <= 0 || (value !== 1 && value !== -1)) return { ok: false };
  if (!allow(`ai-feedback:${await clientKey()}`, LIMITS.write)) return { ok: false };
  const db = await getDb();
  // only recent traces can be rated, so old answers can't be bulk-edited
  await db
    .update(aiTraces)
    .set({ feedback: value })
    .where(and(eq(aiTraces.id, traceId), sql`${aiTraces.at} > now() - interval '1 day'`));
  return { ok: true };
}
