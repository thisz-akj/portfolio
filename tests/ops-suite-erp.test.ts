import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";

process.env.OPS_PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

const { getHandle, closeDb } = await import("@/features/demos/ops-suite/db/client");
const { seed } = await import("@/features/demos/ops-suite/db/seed");
const s = await import("@/features/demos/ops-suite/db/schema");
const { saveRecord, bulkUpdate } = await import("@/features/demos/ops-suite/data/mutate");
const flows = await import("@/features/demos/ops-suite/data/erp");
const { getDetail } = await import("@/features/demos/ops-suite/data/detail");
const { listEntity } = await import("@/features/demos/ops-suite/data/list");
const { getEntityServer } = await import("@/features/demos/ops-suite/entities/server");
const { defaultQuery } = await import("@/features/demos/ops-suite/filters/types");
const { todayIST, addDaysISO } = await import("@/features/demos/ops-suite/filters/dates");

let db: Awaited<ReturnType<typeof getHandle>>["db"];
const NOW = new Date("2026-11-24T10:30:00Z");

beforeAll(async () => {
  db = (await getHandle()).db;
  const log = console.log;
  console.log = () => {};
  await seed(db, { now: NOW }).finally(() => (console.log = log));
}, 120_000);
afterAll(closeDb);

const run = <T,>(fn: Parameters<typeof flows.runFlow<T>>[0]) => flows.runFlow(fn);
const stockOf = async (productId: number, warehouseId: number) => (await db.select().from(s.inventory).where(and(eq(s.inventory.productId, productId), eq(s.inventory.warehouseId, warehouseId))))[0];

describe("order-to-cash flow", () => {
  let soId = 0;
  let companyId = 0;

  it("winning a deal of a prospect creates one draft order with suggested lines", async () => {
    const [prospect] = await db.select().from(s.companies).where(eq(s.companies.lifecycle, "prospect")).limit(1);
    companyId = prospect.id;
    const created = await saveRecord("deals", null, { title: "Flow test deal", companyId, stage: "negotiation", value: "6L", expectedClose: addDaysISO(todayIST(), 10) });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const won = await bulkUpdate("deals", [created.id], { kind: "enum", field: "stage", value: "won" });
    expect(won.ok).toBe(true);
    const sos = await db.select().from(s.salesOrders).where(eq(s.salesOrders.dealId, created.id));
    expect(sos).toHaveLength(1);
    soId = sos[0].id;
    expect(sos[0]).toMatchObject({ status: "draft", companyId });
    expect(sos[0].number).toMatch(/^SO-\d{6}$/);
    const lines = await db.select().from(s.salesOrderLines).where(eq(s.salesOrderLines.salesOrderId, soId));
    expect(lines.length).toBeGreaterThan(0);
    expect(sos[0].total).toBeGreaterThan(400_000);
    // re-winning doesn't duplicate
    await bulkUpdate("deals", [created.id], { kind: "enum", field: "stage", value: "negotiation" });
    await bulkUpdate("deals", [created.id], { kind: "enum", field: "stage", value: "won" });
    expect(await db.select().from(s.salesOrders).where(eq(s.salesOrders.dealId, created.id))).toHaveLength(1);
  });

  it("edits draft lines and keeps totals in sync", async () => {
    const [p] = await db.select().from(s.products).where(eq(s.products.active, true)).limit(1);
    expect((await run((tx, a) => flows.editLines(tx, "so", soId, { op: "add", productId: p.id, qty: 3, discountPct: 5 }, a))).ok).toBe(true);
    const lines = await db.select().from(s.salesOrderLines).where(eq(s.salesOrderLines.salesOrderId, soId));
    const [so] = await db.select().from(s.salesOrders).where(eq(s.salesOrders.id, soId));
    const sub = Math.round(lines.reduce((a, l) => a + l.lineTotal, 0) * 100) / 100;
    expect(so.subtotal).toBeCloseTo(sub, 2);
    expect((await run((tx, a) => flows.editLines(tx, "so", soId, { op: "add", productId: p.id, qty: 0 }, a))).ok).toBe(false);
  });

  it("confirm reserves stock; fulfil is blocked when short, then succeeds after a stock count", async () => {
    const [so] = await db.select().from(s.salesOrders).where(eq(s.salesOrders.id, soId));
    const lines = await db.select().from(s.salesOrderLines).where(eq(s.salesOrderLines.salesOrderId, soId));
    const before = await Promise.all(lines.map((l) => stockOf(l.productId, so.warehouseId)));
    expect((await run((tx, a) => flows.confirmSalesOrder(tx, soId, a))).ok).toBe(true);
    const reserved = await Promise.all(lines.map((l) => stockOf(l.productId, so.warehouseId)));
    lines.forEach((l, i) => expect(reserved[i].qtyReserved).toBe((before[i]?.qtyReserved ?? 0) + l.qty));

    // make the first line short, fulfil must fail and change nothing
    await db.update(s.inventory).set({ qtyOnHand: 0 }).where(eq(s.inventory.id, reserved[0].id));
    const short = await run((tx, a) => flows.fulfilSalesOrder(tx, soId, a));
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.message).toMatch(/Not enough stock/);
    expect((await db.select().from(s.salesOrders).where(eq(s.salesOrders.id, soId)))[0].status).toBe("confirmed");

    // stock count brings everything up, then fulfil
    for (const [i, l] of lines.entries()) {
      const want = l.qty + 2;
      const current = i === 0 ? 0 : reserved[i].qtyOnHand;
      if (current !== want) expect((await run((tx, a) => flows.adjustStock(tx, reserved[i].id, want, "Cycle count", a))).ok).toBe(true);
    }
    const ok = await run((tx, a) => flows.fulfilSalesOrder(tx, soId, a));
    expect(ok.ok).toBe(true);
    const after = await Promise.all(lines.map((l) => stockOf(l.productId, so.warehouseId)));
    after.forEach((st, i) => {
      expect(st.qtyOnHand).toBe(2);
      expect(st.qtyReserved).toBe(reserved[i].qtyReserved - lines[i].qty);
    });

    const [inv] = await db.select().from(s.invoices).where(eq(s.invoices.salesOrderId, soId));
    const [co] = await db.select().from(s.companies).where(eq(s.companies.id, companyId));
    const [so2] = await db.select().from(s.salesOrders).where(eq(s.salesOrders.id, soId));
    expect(inv).toMatchObject({ status: "sent", total: so2.total, amountPaid: 0, issueDate: todayIST(), dueDate: addDaysISO(todayIST(), co.paymentTermsDays) });
    expect(co.lifecycle).toBe("customer");

    // 2 left on hand is below every reorder level ≥ 5 → open POs now cover the reorder level for the first product
    const open = await db
      .select({ qty: s.purchaseOrderLines.qty, rcv: s.purchaseOrderLines.qtyReceived })
      .from(s.purchaseOrderLines)
      .innerJoin(s.purchaseOrders, eq(s.purchaseOrders.id, s.purchaseOrderLines.purchaseOrderId))
      .where(and(eq(s.purchaseOrderLines.productId, lines[0].productId), eq(s.purchaseOrders.warehouseId, so.warehouseId), inArray(s.purchaseOrders.status, ["draft", "sent", "partially_received"])));
    const onOrder = open.reduce((a, l) => a + l.qty - l.rcv, 0);
    expect(after[0].qtyOnHand - after[0].qtyReserved + onOrder).toBeGreaterThanOrEqual(after[0].reorderLevel);
    const audits = await db.select().from(s.auditLog).where(eq(s.auditLog.action, "purchase_order.auto_created"));
    const updates = await db.select().from(s.auditLog).where(eq(s.auditLog.action, "purchase_order.auto_updated"));
    expect(audits.length + updates.length).toBeGreaterThan(0);
  });

  it("payments settle the invoice and reject overpayment", async () => {
    const [inv] = await db.select().from(s.invoices).where(eq(s.invoices.salesOrderId, soId));
    const over = await run((tx, a) => flows.recordPayment(tx, inv.id, { amount: inv.total + 1, method: "neft", reference: "", paidOn: todayIST() }, a));
    expect(over.ok).toBe(false);
    const half = Math.round(inv.total * 50) / 100;
    expect((await run((tx, a) => flows.recordPayment(tx, inv.id, { amount: half, method: "upi", reference: "UPI/1", paidOn: todayIST() }, a))).ok).toBe(true);
    let [now] = await db.select().from(s.invoices).where(eq(s.invoices.id, inv.id));
    expect(now.status).toBe("partially_paid");
    const rest = Math.round((inv.total - half) * 100) / 100;
    expect((await run((tx, a) => flows.recordPayment(tx, inv.id, { amount: rest, method: "rtgs", reference: "UTR1", paidOn: todayIST() }, a))).ok).toBe(true);
    [now] = await db.select().from(s.invoices).where(eq(s.invoices.id, inv.id));
    expect(now).toMatchObject({ status: "paid", amountPaid: inv.total });
    expect((await run((tx, a) => flows.recordPayment(tx, inv.id, { amount: 1, method: "neft", reference: "", paidOn: todayIST() }, a))).ok).toBe(false);
  });
});

describe("procure-to-stock flow", () => {
  it("send → partial receive → full receive moves stock in", async () => {
    const [draft] = await db.select().from(s.purchaseOrders).where(eq(s.purchaseOrders.status, "draft")).limit(1);
    const lines = await db.select().from(s.purchaseOrderLines).where(eq(s.purchaseOrderLines.purchaseOrderId, draft.id));
    expect((await run((tx, a) => flows.receivePurchaseOrder(tx, draft.id, [], a))).ok).toBe(false); // must be sent first
    expect((await run((tx, a) => flows.sendPurchaseOrder(tx, draft.id, a))).ok).toBe(true);
    const l0 = lines[0];
    const before = await stockOf(l0.productId, draft.warehouseId);
    const half = Math.max(1, Math.floor(l0.qty / 2));
    expect((await run((tx, a) => flows.receivePurchaseOrder(tx, draft.id, [{ lineId: l0.id, qty: half }], a))).ok).toBe(true);
    expect((await stockOf(l0.productId, draft.warehouseId)).qtyOnHand).toBe((before?.qtyOnHand ?? 0) + half);
    expect((await db.select().from(s.purchaseOrders).where(eq(s.purchaseOrders.id, draft.id)))[0].status).toBe(lines.length === 1 && half === l0.qty ? "received" : "partially_received");
    expect((await run((tx, a) => flows.receivePurchaseOrder(tx, draft.id, [{ lineId: l0.id, qty: l0.qty }], a))).ok).toBe(false); // over-receipt
    const rest = lines.map((l) => ({ lineId: l.id, qty: l.id === l0.id ? l.qty - half : l.qty }));
    expect((await run((tx, a) => flows.receivePurchaseOrder(tx, draft.id, rest, a))).ok).toBe(true);
    const [po] = await db.select().from(s.purchaseOrders).where(eq(s.purchaseOrders.id, draft.id));
    expect(po.status).toBe("received");
    expect(po.receivedAt).toBeInstanceOf(Date);
    expect((await run((tx, a) => flows.cancelPurchaseOrder(tx, draft.id, a))).ok).toBe(false);
  });

  it("cancelling a confirmed order releases its reservation", async () => {
    const [so] = await db.select().from(s.salesOrders).where(eq(s.salesOrders.status, "confirmed")).limit(1);
    const [l] = await db.select().from(s.salesOrderLines).where(eq(s.salesOrderLines.salesOrderId, so.id)).limit(1);
    const before = await stockOf(l.productId, so.warehouseId);
    expect((await run((tx, a) => flows.cancelSalesOrder(tx, so.id, a))).ok).toBe(true);
    expect((await stockOf(l.productId, so.warehouseId)).qtyReserved).toBe(Math.max(0, before.qtyReserved - l.qty));
    expect((await run((tx, a) => flows.cancelSalesOrder(tx, so.id, a))).ok).toBe(false);
  });
});

describe("ERP records via forms", () => {
  it("creates products with stock rows and rejects duplicate SKUs", async () => {
    const res = await saveRecord("products", null, { name: "Test hex bolt M20", sku: "fas-9001", category: "fasteners", price: "950", cost: "600", gstRate: "18", unit: "box", hsnCode: "7318", active: true });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [p] = await db.select().from(s.products).where(eq(s.products.id, res.id));
    expect(p).toMatchObject({ sku: "FAS-9001", gstRate: 18, price: 950 });
    expect(await db.select().from(s.inventory).where(eq(s.inventory.productId, res.id))).toHaveLength(4);
    const dup = await saveRecord("products", null, { name: "Dup", sku: "FAS-9001", category: "fasteners", price: 1, cost: 1, gstRate: "18", unit: "box", hsnCode: "7318" });
    expect(dup.ok === false && dup.errors?.sku).toMatch(/already/);
  });

  it("creates draft orders with numbers and blocks editing non-drafts", async () => {
    const res = await saveRecord("purchase-orders", null, { supplierId: 1, warehouseId: 2, expectedDate: addDaysISO(todayIST(), 7) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [po] = await db.select().from(s.purchaseOrders).where(eq(s.purchaseOrders.id, res.id));
    expect(po).toMatchObject({ status: "draft", number: `PO-${String(res.id).padStart(6, "0")}` });
    const [fulfilled] = await db.select().from(s.salesOrders).where(eq(s.salesOrders.status, "fulfilled")).limit(1);
    const blocked = await saveRecord("sales-orders", fulfilled.id, { companyId: fulfilled.companyId, warehouseId: fulfilled.warehouseId });
    expect(blocked.ok === false && blocked.message).toMatch(/draft/);
  });
});

describe("ERP detail and computed fields", () => {
  it("offers state-dependent actions and lines", async () => {
    const [draft] = await db.select().from(s.salesOrders).where(eq(s.salesOrders.status, "draft")).limit(1);
    const d = await getDetail("sales-orders", draft.id);
    expect(d?.actions.map((a) => a.key)).toEqual(["confirm", "cancel"]);
    expect(d?.lines?.editable).toBe(true);
    expect(d?.lines?.productOptions?.length).toBeGreaterThan(50);
    const [paid] = await db.select().from(s.invoices).where(eq(s.invoices.status, "paid")).limit(1);
    expect((await getDetail("invoices", paid.id))?.actions).toEqual([]);
    const [open] = await db.select().from(s.invoices).where(eq(s.invoices.status, "sent")).limit(1);
    const inv = await getDetail("invoices", open.id);
    expect(inv?.actions[0]).toMatchObject({ key: "payment", input: "payment" });
    expect(inv?.context?.balance).toBeCloseTo(open.total - open.amountPaid, 2);
    expect(inv?.timeline).toBeDefined();
  });

  it("invoice balance and overdue days match the stored data", async () => {
    const ent = getEntityServer("invoices")!;
    const res = await listEntity(ent, { ...defaultQuery(ent.meta), pageSize: 100, cols: ["number", "status", "balance", "daysOverdue", "dueDate", "aging"] });
    const today = todayIST();
    for (const r of res.rows) {
      const [inv] = await db.select().from(s.invoices).where(eq(s.invoices.id, r.id));
      expect(r.balance).toBeCloseTo(inv.status === "void" ? 0 : inv.total - inv.amountPaid, 2);
      const unpaid = inv.status === "sent" || inv.status === "partially_paid";
      const days = Math.round((Date.parse(today) - Date.parse(inv.dueDate)) / 86_400_000);
      expect(r.daysOverdue).toBe(unpaid && days > 0 ? days : 0);
      if (!unpaid) expect(r.aging).toBeNull();
    }
  });
});
