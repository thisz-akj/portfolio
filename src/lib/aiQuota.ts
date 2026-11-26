/**
 * Free AI questions per visitor, per tool, per day (IST). Used by the site assistant (/api/assistant)
 * and "Ask Ops Suite". After the allowance the UI invites the visitor to send a message instead.
 *
 * In-memory and per server instance — good enough for a portfolio demo; the client also tracks it
 * so the pop-up appears even if a request lands on a fresh instance. Server-only.
 */

export type AiTool = "assistant" | "ops-ask" | "docdesk-ask" | "docdesk-upload" | "voice-call" | "voice-turn" | "autopilot-read";

export const FREE_AI_QUESTIONS = Math.max(1, Number(process.env.AI_FREE_QUESTIONS ?? 3) || 3);

/** Free caller turns on the live voice demo per visitor per day (both lines together). Then the "build this" pop-up. */
export const VOICE_FREE_TURNS = Math.max(1, Number(process.env.VOICE_FREE_TURNS ?? 5) || 5);

const used = new Map<string, number>();
let day = "";

const todayIST = (now: number) => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);

export interface QuotaResult {
  ok: boolean;
  /** Questions left after this one (0 = this was the last free one). */
  remaining: number;
  limit: number;
}

/** Counts one question for `visitor` on `tool`; ok=false (nothing counted) once the allowance is used. */
export function takeAiQuestion(tool: AiTool, visitor: string, now = Date.now(), limit = FREE_AI_QUESTIONS): QuotaResult {
  const d = todayIST(now);
  if (d !== day) {
    day = d;
    used.clear();
  }
  const key = `${tool}:${visitor}`;
  const n = used.get(key) ?? 0;
  if (n >= limit) return { ok: false, remaining: 0, limit };
  used.set(key, n + 1);
  if (used.size > 20_000) used.clear(); // memory guard
  return { ok: true, remaining: limit - n - 1, limit };
}

/** How many are left for `visitor` on `tool` today, without counting anything. */
export function peekAiQuestion(tool: AiTool, visitor: string, now = Date.now(), limit = FREE_AI_QUESTIONS): number {
  if (todayIST(now) !== day) return limit;
  return Math.max(0, limit - (used.get(`${tool}:${visitor}`) ?? 0));
}

/** Gives a question back (e.g. the model call failed before answering). */
export function refundAiQuestion(tool: AiTool, visitor: string) {
  const key = `${tool}:${visitor}`;
  const n = used.get(key) ?? 0;
  if (n > 0) used.set(key, n - 1);
}

export const visitorFromHeaders = (h: Headers) => h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
