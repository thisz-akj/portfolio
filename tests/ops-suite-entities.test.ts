import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.OPS_PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

const { getHandle, closeDb } = await import("@/features/demos/ops-suite/db/client");
const { seed } = await import("@/features/demos/ops-suite/db/seed");
const { generate } = await import("@/features/demos/ops-suite/db/seed/generate");
const { listEntity } = await import("@/features/demos/ops-suite/data/list");
const { getEntityServer } = await import("@/features/demos/ops-suite/entities/server");
const { entityMetas } = await import("@/features/demos/ops-suite/entities");
const { defaultQuery } = await import("@/features/demos/ops-suite/filters/types");
const { validateCondition } = await import("@/features/demos/ops-suite/filters/parse");

const NOW = new Date("2026-11-24T10:30:00Z");
const data = generate({ now: NOW });
const all = (key: string) => entityMetas[key].fields.map((f) => f.key);

beforeAll(async () => {
  const { db } = await getHandle();
  const log = console.log;
  console.log = () => {};
  await seed(db, { now: NOW }).finally(() => (console.log = log));
}, 120_000);
afterAll(closeDb);

describe.each(Object.keys(entityMetas))("%s entity", (key) => {
  const ent = getEntityServer(key)!;
  const meta = entityMetas[key];

  it("declares SQL for every field and valid saved views", () => {
    for (const f of meta.fields) expect(ent.fields[f.key], f.key).toBeDefined();
    for (const v of meta.views) {
      for (const c of v.query.filter?.conditions ?? []) {
        if (!("conditions" in c)) expect(validateCondition(meta, c), `${v.id}: ${c.field}`).not.toBeNull();
      }
    }
  });

  it("sorts by every sortable column (all columns selected)", async () => {
    for (const f of meta.fields.filter((x) => x.sortable !== false)) {
      for (const dir of ["asc", "desc"] as const) {
        const res = await listEntity(ent, { ...defaultQuery(meta), cols: all(key), sort: [{ field: f.key, dir }] }, NOW);
        expect(res.rows.length, `${f.key} ${dir}`).toBeGreaterThan(0);
      }
    }
  });

  it("runs every saved view", async () => {
    for (const v of meta.views) {
      const res = await listEntity(ent, { ...defaultQuery(meta), ...v.query }, NOW);
      expect(res.total, v.id).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("computed fields are per row", () => {
  const page = async (key: string, extra = {}) =>
    (await listEntity(getEntityServer(key)!, { ...defaultQuery(entityMetas[key]), cols: all(key), pageSize: 100, sort: [{ field: "createdAt", dir: "asc" }], ...extra }, NOW)).rows;

  it("contacts: company name and open deals", async () => {
    for (const r of await page("contacts")) {
      const c = data.contacts[r.id - 1];
      expect(r.companyName).toBe(data.companies[c.companyId - 1].name);
      expect(r.openDeals).toBe(data.deals.filter((d) => d.contactId === r.id && d.stage !== "won" && d.stage !== "lost").length);
    }
  });

  it("deals: weighted value, slipped flag, contact name", async () => {
    for (const r of await page("deals")) {
      const d = data.deals[r.id - 1];
      expect(r.weighted).toBeCloseTo((d.value * d.probability) / 100, 1);
      const open = d.stage !== "won" && d.stage !== "lost";
      expect(r.slipped).toBe(open && d.expectedClose < "2026-11-24");
      const ct = data.contacts[d.contactId! - 1];
      expect(r.contactName).toBe(`${ct.firstName} ${ct.lastName}`);
    }
  });

  it("relative date operators", async () => {
    const ent = getEntityServer("companies")!;
    const q = (op: "older_than" | "within_last") => listEntity(ent, { ...defaultQuery(entityMetas.companies), filter: { combinator: "and", conditions: [{ field: "createdAt", op, value: 30 }] } }, NOW);
    const [older, within] = await Promise.all([q("older_than"), q("within_last")]);
    expect(older.total + within.total).toBe(220);
  });
});

describe("deals board", () => {
  it("groups every deal into a stage column with totals", async () => {
    const { loadBoard, BOARD_CARD_LIMIT } = await import("@/features/demos/ops-suite/data/board");
    const ent = getEntityServer("deals")!;
    const { columns } = await loadBoard(ent, defaultQuery(entityMetas.deals), NOW);
    expect(columns.map((c) => c.value)).toEqual(["new", "qualified", "proposal", "negotiation", "won", "lost"]);
    expect(columns.reduce((a, c) => a + c.count, 0)).toBe(data.deals.length);
    for (const c of columns) {
      expect(c.cards.length).toBe(Math.min(c.count, BOARD_CARD_LIMIT));
      const expected = data.deals.filter((d) => d.stage === c.value).reduce((a, d) => a + d.value, 0);
      expect(c.sum).toBeCloseTo(expected, 0);
    }
  });
});
