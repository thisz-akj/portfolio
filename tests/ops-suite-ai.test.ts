import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.OPS_PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;
delete process.env.ANTHROPIC_API_KEY;

const { getHandle, closeDb } = await import("@/features/demos/ops-suite/db/client");
const { seed } = await import("@/features/demos/ops-suite/db/seed");
const { GOLDEN } = await import("@/features/demos/ops-suite/ai/golden");
const { validatePlan, describePlan, PLAN_JSON_SCHEMA } = await import("@/features/demos/ops-suite/ai/plan");
const { executePlan, previousRange } = await import("@/features/demos/ops-suite/ai/semantic.server");
const { planFromExpected } = await import("@/features/demos/ops-suite/ai/examples");
const { SYSTEM_PROMPT } = await import("@/features/demos/ops-suite/ai/prompt");
const { METRICS, DIMENSIONS } = await import("@/features/demos/ops-suite/ai/semantic");
const { loadDashboard } = await import("@/features/demos/ops-suite/data/dashboard");

const NOW = new Date();
beforeAll(async () => {
  const log = console.log;
  console.log = () => {};
  await seed((await getHandle()).db, { now: NOW }).finally(() => (console.log = log));
}, 120_000);
afterAll(closeDb);

describe("golden plans", () => {
  it.each(GOLDEN.map((g) => [g.id, g] as const))("%s validates and runs", async (_id, g) => {
    for (const e of [g.expected, ...(g.alternatives ?? [])]) {
      const v = validatePlan(await planFromExpected(e, g.question));
      expect(v.ok, v.ok ? "" : v.error).toBe(true);
      if (!v.ok) return;
      expect(v.value.notes).toEqual([]);
      const ans = await executePlan(v.value.plan, NOW);
      expect(ans.kind).toBe(e.kind);
      if (e.kind !== "unsupported") expect(describePlan(v.value.plan).length).toBeGreaterThan(1);
    }
  });
});

describe("validator", () => {
  const good = { kind: "metric", title: "t", explanation: "e", metric: { metric: "orders_value", groupBy: "region", filters: [{ dimension: "region", values: ["South"] }], period: "last_month", compare: "none", sort: "desc", limit: 10 }, list: null };
  it("normalises labels to values", () => {
    const v = validatePlan(good);
    expect(v.ok && v.value.plan.metric?.filters[0].values).toEqual(["south"]);
  });
  it.each([
    ["unknown metric", { ...good, metric: { ...good.metric, metric: "profit" } }],
    ["dimension not on fact", { ...good, metric: { ...good.metric, groupBy: "method" } }],
    ["unknown enum value", { ...good, metric: { ...good.metric, filters: [{ dimension: "region", values: ["mars"] }] } }],
    ["bad month", { ...good, metric: { ...good.metric, filters: [{ dimension: "month", values: ["October"] }] } }],
    ["list with no valid conditions", { kind: "list", title: "t", explanation: "e", metric: null, list: { entity: "deals", filter: '[["password","eq","x"]]', sort: null } }],
    ["unknown list", { kind: "list", title: "t", explanation: "e", metric: null, list: { entity: "users", filter: "[]", sort: null } }],
    ["not json", { kind: "list", title: "t", explanation: "e", metric: null, list: { entity: "deals", filter: "DROP TABLE", sort: null } }],
  ])("rejects %s", (_n, plan) => {
    expect(validatePlan(plan).ok).toBe(false);
  });
  it("adjusts snapshot periods and drops impossible comparisons with a note", () => {
    const v = validatePlan({ ...good, metric: { ...good.metric, metric: "outstanding", groupBy: null, filters: [], compare: "previous_period" } });
    expect(v.ok && v.value.plan.metric).toMatchObject({ period: "all_time", compare: "none" });
    expect(v.ok && v.value.notes.length).toBe(2);
  });
  it("keeps the JSON schema in sync with the catalogue", () => {
    const props = PLAN_JSON_SCHEMA.properties.metric.anyOf[1].properties;
    expect(props.metric.enum).toEqual(METRICS.map((m) => m.key));
    expect(props.groupBy.anyOf[1].enum).toEqual(DIMENSIONS.map((d) => d.key));
  });
});

describe("execution", () => {
  it("matches the dashboard's month-to-date bookings", async () => {
    const v = validatePlan({ kind: "metric", title: "t", explanation: "e", metric: { metric: "orders_value", groupBy: null, filters: [], period: "this_month", compare: "none", sort: "desc", limit: 10 }, list: null });
    const ans = await executePlan(v.ok ? v.value.plan : (null as never), NOW);
    const dash = await loadDashboard(NOW);
    expect(ans.kind === "metric" && ans.total).toBeCloseTo(dash.kpis[0].value, 0);
  });
  it("orders time series ascending and labels enum groups", async () => {
    const trend = validatePlan({ kind: "metric", title: "t", explanation: "e", metric: { metric: "orders_value", groupBy: "month", filters: [], period: "last_12_months", compare: "none", sort: "desc", limit: 10 }, list: null });
    const a = await executePlan(trend.ok ? trend.value.plan : (null as never), NOW);
    if (a.kind !== "metric") throw new Error();
    expect(a.timeSeries).toBe(true);
    expect([...a.rows.map((r) => r.key)].sort()).toEqual(a.rows.map((r) => r.key));
    const byRegion = validatePlan({ kind: "metric", title: "t", explanation: "e", metric: { metric: "orders_value", groupBy: "region", filters: [], period: "last_month", compare: "previous_period", sort: "asc", limit: 10 }, list: null });
    const b = await executePlan(byRegion.ok ? byRegion.value.plan : (null as never), NOW);
    if (b.kind !== "metric") throw new Error();
    expect(b.rows.some((r) => r.label === "South")).toBe(true);
    expect(b.rows.every((r) => r.previous !== undefined)).toBe(true);
    const changes = b.rows.map((r) => r.change ?? Infinity);
    expect([...changes].sort((x, y) => x - y)).toEqual(changes); // comparisons rank by change
  });
  it("is read-only even if a fragment tried to write", async () => {
    const { getDb } = await import("@/features/demos/ops-suite/db/client");
    const { sql } = await import("drizzle-orm");
    const db = await getDb();
    await expect(db.transaction(async (tx) => {
      await tx.execute(sql`set transaction read only`);
      await tx.execute(sql`delete from companies`);
    })).rejects.toThrow();
  });
});

describe("periods and prompt", () => {
  it("compares in-progress periods with the same number of days", () => {
    const now = new Date("2026-11-24T06:00:00Z");
    expect(previousRange("this_month", now)).toEqual({ range: { from: "2026-10-01", to: "2026-10-25" }, label: "same 24 days of the previous period" });
    expect(previousRange("last_month", now)?.range).toEqual({ from: "2026-09-01", to: "2026-10-01" });
    expect(previousRange("this_fy", now)?.range.from).toBe("2025-04-01");
    expect(previousRange("last_30_days", now)?.range).toEqual({ from: "2026-09-26", to: "2026-10-26" });
    expect(previousRange("all_time", now)).toBeNull();
  });
  it("builds a deterministic, catalogue-complete prompt", async () => {
    const again = (await import("@/features/demos/ops-suite/ai/prompt")).SYSTEM_PROMPT;
    expect(again).toBe(SYSTEM_PROMPT);
    for (const m of METRICS) expect(SYSTEM_PROMPT).toContain(m.key);
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no dates: keeps the cache prefix stable
  });
  it("asks politely when AI is off", async () => {
    const { askAction } = await import("@/features/demos/ops-suite/ai/actions");
    const r = await askAction("What were orders last month?");
    expect(r.ok === false && r.reason).toBe("no_key");
  });
});

describe("comparisons rank by change", () => {
  it("puts the biggest drop first when sorting ascending", async () => {
    const v = validatePlan({ kind: "metric", title: "t", explanation: "e", metric: { metric: "orders_value", groupBy: "region", filters: [], period: "last_month", compare: "previous_period", sort: "asc", limit: 3 }, list: null });
    const a = await executePlan(v.ok ? v.value.plan : (null as never), NOW);
    if (a.kind !== "metric") throw new Error();
    expect(a.rows.length).toBeLessThanOrEqual(3);
    const changes = a.rows.map((r) => r.change ?? Infinity);
    expect([...changes].sort((x, y) => x - y)).toEqual(changes);
  });
});
