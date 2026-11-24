import Anthropic from "@anthropic-ai/sdk";
import { costUsd, DEFAULT_EFFORT, DEFAULT_MODEL } from "./pricing";
import { PLAN_JSON_SCHEMA } from "./plan";
import { SYSTEM_PROMPT, userMessage } from "./prompt";

/**
 * One Claude call: question → plan JSON (structured outputs), with server-side refusal fallback.
 * Returns raw JSON for validatePlan() plus usage for tracing. Server-only.
 */

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ timeout: 30_000, maxRetries: 1 }));

export interface PlanCall {
  ok: boolean;
  status: "ok" | "refused" | "error";
  json: unknown;
  error?: string;
  model: string;
  servedBy: string;
  effort: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
}

export async function requestPlan(question: string, context: { today: string; persona: string }, opts: { model?: string; effort?: "low" | "medium" | "high" } = {}): Promise<PlanCall> {
  const model = opts.model ?? process.env.OPS_AI_MODEL ?? DEFAULT_MODEL;
  const effort = opts.effort ?? (process.env.OPS_AI_EFFORT as "low" | "medium" | "high" | undefined) ?? (DEFAULT_EFFORT as "low");
  const started = Date.now();
  const base = { model, servedBy: model, effort, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsd: 0 };
  try {
    const res = await getClient().beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort, format: { type: "json_schema", schema: PLAN_JSON_SCHEMA as unknown as Record<string, unknown> } },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage({ today: context.today, persona: context.persona, question }) }],
    });
    const u = res.usage;
    const usage = {
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      costUsd: costUsd(res.model, { input: u.input_tokens, output: u.output_tokens, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 }),
    };
    const latencyMs = Date.now() - started;
    if (res.stop_reason === "refusal") return { ...base, ...usage, servedBy: res.model, latencyMs, ok: false, status: "refused", json: null, error: "The model declined this question" };
    if (res.stop_reason === "max_tokens") return { ...base, ...usage, servedBy: res.model, latencyMs, ok: false, status: "error", json: null, error: "The answer was cut off" };
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ...base, ...usage, servedBy: res.model, latencyMs, ok: false, status: "error", json: null, error: "The model's reply wasn't valid JSON" };
    }
    return { ...base, ...usage, servedBy: res.model, latencyMs, ok: true, status: "ok", json };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const message =
      err instanceof Anthropic.AuthenticationError
        ? "The API key was rejected"
        : err instanceof Anthropic.RateLimitError
          ? "The AI service is busy — try again in a minute"
          : err instanceof Anthropic.APIConnectionTimeoutError
            ? "The AI service took too long to answer"
            : err instanceof Anthropic.APIError
              ? `AI service error (${err.status ?? "network"})`
              : "Couldn't reach the AI service";
    console.error("[ops-suite] Claude call failed:", err);
    return { ...base, latencyMs, ok: false, status: "error", json: null, error: message };
  }
}
