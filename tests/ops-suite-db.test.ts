import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { count, eq, sql } from "drizzle-orm";

process.env.OPS_PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

const { getHandle, closeDb } = await import("@/features/demos/ops-suite/db/client");
const { seed } = await import("@/features/demos/ops-suite/db/seed");
const { generate, r2 } = await import("@/features/demos/ops-suite/db/seed/generate");
const s = await import("@/features/demos/ops-suite/db/schema");
const { portalNav, PORTAL_BASE } = await import("@/features/demos/ops-suite/nav");
const { formatINR } = await import("@/features/demos/ops-suite/lib/format");

const NOW = new Date("2026-11-24T10:30:00Z");
const data = generate({ now: NOW });

describe("ops-suite seed generator", () => {
  it("is deterministic for the same seed and clock", () => {
    const again = generate({ now: NOW });
    expect(JSON.stringify(again)).toBe(JSON.stringify(data));
    expect(JSON.stringify(generate({ now: NOW, seed: 7 }).companies)).not.toBe(JSON.stringify(data.companies));
  });

  it("produces a realistic volume", () => {
    expect(data.companies).toHaveLength(220);
    expect(data.products.length).toBeGreaterThan(120);
    expect(data.deals.length).toBeGreaterThan(300);
    expect(data.salesOrders.length).toBeGreaterThan(1000);
    expect(data.invoices.length).toBeGreaterThan(800);
    expect(data.auditLog.length).toBeGreaterThan(100);
  });

  it("never dates history in the future", () => {
    const stamps = [
      ...data.salesOrders.flatMap((o) => [o.createdAt, o.fulfilledAt]),
      ...data.payments.map((p) => p.paidAt),
      ...data.deals.map((d) => d.closedAt),
      ...data.auditLog.map((a) => a.at),
    ].filter((d): d is Date => d instanceof Date);
    for (const d of stamps) expect(d.getTime()).toBeLessThanOrEqual(NOW.getTime());
  });

  it("keeps order, invoice and payment money consistent", () => {
    const linesBySo = Map.groupBy(data.salesOrderLines, (l) => l.salesOrderId);
    for (const so of data.salesOrders) {
      const lines = linesBySo.get(so.id) ?? [];
      expect(lines.length).toBeGreaterThan(0);
      expect(r2(lines.reduce((a, l) => a + l.lineTotal, 0))).toBeCloseTo(so.subtotal, 2);
      expect(so.total).toBeCloseTo(so.subtotal + so.tax, 2);
    }
    const paysByInv = Map.groupBy(data.payments, (p) => p.invoiceId);
    for (const inv of data.invoices) {
      const so = data.salesOrders[inv.salesOrderId - 1];
      expect(so.status).toBe("fulfilled");
      expect(inv.total).toBe(so.total);
      const paid = r2((paysByInv.get(inv.id) ?? []).reduce((a, p) => a + p.amount, 0));
      expect(paid).toBeCloseTo(inv.amountPaid ?? 0, 2);
      if (inv.status === "paid") expect(paid).toBeCloseTo(inv.total, 2);
      if (inv.status === "partially_paid") expect(paid).toBeLessThan(inv.total);
      if (inv.status === "sent" || inv.status === "draft" || inv.status === "void") expect(paid).toBe(0);
    }
  });

  it("links won deals to orders and follows stage rules", () => {
    const dealIdsWithOrders = new Set(data.salesOrders.map((o) => o.dealId).filter(Boolean));
    for (const d of data.deals) {
      if (d.stage === "won") expect(dealIdsWithOrders.has(d.id)).toBe(true);
      if (d.stage === "won" || d.stage === "lost") expect(d.closedAt).toBeInstanceOf(Date);
      else expect(d.closedAt).toBeNull();
      if (d.stage === "lost") expect(d.lostReason).toBeTruthy();
    }
    const prospects = new Set(data.companies.filter((c) => c.lifecycle === "prospect").map((c) => c.id));
    expect(data.salesOrders.some((o) => prospects.has(o.companyId))).toBe(false);
  });

  it("keeps stock non-negative and uses only reserved example domains", () => {
    for (const i of data.inventory) expect(i.qtyOnHand).toBeGreaterThanOrEqual(0);
    for (const c of data.contacts) expect(c.email).toMatch(/\.example$/);
    for (const c of data.companies) if (c.website) expect(c.website).toMatch(/\.example$/);
  });
});

describe("ops-suite database", () => {
  beforeAll(async () => {
    await getHandle();
  }, 30_000);
  afterAll(closeDb);

  it("seeds every table in one transaction, idempotently", async () => {
    const { db, driver } = await getHandle();
    expect(driver).toBe("pglite");
    const quiet = console.log;
    console.log = () => {};
    try {
      await seed(db, { now: NOW });
      await seed(db, { now: NOW });
    } finally {
      console.log = quiet;
    }
    const [{ n }] = await db.select({ n: count() }).from(s.salesOrders);
    expect(n).toBe(data.salesOrders.length);
    const [{ n: lines }] = await db.select({ n: count() }).from(s.salesOrderLines);
    expect(lines).toBe(data.salesOrderLines.length);
  }, 120_000);

  it("round-trips money as numbers and continues id sequences after the seed", async () => {
    const { db } = await getHandle();
    const [inv] = await db.select().from(s.invoices).where(eq(s.invoices.id, 1));
    expect(typeof inv.total).toBe("number");
    expect(inv.total).toBe(data.invoices[0].total);
    const [c] = await db.insert(s.companies).values({ name: "Seq Test Pvt Ltd", industry: "retail", size: "micro", city: "Pune", state: "Maharashtra", region: "west" }).returning();
    expect(c.id).toBe(data.companies.length + 1);
    await db.delete(s.companies).where(eq(s.companies.id, c.id));
  });

  it("enforces invoice and stock constraints", async () => {
    const { db } = await getHandle();
    await expect(db.execute(sql`update invoices set amount_paid = total + 1 where id = 1`)).rejects.toThrow();
    await expect(db.execute(sql`update inventory set qty_on_hand = -1 where product_id = 1 and warehouse_id = 1`)).rejects.toThrow();
  });
});

describe("ops-suite helpers", () => {
  it("formats rupees the Indian way", () => {
    expect(formatINR(1240000)).toBe("₹12,40,000");
    expect(formatINR(1240000, { compact: true })).toBe("₹12.4L");
    expect(formatINR(12500000, { compact: true })).toBe("₹1.25Cr");
    expect(formatINR(45000, { compact: true })).toBe("₹45K");
  });

  it("nav hrefs are unique and under the portal base", () => {
    const hrefs = portalNav.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const h of hrefs) expect(h.startsWith(PORTAL_BASE)).toBe(true);
  });
});
