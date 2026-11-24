/**
 * Small in-memory sliding-window rate limiter for the public demo's write endpoints.
 * Per server instance (on serverless it limits each warm instance); the nightly reset bounds any abuse that
 * slips through. Swap for a shared store (e.g. Upstash Redis) if the demo ever needs strict global limits.
 */

const hits = new Map<string, number[]>();
let lastSweep = 0;

export interface Limit {
  max: number;
  windowMs: number;
}

export const LIMITS = {
  write: { max: 40, windowMs: 60_000 }, // edits, actions, bulk changes
  import: { max: 8, windowMs: 10 * 60_000 }, // CSV previews + imports
} satisfies Record<string, Limit>;

/** Records a hit; returns false (and records nothing) when the key is over its limit. */
export function allow(key: string, limit: Limit, now = Date.now()): boolean {
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 15 * 60_000) hits.delete(k);
  }
  const recent = (hits.get(key) ?? []).filter((t) => now - t < limit.windowMs);
  if (recent.length >= limit.max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export const resetRateLimits = () => hits.clear();
