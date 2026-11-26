import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.OPS_PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

const { getHandle, closeDb } = await import("@/features/demos/ops-suite/db/client");
const { seed } = await import("@/features/demos/ops-suite/db/seed");
const { generate } = await import("@/features/demos/ops-suite/db/seed/generate");
const { listEntity, exportRows } = await import("@/features/demos/ops-suite/data/list");
const { companiesServer: ent } = await import("@/features/demos/ops-suite/entities/companies.server");
const { companiesMeta: meta } = await import("@/features/demos/ops-suite/entities/companies");
const { parseListQuery, serializeListQuery, parseFilter, serializeFilter, validateCondition } = await import("@/features/demos/ops-suite/filters/parse");
const { presetRange } = await import("@/features/demos/ops-suite/filters/dates");
const { escapeLike } = await import("@/features/demos/ops-suite/filters/toSql");
const { defaultQuery } = await import("@/features/demos/ops-suite/filters/types");
type Group = import("@/features/demos/ops-suite/filters/types").Group;

const NOW = new Date("2026-11-24T10:30:00Z");
const data = generate({ now: NOW });
const q = (filter: Group, extra: Partial<ReturnType<typeof defaultQuery>> = {}) => ({ ...defaultQuery(meta), filter, pageSize: 100, ...extra });
const and = (...conditions: Group["conditions"]): Group => ({ combinator: "and", conditions });

describe("filter parsing", () => {
  it("round-trips a query through the URL", () => {
    const query = q(and({ field: "lifecycle", op: "in", value: ["customer"] }, { combinator: "or", conditions: [{ field: "revenue12m", op: "gte", value: 5e6 }, { field: "tags", op: "has_any", value: ["key-account"] }] }), { q: "steel", page: 3, pageSize: 50, sort: [{ field: "name", dir: "asc" }], cols: ["name", "owner"] });
    const back = parseListQuery(meta, serializeListQuery(meta, query));
    expect(back).toEqual(query);
  });

  it("drops invalid conditions instead of failing", () => {
    const f = parseFilter(meta, JSON.stringify([["lifecycle", "in", ["customer", "hacker"]], ["nope", "eq", "x"], ["name", "gt", 3], ["name", "contains", "Iyer"], ["revenue12m", "between", [10, 5]]]));
    expect(f.conditions).toEqual([{ field: "name", op: "contains", value: "Iyer" }]);
    expect(parseFilter(meta, "{not json").conditions).toEqual([]);
    expect(parseListQuery(meta, { page: "-4", size: "999", sort: "-password;drop" }).page).toBe(1);
  });

  it("limits condition count and nesting depth", () => {
    const many = JSON.stringify(Array.from({ length: 50 }, () => ["name", "contains", "a"]));
    expect(parseFilter(meta, many).conditions.length).toBe(20);
    const deep = JSON.stringify([{ or: [{ and: [{ or: [["name", "contains", "a"]] }] }] }]);
    expect(serializeFilter(parseFilter(meta, deep)) ?? "").not.toContain('"or":[{"and":[{"or"');
  });

  it("validates values per type", () => {
    expect(validateCondition(meta, { field: "createdAt", op: "preset", value: "this_fy" })).toBeTruthy();
    expect(validateCondition(meta, { field: "createdAt", op: "preset", value: "forever" })).toBeNull();
    expect(validateCondition(meta, { field: "owner", op: "in", value: [1, 2] })).toBeTruthy();
    expect(validateCondition(meta, { field: "owner", op: "in", value: ["1 or 1=1"] })).toBeNull();
    expect(validateCondition(meta, { field: "name", op: "is_empty" })).toEqual({ field: "name", op: "is_empty" });
  });

  it("escapes LIKE wildcards", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });

  it("resolves IST + Indian financial-year date presets", () => {
    const late = new Date("2026-11-23T20:00:00Z"); // already 24 Nov in IST
    expect(presetRange("today", late)).toEqual({ from: "2026-11-24", to: "2026-11-25" });
    expect(presetRange("this_fy", NOW)).toEqual({ from: "2026-04-01", to: "2027-04-01" });
    expect(presetRange("this_quarter", NOW)).toEqual({ from: "2026-10-01", to: "2027-01-01" });
    expect(presetRange("last_quarter", NOW)).toEqual({ from: "2026-07-01", to: "2026-10-01" });
    expect(presetRange("this_quarter", new Date("2026-02-10T06:00:00Z"))).toEqual({ from: "2026-01-01", to: "2026-04-01" });
    expect(presetRange("last_month", new Date("2026-01-15T06:00:00Z"))).toEqual({ from: "2025-12-01", to: "2026-01-01" });
  });
});

describe("filter SQL against seeded data", () => {
  beforeAll(async () => {
    const { db } = await getHandle();
    const log = console.log;
    console.log = () => {};
    await seed(db, { now: NOW }).finally(() => (console.log = log));
  }, 120_000);
  afterAll(closeDb);

  const count = async (filter: Group, extra = {}) => (await listEntity(ent, q(filter, extra), NOW)).total;

  it("filters enums, relations and text", async () => {
    const customers = data.companies.filter((c) => c.lifecycle === "customer").length;
    expect(await count(and({ field: "lifecycle", op: "in", value: ["customer"] }))).toBe(customers);
    expect(await count(and({ field: "lifecycle", op: "not_in", value: ["customer"] }))).toBe(220 - customers);
    const owner = data.companies[0].ownerId!;
    expect(await count(and({ field: "owner", op: "in", value: [owner] }))).toBe(data.companies.filter((c) => c.ownerId === owner).length);
    const name = data.companies[5].name;
    expect(await count(and({ field: "name", op: "eq", value: name.toUpperCase() }))).toBe(1);
    expect(await count(and({ field: "name", op: "contains", value: "%" }))).toBe(0);
    const noGst = data.companies.filter((c) => !c.gstin).length;
    expect(await count(and({ field: "gstin", op: "is_empty" }))).toBe(noGst);
  });

  it("supports OR groups and nested groups", async () => {
    const south = data.companies.filter((c) => c.region === "south").length;
    const churned = data.companies.filter((c) => c.lifecycle === "churned").length;
    const both = data.companies.filter((c) => c.region === "south" && c.lifecycle === "churned").length;
    const or: Group = { combinator: "or", conditions: [{ field: "region", op: "in", value: ["south"] }, { field: "lifecycle", op: "in", value: ["churned"] }] };
    expect(await count(or)).toBe(south + churned - both);
    expect(await count(and(or, { field: "lifecycle", op: "in", value: ["churned"] }))).toBe(churned);
  });

  it("filters and sorts on computed aggregates", async () => {
    const res = await listEntity(ent, q(and({ field: "outstanding", op: "gt", value: 0 }), { sort: [{ field: "outstanding", dir: "desc" }] }), NOW);
    expect(res.total).toBeGreaterThan(0);
    const vals = res.rows.map((r) => r.outstanding as number);
    expect([...vals].sort((a, b) => b - a)).toEqual(vals);
    expect(vals.every((v) => typeof v === "number" && v > 0)).toBe(true);
    const lastOrders = res.rows.map((r) => r.lastOrder).filter(Boolean);
    expect(lastOrders.every((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d as string))).toBe(true);
  });

  it("filters tags with any / all / none", async () => {
    const tagged = (name: string) => new Set(data.entityTags.filter((t) => t.entity === "companies" && t.tagId === data.tags.find((x) => x.name === name)!.id).map((t) => t.entityId));
    const key = tagged("key-account");
    const msme = tagged("msme");
    expect(await count(and({ field: "tags", op: "has_any", value: ["key-account"] }))).toBe(key.size);
    expect(await count(and({ field: "tags", op: "has_none", value: ["key-account"] }))).toBe(220 - key.size);
    const anyOf = new Set([...key, ...msme]).size;
    expect(await count(and({ field: "tags", op: "has_any", value: ["key-account", "msme"] }))).toBe(anyOf);
    const allOf = [...key].filter((id) => msme.has(id)).length;
    expect(await count(and({ field: "tags", op: "has_all", value: ["key-account", "msme"] }))).toBe(allOf);
  });

  it("filters dates with presets in IST", async () => {
    const res = await count(and({ field: "createdAt", op: "preset", value: "last_90_days" }));
    const cutoff = new Date("2026-08-27T00:00:00+05:30").getTime();
    expect(res).toBe(data.companies.filter((c) => c.createdAt!.getTime() >= cutoff).length);
  });

  it("searches across fields word by word", async () => {
    const c = data.companies[10];
    const res = await listEntity(ent, q(and(), { q: `${c.name.split(" ")[0]} ${c.city}` }), NOW);
    expect(res.rows.some((r) => r.id === c.id)).toBe(true);
  });

  it("paginates stably, clamps the page and reports facets", async () => {
    const p1 = await listEntity(ent, q(and(), { pageSize: 25, page: 1, sort: [{ field: "industry", dir: "asc" }] }), NOW);
    const p2 = await listEntity(ent, q(and(), { pageSize: 25, page: 2, sort: [{ field: "industry", dir: "asc" }] }), NOW);
    expect(new Set([...p1.rows, ...p2.rows].map((r) => r.id)).size).toBe(50);
    const far = await listEntity(ent, q(and(), { pageSize: 25, page: 999 }), NOW);
    expect(far.page).toBe(9);
    // facets ignore the field's own filter, so the user sees counts for other options
    const filtered = await listEntity(ent, q(and({ field: "lifecycle", op: "in", value: ["customer"] })), NOW);
    expect(Object.values(filtered.facets.lifecycle).reduce((a, b) => a + b, 0)).toBe(220);
    expect(Object.keys(filtered.options.owner).length).toBeGreaterThan(0);
    expect(p1.rows[0].ownerName).toBeTypeOf("string");
  });

  it("exports selected ids only", async () => {
    const { rows } = await exportRows(ent, q(and()), [3, 1, 2], NOW);
    expect(rows.map((r) => r.id).sort()).toEqual([1, 2, 3]);
  });
});

describe("computed columns match the source data", () => {
  beforeAll(async () => {
    const { db } = await getHandle();
    const log = console.log;
    console.log = () => {};
    await seed(db, { now: NOW }).finally(() => (console.log = log));
  }, 120_000);

  it("revenue, outstanding and open deals are per company", async () => {
    const res = await listEntity(ent, q(and(), { pageSize: 100, sort: [{ field: "name", dir: "asc" }] }), NOW);
    for (const r of res.rows.slice(0, 40)) {
      const out = data.invoices.filter((i) => i.companyId === r.id && (i.status === "sent" || i.status === "partially_paid")).reduce((a, i) => a + i.total - (i.amountPaid ?? 0), 0);
      expect(r.outstanding).toBeCloseTo(out, 1);
      const open = data.deals.filter((d) => d.companyId === r.id && d.stage !== "won" && d.stage !== "lost").length;
      expect(r.openDeals).toBe(open);
      const ownTags = data.entityTags.filter((t) => t.entity === "companies" && t.entityId === r.id).map((t) => data.tags[t.tagId - 1].name).sort();
      expect(r.tags).toEqual(ownTags);
    }
  });
});

describe("ui helpers", async () => {
  const { parseAmount, formatDate } = await import("@/features/demos/ops-suite/lib/format");
  const { describeCondition } = await import("@/features/demos/ops-suite/filters/describe");
  const { toCsv } = await import("@/features/demos/ops-suite/lib/csv");

  it("parses Indian amount shorthands", () => {
    expect(parseAmount("12,40,000")).toBe(1240000);
    expect(parseAmount("12.4L")).toBe(1240000);
    expect(parseAmount("₹1.25 Cr")).toBe(12500000);
    expect(parseAmount("45k")).toBe(45000);
    expect(parseAmount("5 lakh")).toBe(500000);
    expect(parseAmount("abc")).toBeNull();
  });

  it("formats calendar dates without timezone drift", () => {
    expect(formatDate("2026-04-01")).toBe("1 Apr 2026");
    expect(formatDate(new Date("2026-03-31T20:00:00Z"))).toBe("1 Apr 2026"); // IST
  });

  it("describes chips in plain words", () => {
    expect(describeCondition(meta, { field: "lifecycle", op: "in", value: ["customer", "churned"] })).toEqual({ field: "Lifecycle", op: "is any of", value: "Customer, Churned" });
    expect(describeCondition(meta, { field: "outstanding", op: "gt", value: 1_000_000 }).value).toBe("₹10L");
    expect(describeCondition(meta, { field: "createdAt", op: "preset", value: "this_fy" }).value).toBe("this financial year");
    expect(describeCondition(meta, { field: "owner", op: "in", value: [2] }, { owner: [{ value: "2", label: "Riya Mehta" }] }).value).toBe("Riya Mehta");
  });

  it("writes safe CSV", () => {
    const csv = toCsv(["Name", "Amount"], [["=HYPERLINK(\"x\")", 1200.5], ['Shah "& Co."', null]]);
    expect(csv.startsWith("﻿Name,Amount\r\n")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")",1200.5`);
    expect(csv).toContain(`"Shah ""& Co.""",`);
    expect(toCsv(["n"], [["-4"], ["+91 98765 43210"], ["-SUM(A1)"]])).toBe("\uFEFFn\r\n-4\r\n+91 98765 43210\r\n'-SUM(A1)\r\n");
  });
});
