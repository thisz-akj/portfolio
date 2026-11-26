import { describe, expect, it } from "vitest";
import { refundAiQuestion, takeAiQuestion } from "@/lib/aiQuota";
import { clearPlanCache, getCachedPlan, normaliseQuestion, putCachedPlan } from "@/features/demos/ops-suite/ai/planCache";

describe("free AI questions", () => {
  it("allows 3 per visitor per tool, then refuses", () => {
    const t = Date.UTC(2026, 10, 24, 6);
    expect([1, 2, 3].map(() => takeAiQuestion("assistant", "v1", t, 3).remaining)).toEqual([2, 1, 0]);
    expect(takeAiQuestion("assistant", "v1", t, 3)).toEqual({ ok: false, remaining: 0, limit: 3 });
    // other tools and other visitors have their own allowance
    expect(takeAiQuestion("ops-ask", "v1", t, 3).ok).toBe(true);
    expect(takeAiQuestion("assistant", "v2", t, 3).ok).toBe(true);
  });

  it("gives a question back when the service failed, and resets the next day (IST)", () => {
    const t = Date.UTC(2026, 10, 24, 6);
    for (let i = 0; i < 3; i++) takeAiQuestion("assistant", "v3", t, 3);
    refundAiQuestion("assistant", "v3");
    expect(takeAiQuestion("assistant", "v3", t, 3).ok).toBe(true);
    expect(takeAiQuestion("assistant", "v3", t + 24 * 3600_000, 3).remaining).toBe(2);
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
