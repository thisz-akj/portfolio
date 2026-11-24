import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, desc, eq } from "drizzle-orm";

process.env.OPS_PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

const { getHandle, closeDb } = await import("@/features/demos/ops-suite/db/client");
const { seed } = await import("@/features/demos/ops-suite/db/seed");
const s = await import("@/features/demos/ops-suite/db/schema");
const { saveRecord, bulkUpdate, convertLead } = await import("@/features/demos/ops-suite/data/mutate");
const { getDetail } = await import("@/features/demos/ops-suite/data/detail");
const { forms, validateForm } = await import("@/features/demos/ops-suite/entities/forms");

const NOW = new Date("2026-11-24T10:30:00Z");
let db: Awaited<ReturnType<typeof getHandle>>["db"];

beforeAll(async () => {
  db = (await getHandle()).db;
  const log = console.log;
  console.log = () => {};
  await seed(db, { now: NOW }).finally(() => (console.log = log));
}, 120_000);
afterAll(closeDb);

const lastAudit = async (entity: string, id: number) =>
  (await db.select().from(s.auditLog).where(and(eq(s.auditLog.entity, entity), eq(s.auditLog.entityId, String(id)))).orderBy(desc(s.auditLog.id)).limit(1))[0];

describe("form validation", () => {
  it("coerces form strings and reports field errors", () => {
    const ok = validateForm(forms.deals, { title: "Bearings rate contract", companyId: "3", stage: "proposal", value: "12.5L", expectedClose: "2026-12-31", probability: "" });
    expect(ok.ok && ok.values).toMatchObject({ companyId: 3, value: 1250000, probability: null, contactId: null });
    const bad = validateForm(forms.companies, { name: "", industry: "spaceships", gstin: "123", website: "not a url", paymentTermsDays: "4.5" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["city", "gstin", "industry", "name", "paymentTermsDays", "region", "size", "state", "lifecycle", "website"].sort());
    const lost = validateForm(forms.deals, { title: "x", companyId: 1, stage: "lost", value: 1000, expectedClose: "2026-12-01" });
    expect(!lost.ok && lost.errors.lostReason).toBeTruthy();
  });
});

describe("saving records", () => {
  it("creates a company and audits it", async () => {
    const res = await saveRecord("companies", null, { name: "Kaveri Test Industries Pvt Ltd", industry: "manufacturing", size: "small", lifecycle: "prospect", city: "Hosur", state: "Tamil Nadu", region: "south", paymentTermsDays: "30", gstin: "33abcde1234f1z5", annualRevenue: "8Cr" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [row] = await db.select().from(s.companies).where(eq(s.companies.id, res.id));
    expect(row.gstin).toBe("33ABCDE1234F1Z5");
    expect(row.annualRevenue).toBe(80_000_000);
    expect((await lastAudit("companies", res.id)).action).toBe("create");
    const dup = await saveRecord("companies", null, { name: "Dup", industry: "retail", size: "micro", lifecycle: "prospect", city: "Pune", state: "Maharashtra", region: "west", paymentTermsDays: 30, gstin: "33ABCDE1234F1Z5" });
    expect(dup.ok === false && dup.errors?.gstin).toMatch(/already/);
  });

  it("updates only changed fields into the audit diff", async () => {
    const [c] = await db.select().from(s.companies).where(eq(s.companies.id, 1));
    const res = await saveRecord("companies", 1, { ...c, paymentTermsDays: 60, annualRevenue: c.annualRevenue });
    expect(res.ok).toBe(true);
    const log = await lastAudit("companies", 1);
    expect(log.before).toEqual({ paymentTermsDays: c.paymentTermsDays });
    expect(log.after).toEqual({ paymentTermsDays: 60 });
    expect(log.summary).toMatch(/payment terms 30 → 60|payment terms \d+ → 60/);
  });

  it("applies deal rules: probability, closedAt, lost reason, contact check", async () => {
    const [open] = await db.select().from(s.deals).where(eq(s.deals.stage, "proposal")).limit(1);
    const base = { title: open.title, companyId: open.companyId, contactId: open.contactId, ownerId: open.ownerId, value: open.value, expectedClose: open.expectedClose, source: open.source };
    const toNeg = await saveRecord("deals", open.id, { ...base, stage: "negotiation", probability: "" });
    expect(toNeg.ok).toBe(true);
    let [d] = await db.select().from(s.deals).where(eq(s.deals.id, open.id));
    expect(d.probability).toBe(75);
    expect(d.closedAt).toBeNull();

    const noReason = await saveRecord("deals", open.id, { ...base, stage: "lost" });
    expect(noReason.ok === false && noReason.errors?.lostReason).toBeTruthy();

    const won = await saveRecord("deals", open.id, { ...base, stage: "won" });
    expect(won.ok).toBe(true);
    [d] = await db.select().from(s.deals).where(eq(s.deals.id, open.id));
    expect(d.probability).toBe(100);
    expect(d.closedAt).toBeInstanceOf(Date);
    expect((await lastAudit("deals", open.id)).action).toBe("deal.won");

    const reopened = await saveRecord("deals", open.id, { ...base, stage: "proposal", probability: "" });
    expect(reopened.ok).toBe(true);
    [d] = await db.select().from(s.deals).where(eq(s.deals.id, open.id));
    expect(d.closedAt).toBeNull();
    expect(d.probability).toBe(50);

    const [other] = await db.select().from(s.contacts).where(eq(s.contacts.companyId, open.companyId === 1 ? 2 : 1)).limit(1);
    const wrong = await saveRecord("deals", open.id, { ...base, stage: "proposal", contactId: other.id });
    expect(wrong.ok === false && wrong.errors?.contactId).toMatch(/different company/);
  });

  it("keeps one primary contact per company", async () => {
    const cs = await db.select().from(s.contacts).where(eq(s.contacts.companyId, 5));
    const secondary = cs.find((c) => !c.isPrimary) ?? cs[0];
    const res = await saveRecord("contacts", secondary.id, { ...secondary, isPrimary: true });
    expect(res.ok).toBe(true);
    const after = await db.select().from(s.contacts).where(and(eq(s.contacts.companyId, 5), eq(s.contacts.isPrimary, true)));
    expect(after.map((c) => c.id)).toEqual([secondary.id]);
  });
});

describe("bulk actions", () => {
  it("reassigns owners and audits each changed row", async () => {
    const res = await bulkUpdate("leads", [1, 2, 3, 3, -1, "x"], { kind: "owner", ownerId: 2 });
    expect(res.ok).toBe(true);
    const rows = await db.select().from(s.leads).where(eq(s.leads.ownerId, 2));
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining([1, 2, 3]));
  });

  it("rejects fields that are not bulk-editable", async () => {
    expect((await bulkUpdate("leads", [1], { kind: "enum", field: "score", value: "1" })).ok).toBe(false);
    expect((await bulkUpdate("leads", [1], { kind: "enum", field: "status", value: "converted" })).ok).toBe(false);
  });

  it("moves deals to lost only with a reason, atomically", async () => {
    const open = await db.select().from(s.deals).where(eq(s.deals.stage, "qualified")).limit(3);
    const ids = open.map((d) => d.id);
    expect((await bulkUpdate("deals", ids, { kind: "enum", field: "stage", value: "lost" })).ok).toBe(false);
    const still = await db.select().from(s.deals).where(eq(s.deals.id, ids[0]));
    expect(still[0].stage).toBe("qualified");
    const res = await bulkUpdate("deals", ids, { kind: "enum", field: "stage", value: "lost", lostReason: "Budget frozen" });
    expect(res.ok).toBe(true);
    const after = await db.select().from(s.deals).where(eq(s.deals.id, ids[0]));
    expect(after[0]).toMatchObject({ stage: "lost", probability: 0, lostReason: "Budget frozen" });
  });

  it("adds and removes tags idempotently", async () => {
    expect((await bulkUpdate("companies", [10, 11], { kind: "tag", tag: "export", mode: "add" })).ok).toBe(true);
    const again = await bulkUpdate("companies", [10, 11], { kind: "tag", tag: "export", mode: "add" });
    expect(again.ok && again.id).toBe(0);
    const removed = await bulkUpdate("companies", [10, 11], { kind: "tag", tag: "export", mode: "remove" });
    expect(removed.ok && removed.id).toBe(2);
    expect((await bulkUpdate("leads", [1], { kind: "tag", tag: "export", mode: "add" })).ok).toBe(false);
  });
});

describe("lead conversion", () => {
  it("creates company, primary contact and deal, and links the lead", async () => {
    const [lead] = await db.select().from(s.leads).where(eq(s.leads.status, "qualified")).limit(1);
    const res = await convertLead(lead.id, { industry: "automotive", size: "medium", createDeal: true, dealTitle: "First order", dealValue: "4L" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [l] = await db.select().from(s.leads).where(eq(s.leads.id, lead.id));
    expect(l.status).toBe("converted");
    expect(l.convertedCompanyId).toBe(res.companyId);
    const [ct] = await db.select().from(s.contacts).where(eq(s.contacts.companyId, res.companyId!));
    expect(ct.isPrimary).toBe(true);
    const [deal] = await db.select().from(s.deals).where(eq(s.deals.id, res.dealId!));
    expect(deal).toMatchObject({ value: 400000, stage: "qualified", contactId: ct.id });
    expect((await convertLead(lead.id, { industry: "automotive", size: "medium", createDeal: false })).ok).toBe(false);
  });
});

describe("detail loader", () => {
  it("returns row, related sections, timeline and form values", async () => {
    const d = await getDetail("companies", 1);
    expect(d?.title).toBeTruthy();
    expect(d?.sections.map((x) => x.key)).toEqual(["contacts", "deals", "orders", "invoices"]);
    expect(d?.timeline.some((t) => t.kind === "audit")).toBe(true);
    expect(d?.formValues).toHaveProperty("paymentTermsDays", 60);
    const deal = await getDetail("deals", 1);
    expect(deal?.sections[0].items.length).toBeGreaterThan(0);
    expect(await getDetail("deals", 999999)).toBeNull();
    expect(await getDetail("users", 1)).toBeNull();
  });
});
