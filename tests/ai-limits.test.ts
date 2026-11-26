import { describe, expect, it, vi } from "vitest";
import { peekAiQuestion, refundAiQuestion, takeAiQuestion } from "@/lib/aiQuota";
import { clearPlanCache, getCachedPlan, normaliseQuestion, putCachedPlan } from "@/features/demos/ops-suite/ai/planCache";

describe("free AI questions", () => {
  it("allows 3 per visitor per tool, then refuses", async () => {
    const t = Date.UTC(2026, 10, 24, 6);
    const left = [];
    for (let i = 0; i < 3; i++) left.push((await takeAiQuestion("assistant", "v1", t, 3)).remaining);
    expect(left).toEqual([2, 1, 0]);
    expect(await takeAiQuestion("assistant", "v1", t, 3)).toEqual({ ok: false, remaining: 0, limit: 3 });
    // other tools and other visitors have their own allowance
    expect((await takeAiQuestion("ops-ask", "v1", t, 3)).ok).toBe(true);
    expect((await takeAiQuestion("assistant", "v2", t, 3)).ok).toBe(true);
  });

  it("gives a question back when the service failed, and resets the next day (IST)", async () => {
    const t = Date.UTC(2026, 10, 24, 6);
    for (let i = 0; i < 3; i++) await takeAiQuestion("assistant", "v3", t, 3);
    await refundAiQuestion("assistant", "v3", t);
    expect((await takeAiQuestion("assistant", "v3", t, 3)).ok).toBe(true);
    expect((await takeAiQuestion("assistant", "v3", t + 24 * 3600_000, 3)).remaining).toBe(2);
  });

  it("uses the shared Redis store when configured (counts hold across instances)", async () => {
    const store = new Map<string, number>();
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      const out = (JSON.parse(init.body) as (string | number)[][]).map(([cmd, key, val]) => {
        const k = String(key);
        if (cmd === "INCR") store.set(k, (store.get(k) ?? 0) + 1);
        else if (cmd === "DECR") store.set(k, (store.get(k) ?? 0) - 1);
        else if (cmd === "SET") store.set(k, Number(val));
        else if (cmd === "GET") return { result: store.has(k) ? String(store.get(k)) : null };
        else return { result: 1 };
        return { result: store.get(k) };
      });
      return new Response(JSON.stringify(out));
    });
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    vi.stubGlobal("fetch", fetchMock);
    try {
      const t = Date.UTC(2026, 10, 25, 6);
      expect((await takeAiQuestion("assistant", "r1", t, 2)).remaining).toBe(1);
      expect((await takeAiQuestion("assistant", "r1", t, 2)).remaining).toBe(0);
      expect((await takeAiQuestion("assistant", "r1", t, 2)).ok).toBe(false);
      expect(await peekAiQuestion("assistant", "r1", t, 2)).toBe(0);
      await refundAiQuestion("assistant", "r1", t);
      expect(await peekAiQuestion("assistant", "r1", t, 2)).toBe(1);
      expect(store.get("aiq:2026-11-25:assistant:r1")).toBe(1);
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });
});

describe("Ask Ops Suite plan cache", () => {
  const ctx = { today: "2026-11-24", persona: "Demo Admin (Admin)", version: "v1" };

  it("reuses a plan for the same question, ignoring case and punctuation", () => {
    clearPlanCache();
    putCachedPlan("Top 5 customers this FY?", ctx, { title: "x" });
    expect(normaliseQuestion("  Top 5 customers, this FY ")).toBe("top 5 customers this fy");
    expect(getCachedPlan("top 5 customers this fy", ctx)).toEqual({ title: "x" });
  });

  it("misses on another day, persona or prompt version, and expires after 24 h", () => {
    clearPlanCache();
    const now = Date.now();
    putCachedPlan("q", ctx, 1, now);
    expect(getCachedPlan("q", { ...ctx, today: "2026-11-25" }, now)).toBeNull();
    expect(getCachedPlan("q", { ...ctx, persona: "Sales" }, now)).toBeNull();
    expect(getCachedPlan("q", { ...ctx, version: "v2" }, now)).toBeNull();
    expect(getCachedPlan("q", ctx, now + 25 * 3600_000)).toBeNull();
  });
});
