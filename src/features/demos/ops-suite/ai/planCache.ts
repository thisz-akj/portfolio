/**
 * Plan cache for "Ask Ops Suite": the same question (same day, same persona, same prompt version)
 * reuses the plan the model already produced — zero tokens. The plan is still validated and run
 * against live data, so answers stay current. In-memory, per server instance. Server-only.
 */

const TTL_MS = 24 * 3600_000;
const MAX_ITEMS = 500;
const cache = new Map<string, { json: unknown; at: number }>();

export const normaliseQuestion = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s₹]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const key = (question: string, ctx: { today: string; persona: string; version: string }) =>
  `${ctx.version}|${ctx.today}|${ctx.persona}|${normaliseQuestion(question)}`;

export function getCachedPlan(question: string, ctx: { today: string; persona: string; version: string }, now = Date.now()): unknown | null {
  const k = key(question, ctx);
  const hit = cache.get(k);
  if (!hit) return null;
  if (now - hit.at > TTL_MS) {
    cache.delete(k);
    return null;
  }
  cache.delete(k); // refresh LRU order
  cache.set(k, hit);
  return hit.json;
}

export function putCachedPlan(question: string, ctx: { today: string; persona: string; version: string }, json: unknown, now = Date.now()) {
  cache.set(key(question, ctx), { json, at: now });
  while (cache.size > MAX_ITEMS) cache.delete(cache.keys().next().value as string);
}

export const clearPlanCache = () => cache.clear();
