/**
 * Claude list prices, USD per million tokens (Anthropic API, as of Nov 2026). Used to cost traces and eval runs;
 * the Python harness reads the same table from contract.json. Cache writes are 1.25× input (5-minute TTL).
 */
export const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

export function costUsd(model: string, u: { input: number; output: number; cacheRead?: number; cacheWrite?: number }): number {
  const p = PRICING[model] ?? PRICING["claude-opus-5-5"];
  return (u.input * p.input + u.output * p.output + (u.cacheRead ?? 0) * p.cacheRead + (u.cacheWrite ?? 0) * p.cacheWrite) / 1_000_000;
}

export const DEFAULT_MODEL = "claude-opus-5-5";
export const DEFAULT_EFFORT = "low";
