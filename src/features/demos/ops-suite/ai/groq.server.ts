import { PLAN_JSON_SCHEMA } from "./plan";
import { SYSTEM_PROMPT, userMessage } from "./prompt";
import type { PlanCall } from "./claude.server";

/**
 * Question → plan JSON via Groq (OpenAI-compatible API, strict JSON-schema output). Server-only.
 * Tries each model in OPS_AI_GROQ_MODELS in order; a model that is rate-limited (free tier:
 * ~8k tokens/min each), busy or slow is skipped. Free tier → cost is recorded as 0.
 */

const URL = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_GROQ_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"];
const TIMEOUT_MS = 20_000;

export const groqConfigured = () => Boolean(process.env.GROQ_API_KEY);

const models = () => {
  const fromEnv = (process.env.OPS_AI_GROQ_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_GROQ_MODELS;
};

const extra = (model: string) => (model.includes("gpt-oss") ? { reasoning_effort: "low" } : model.includes("qwen") ? { reasoning_effort: "none" } : {});

export async function requestPlanGroq(question: string, context: { today: string; persona: string }): Promise<PlanCall> {
  const list = models();
  const started = Date.now();
  const base = { model: list[0], servedBy: list[0], effort: "low", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsd: 0 };
  let lastError = "Couldn't reach the AI service";

  for (const model of list) {
    let res: Response;
    try {
      res = await fetch(URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_completion_tokens: 1200, // a plan is ~300 tokens; the cap bounds worst-case spend
          response_format: { type: "json_schema", json_schema: { name: "plan", strict: true, schema: PLAN_JSON_SCHEMA } },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage({ today: context.today, persona: context.persona, question }) },
          ],
          ...extra(model),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      lastError = "The AI service took too long to answer";
      continue; // timeout / network → next model
    }
    if (res.status === 401) return { ...base, latencyMs: Date.now() - started, ok: false, status: "error", json: null, error: "The API key was rejected" };
    if (!res.ok) {
      lastError = res.status === 429 ? "The AI service is busy — try again in a minute" : `AI service error (${res.status})`;
      continue; // rate-limited / busy / schema unsupported → next model
    }
    const body = (await res.json()) as {
      model?: string;
      choices?: { message?: { content?: string; refusal?: string | null }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choice = body.choices?.[0];
    const usage = { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 };
    const done = { ...base, ...usage, servedBy: body.model ?? model, latencyMs: Date.now() - started };
    if (choice?.message?.refusal) return { ...done, ok: false, status: "refused", json: null, error: "The model declined this question" };
    if (choice?.finish_reason === "length") return { ...done, ok: false, status: "error", json: null, error: "The answer was cut off" };
    try {
      return { ...done, ok: true, status: "ok", json: JSON.parse(choice?.message?.content ?? "") };
    } catch {
      lastError = "The model's reply wasn't valid JSON";
      continue;
    }
  }
  console.error("[ops-suite] Groq: every model failed —", lastError);
  return { ...base, latencyMs: Date.now() - started, ok: false, status: "error", json: null, error: lastError };
}
