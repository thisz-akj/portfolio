/**
 * Free AI questions per visitor, per tool, per day (IST). Used by the site assistant (/api/assistant),
 * "Ask Ops Suite" and the demo proxies. After the allowance the UI invites the visitor to send a message.
 *
 * Shared store: Upstash Redis (REST) when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, so
 * the count holds across serverless instances. Otherwise — or if Redis is unreachable — an in-memory
 * count per server instance (the client also tracks it, so the pop-up still appears). Server-only.
 */

export type AiTool = "assistant" | "ops-ask" | "docdesk-ask" | "docdesk-upload" | "voice-call" | "voice-turn" | "autopilot-read";

export const FREE_AI_QUESTIONS = Math.max(1, Number(process.env.AI_FREE_QUESTIONS ?? 3) || 3);

/** Free caller turns on the live voice demo per visitor per day (both lines together). Then the "build this" pop-up. */
export const VOICE_FREE_TURNS = Math.max(1, Number(process.env.VOICE_FREE_TURNS ?? 5) || 5);

export interface QuotaResult {
  ok: boolean;
  /** Questions left after this one (0 = this was the last free one). */
  remaining: number;
  limit: number;
}

const todayIST = (now: number) => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
const keyFor = (tool: AiTool, visitor: string, now: number) => `aiq:${todayIST(now)}:${tool}:${visitor}`;

// ---- shared store (Upstash REST) -------------------------------------------------------------

const TTL_S = 36 * 3600; // a day key outlives its IST day, then expires

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

/** Runs commands in one round trip; null on any failure (callers fall back to memory). */
async function redis(commands: (string | number)[][]): Promise<unknown[] | null> {
  const cfg = redisConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    if (!Array.isArray(out) || out.some((r) => r.error)) return null;
    return out.map((r) => r.result);
  } catch {
    return null;
  }
}

// ---- in-memory fallback ----------------------------------------------------------------------

const used = new Map<string, number>();
let memDay = "";

function mem(now: number) {
  const d = todayIST(now);
  if (d !== memDay) {
    memDay = d;
    used.clear();
  }
  if (used.size > 20_000) used.clear(); // memory guard
  return used;
}

// ---- API -------------------------------------------------------------------------------------

/** Counts one question for `visitor` on `tool`; ok=false (nothing counted) once the allowance is used. */
export async function takeAiQuestion(tool: AiTool, visitor: string, now = Date.now(), limit = FREE_AI_QUESTIONS): Promise<QuotaResult> {
  const key = keyFor(tool, visitor, now);
  const r = await redis([["INCR", key], ["EXPIRE", key, TTL_S]]);
  if (r) {
    const n = Number(r[0]);
    if (n > limit) {
      await redis([["DECR", key]]);
      return { ok: false, remaining: 0, limit };
    }
    return { ok: true, remaining: limit - n, limit };
  }
  const m = mem(now);
  const n = m.get(key) ?? 0;
  if (n >= limit) return { ok: false, remaining: 0, limit };
  m.set(key, n + 1);
  return { ok: true, remaining: limit - n - 1, limit };
}

/** How many are left for `visitor` on `tool` today, without counting anything. */
export async function peekAiQuestion(tool: AiTool, visitor: string, now = Date.now(), limit = FREE_AI_QUESTIONS): Promise<number> {
  const key = keyFor(tool, visitor, now);
  const r = await redis([["GET", key]]);
  const n = r ? Number(r[0] ?? 0) : (mem(now).get(key) ?? 0);
  return Math.max(0, limit - n);
}

/** Gives a question back (e.g. the model call failed before answering). */
export async function refundAiQuestion(tool: AiTool, visitor: string, now = Date.now()) {
  const key = keyFor(tool, visitor, now);
  const r = await redis([["DECR", key]]);
  if (r) {
    if (Number(r[0]) < 0) await redis([["SET", key, 0, "EX", TTL_S]]);
    return;
  }
  const m = mem(now);
  const n = m.get(key) ?? 0;
  if (n > 0) m.set(key, n - 1);
}

export const visitorFromHeaders = (h: Headers) => h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
