import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { companies, deals, inventory, invoices, payments, products, purchaseOrderLines, purchaseOrders, salesOrderLines, salesOrders, suppliers, warehouses } from "../db/schema";
import { WAREHOUSES } from "../db/seed/reference";
import { addDaysISO, todayIST } from "../filters/dates";
import { formatINR } from "../lib/format";
import { currentActor, FlowError, writeAudit, type Actor, type Tx } from "./audit";

/**
 * Cross-module ERP flows. Each public function runs inside the caller's transaction (or opens one via runFlow),
 * keeps stock, orders, invoices and payments consistent, and writes audit rows. Business rules:
 *  - won deal → draft sales order with lines suggested from the customer's buying history
 *  - confirm order → reserve stock · fulfil → deduct stock, issue invoice, prospect becomes customer, auto-reorder
 *  - payment → invoice balance/status · receive PO → stock in · stock count → adjust on-hand
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const pad = (prefix: string, id: number) => `${prefix}-${String(id).padStart(6, "0")}`;
const placeholder = () => `TMP-${crypto.randomUUID()}`;
const name = (a: Actor) => a?.name ?? "Someone";

export async function runFlow<T>(fn: (tx: Tx, actor: Actor) => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  const db = await getDb();
  try {
    const value = await db.transaction(async (tx) => fn(tx, await currentActor(tx)));
    return { ok: true, value };
  } catch (err) {
    if (err instanceof FlowError) return { ok: false, message: err.message };
    throw err;
  }
}

// ── totals ──────────────────────────────────────────────────────────────────
export async function recalcSalesOrder(tx: Tx, id: number) {
  const lines = await tx.select().from(salesOrderLines).where(eq(salesOrderLines.salesOrderId, id));
  const subtotal = r2(lines.reduce((a, l) => a + l.lineTotal, 0));
  const tax = r2(lines.reduce((a, l) => a + r2((l.lineTotal * l.gstRate) / 100), 0));
  await tx.update(salesOrders).set({ subtotal, tax, total: r2(subtotal + tax) }).where(eq(salesOrders.id, id));
  return { subtotal, tax, total: r2(subtotal + tax) };
}

export async function recalcPurchaseOrder(tx: Tx, id: number) {
  const lines = await tx.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, id));
  const subtotal = r2(lines.reduce((a, l) => a + r2(l.qty * l.unitCost), 0));
  const tax = r2(lines.reduce((a, l) => a + r2((r2(l.qty * l.unitCost) * l.gstRate) / 100), 0));
  await tx.update(purchaseOrders).set({ subtotal, tax, total: r2(subtotal + tax) }).where(eq(purchaseOrders.id, id));
}

const lineTotal = (qty: number, price: number, discountPct: number) => r2(qty * price * (1 - discountPct / 100));

async function ensureStockRow(tx: Tx, productId: number, warehouseId: number) {
  await tx.insert(inventory).values({ productId, warehouseId, qtyOnHand: 0, qtyReserved: 0, reorderLevel: 10 }).onConflictDoNothing();
}

// ── creating orders ─────────────────────────────────────────────────────────
export async function newSalesOrder(tx: Tx, v: { companyId: number; warehouseId: number; ownerId: number | null; dealId?: number | null }) {
  const [so] = await tx
    .insert(salesOrders)
    .values({ number: placeholder(), companyId: v.companyId, warehouseId: v.warehouseId, ownerId: v.ownerId, dealId: v.dealId ?? null, status: "draft", orderDate: todayIST(), subtotal: 0, tax: 0, total: 0 })
    .returning();
  const number = pad("SO", so.id);
  await tx.update(salesOrders).set({ number }).where(eq(salesOrders.id, so.id));
  return { ...so, number };
}

export async function newPurchaseOrder(tx: Tx, v: { supplierId: number; warehouseId: number; expectedDate?: string | null; createdBy: number | null }) {
  const [po] = await tx
    .insert(purchaseOrders)
    .values({ number: placeholder(), supplierId: v.supplierId, warehouseId: v.warehouseId, status: "draft", orderDate: todayIST(), expectedDate: v.expectedDate ?? addDaysISO(todayIST(), 10), subtotal: 0, tax: 0, total: 0, createdBy: v.createdBy })
    .returning();
  const number = pad("PO", po.id);
  await tx.update(purchaseOrders).set({ number }).where(eq(purchaseOrders.id, po.id));
  return { ...po, number };
}

const warehouseForRegion = async (tx: Tx, region: string) => {
  const code = WAREHOUSES.find((w) => (w.serves as string[]).includes(region))?.code ?? WAREHOUSES[0].code;
  const [w] = await tx.select({ id: warehouses.id }).from(warehouses).where(eq(warehouses.code, code));
  return w?.id ?? 1;
};

/** Won deal → draft sales order (once per deal), lines suggested from the customer's history or best sellers. */
export async function createOrderFromDeal(tx: Tx, dealId: number, actor: Actor) {
  const [existing] = await tx.select({ id: salesOrders.id }).from(salesOrders).where(eq(salesOrders.dealId, dealId)).limit(1);
  if (existing) return null;
  const [deal] = await tx.select().from(deals).where(eq(deals.id, dealId));
  const [company] = await tx.select().from(companies).where(eq(companies.id, deal.companyId));
  const so = await newSalesOrder(tx, { companyId: company.id, warehouseId: await warehouseForRegion(tx, company.region), ownerId: deal.ownerId, dealId });

  const history = await tx
    .select({ productId: salesOrderLines.productId, n: sql<number>`count(*)`.mapWith(Number) })
    .from(salesOrderLines)
    .innerJoin(salesOrders, eq(salesOrders.id, salesOrderLines.salesOrderId))
    .innerJoin(products, eq(products.id, salesOrderLines.productId))
    .where(and(eq(salesOrders.companyId, company.id), sql`${salesOrders.status} <> 'cancelled'`, eq(products.active, true)))
    .groupBy(salesOrderLines.productId)
    .orderBy(desc(sql`count(*)`))
    .limit(4);
  let productIds = history.map((h) => h.productId);
  if (!productIds.length) {
    const best = await tx
      .select({ productId: salesOrderLines.productId })
      .from(salesOrderLines)
      .innerJoin(products, eq(products.id, salesOrderLines.productId))
      .where(eq(products.active, true))
      .groupBy(salesOrderLines.productId)
      .orderBy(desc(sql`sum(${salesOrderLines.lineTotal})`))
      .limit(4);
    productIds = best.map((b) => b.productId);
  }
  const items = productIds.length ? await tx.select().from(products).where(inArray(products.id, productIds)) : [];
  const target = deal.value / 1.18 / Math.max(1, items.length);
  if (items.length) {
    await tx.insert(salesOrderLines).values(
      items.map((p) => {
        const qty = Math.max(1, Math.round(target / p.price));
        return { salesOrderId: so.id, productId: p.id, qty, unitPrice: p.price, discountPct: 0, gstRate: p.gstRate, lineTotal: lineTotal(qty, p.price, 0) };
      }),
    );
  }
  const totals = await recalcSalesOrder(tx, so.id);
  await writeAudit(
    tx,
    actor,
    "sales-orders",
    so.id,
    "sales_order.created",
    `Draft ${so.number} (${formatINR(totals.total, { compact: true })}) created from won deal “${deal.title}” — lines suggested from ${history.length ? "the customer's order history" : "best sellers"}; review and confirm`,
    null,
    { status: "draft", dealId },
  );
  return so;
}

// ── draft line editing ──────────────────────────────────────────────────────
export type LineOp = { op: "add"; productId: number; qty: number; discountPct?: number } | { op: "update"; lineId: number; qty: number; discountPct?: number } | { op: "remove"; lineId: number };

export async function editLines(tx: Tx, kind: "so" | "po", id: number, op: LineOp, actor: Actor) {
  const order = kind === "so" ? (await tx.select().from(salesOrders).where(eq(salesOrders.id, id)))[0] : (await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)))[0];
  if (!order) throw new FlowError("Order not found");
  if (order.status !== "draft") throw new FlowError("Only draft orders can be changed");
  if (op.op !== "remove" && (!Number.isInteger(op.qty) || op.qty < 1 || op.qty > 1_000_000)) throw new FlowError("Quantity must be a whole number from 1");
  const disc = op.op === "remove" ? 0 : (op.discountPct ?? 0);
  if (kind === "so" && (disc < 0 || disc > 50)) throw new FlowError("Discount must be between 0 and 50%");

  if (kind === "so") {
    if (op.op === "add") {
      const [p] = await tx.select().from(products).where(and(eq(products.id, op.productId), eq(products.active, true)));
      if (!p) throw new FlowError("Product not found or inactive");
      const [same] = await tx.select().from(salesOrderLines).where(and(eq(salesOrderLines.salesOrderId, id), eq(salesOrderLines.productId, p.id)));
      if (same) {
        const qty = same.qty + op.qty;
        await tx.update(salesOrderLines).set({ qty, discountPct: disc, lineTotal: lineTotal(qty, same.unitPrice, disc) }).where(eq(salesOrderLines.id, same.id));
      } else {
        await tx.insert(salesOrderLines).values({ salesOrderId: id, productId: p.id, qty: op.qty, unitPrice: p.price, discountPct: disc, gstRate: p.gstRate, lineTotal: lineTotal(op.qty, p.price, disc) });
      }
    } else {
      const [line] = await tx.select().from(salesOrderLines).where(and(eq(salesOrderLines.id, op.lineId), eq(salesOrderLines.salesOrderId, id)));
      if (!line) throw new FlowError("Line not found");
      if (op.op === "remove") await tx.delete(salesOrderLines).where(eq(salesOrderLines.id, line.id));
      else await tx.update(salesOrderLines).set({ qty: op.qty, discountPct: disc, lineTotal: lineTotal(op.qty, line.unitPrice, disc) }).where(eq(salesOrderLines.id, line.id));
    }
    await recalcSalesOrder(tx, id);
  } else {
    if (op.op === "add") {
      const [p] = await tx.select().from(products).where(eq(products.id, op.productId));
      if (!p) throw new FlowError("Product not found");
      const [same] = await tx.select().from(purchaseOrderLines).where(and(eq(purchaseOrderLines.purchaseOrderId, id), eq(purchaseOrderLines.productId, p.id)));
      if (same) await tx.update(purchaseOrderLines).set({ qty: same.qty + op.qty }).where(eq(purchaseOrderLines.id, same.id));
      else await tx.insert(purchaseOrderLines).values({ purchaseOrderId: id, productId: p.id, qty: op.qty, unitCost: p.cost, gstRate: p.gstRate });
    } else {
      const [line] = await tx.select().from(purchaseOrderLines).where(and(eq(purchaseOrderLines.id, op.lineId), eq(purchaseOrderLines.purchaseOrderId, id)));
      if (!line) throw new FlowError("Line not found");
      if (op.op === "remove") await tx.delete(purchaseOrderLines).where(eq(purchaseOrderLines.id, line.id));
      else await tx.update(purchaseOrderLines).set({ qty: op.qty }).where(eq(purchaseOrderLines.id, line.id));
    }
    await recalcPurchaseOrder(tx, id);
  }
  await writeAudit(tx, actor, kind === "so" ? "sales-orders" : "purchase-orders", id, `lines.${op.op}`, `${name(actor)} ${op.op === "add" ? "added a line to" : op.op === "remove" ? "removed a line from" : "changed a line on"} ${order.number}`);
}

// ── sales order lifecycle ───────────────────────────────────────────────────
async function loadSo(tx: Tx, id: number) {
  const [so] = await tx.select().from(salesOrders).where(eq(salesOrders.id, id)).for("update");
  if (!so) throw new FlowError("Sales order not found");
  const lines = await tx.select().from(salesOrderLines).where(eq(salesOrderLines.salesOrderId, id));
  return { so, lines };
}

export async function confirmSalesOrder(tx: Tx, id: number, actor: Actor) {
  const { so, lines } = await loadSo(tx, id);
  if (so.status !== "draft") throw new FlowError(`${so.number} is already ${so.status}`);
  if (!lines.length) throw new FlowError("Add at least one line before confirming");
  for (const l of lines) {
    await ensureStockRow(tx, l.productId, so.warehouseId);
    await tx
      .update(inventory)
      .set({ qtyReserved: sql`${inventory.qtyReserved} + ${l.qty}` })
      .where(and(eq(inventory.productId, l.productId), eq(inventory.warehouseId, so.warehouseId)));
  }
  await tx.update(salesOrders).set({ status: "confirmed" }).where(eq(salesOrders.id, id));
  await writeAudit(tx, actor, "sales-orders", id, "sales_order.confirmed", `${name(actor)} confirmed ${so.number} (${formatINR(so.total, { compact: true })}) — stock reserved`, { status: "draft" }, { status: "confirmed" });
}

export async function fulfilSalesOrder(tx: Tx, id: number, actor: Actor) {
  const { so, lines } = await loadSo(tx, id);
  if (so.status !== "confirmed") throw new FlowError(so.status === "draft" ? "Confirm the order before fulfilling it" : `${so.number} is already ${so.status}`);
  const stock = await tx
    .select({ inv: inventory, sku: products.sku })
    .from(inventory)
    .innerJoin(products, eq(products.id, inventory.productId))
    .where(and(eq(inventory.warehouseId, so.warehouseId), inArray(inventory.productId, lines.map((l) => l.productId))))
    .for("update", { of: inventory });
  const byProduct = new Map(stock.map((s) => [s.inv.productId, s]));
  const short = lines
    .filter((l) => (byProduct.get(l.productId)?.inv.qtyOnHand ?? 0) < l.qty)
    .map((l) => `${byProduct.get(l.productId)?.sku ?? `#${l.productId}`} (need ${l.qty}, have ${byProduct.get(l.productId)?.inv.qtyOnHand ?? 0})`);
  if (short.length) throw new FlowError(`Not enough stock to ship: ${short.slice(0, 3).join(", ")}${short.length > 3 ? ` and ${short.length - 3} more` : ""}. Receive a purchase order or adjust stock first.`);

  for (const l of lines) {
    await tx
      .update(inventory)
      .set({ qtyOnHand: sql`${inventory.qtyOnHand} - ${l.qty}`, qtyReserved: sql`greatest(${inventory.qtyReserved} - ${l.qty}, 0)` })
      .where(and(eq(inventory.productId, l.productId), eq(inventory.warehouseId, so.warehouseId)));
  }
  await tx.update(salesOrders).set({ status: "fulfilled", fulfilledAt: new Date() }).where(eq(salesOrders.id, id));

  const [company] = await tx.select().from(companies).where(eq(companies.id, so.companyId));
  const issue = todayIST();
  const [inv] = await tx
    .insert(invoices)
    .values({ number: placeholder(), salesOrderId: so.id, companyId: so.companyId, status: "sent", issueDate: issue, dueDate: addDaysISO(issue, company.paymentTermsDays), subtotal: so.subtotal, tax: so.tax, total: so.total, amountPaid: 0 })
    .returning();
  const invNumber = pad("INV", inv.id);
  await tx.update(invoices).set({ number: invNumber }).where(eq(invoices.id, inv.id));

  await writeAudit(tx, actor, "sales-orders", id, "sales_order.fulfilled", `${name(actor)} fulfilled ${so.number} — stock deducted, ${invNumber} issued (due in ${company.paymentTermsDays} days)`, { status: "confirmed" }, { status: "fulfilled", invoiceId: inv.id });
  await writeAudit(tx, actor, "invoices", inv.id, "invoice.issued", `${invNumber} for ${formatINR(so.total)} issued to ${company.name} from ${so.number}`, null, { status: "sent" });

  if (company.lifecycle !== "customer") {
    await tx.update(companies).set({ lifecycle: "customer" }).where(eq(companies.id, company.id));
    await writeAudit(tx, actor, "companies", company.id, "update", `${company.name} became a customer with its first fulfilled order (${so.number})`, { lifecycle: company.lifecycle }, { lifecycle: "customer" });
  }
  const reorders = await autoReorder(tx, lines.map((l) => l.productId), so.warehouseId, actor);
  return { invoiceId: inv.id, invoiceNumber: invNumber, reorders };
}

export async function cancelSalesOrder(tx: Tx, id: number, actor: Actor) {
  const { so, lines } = await loadSo(tx, id);
  if (so.status !== "draft" && so.status !== "confirmed") throw new FlowError(`A ${so.status} order can't be cancelled`);
  if (so.status === "confirmed") {
    for (const l of lines) {
      await tx
        .update(inventory)
        .set({ qtyReserved: sql`greatest(${inventory.qtyReserved} - ${l.qty}, 0)` })
        .where(and(eq(inventory.productId, l.productId), eq(inventory.warehouseId, so.warehouseId)));
    }
  }
  await tx.update(salesOrders).set({ status: "cancelled" }).where(eq(salesOrders.id, id));
  await writeAudit(tx, actor, "sales-orders", id, "sales_order.cancelled", `${name(actor)} cancelled ${so.number}${so.status === "confirmed" ? " — reserved stock released" : ""}`, { status: so.status }, { status: "cancelled" });
}

// ── auto-reorder ────────────────────────────────────────────────────────────
/**
 * For each product at the warehouse: if available + already on order < reorder level, top up to 2× reorder level
 * on a draft PO from the supplier who has supplied it most (else the best-rated supplier), reusing an open draft.
 */
export async function autoReorder(tx: Tx, productIds: number[], warehouseId: number, actor: Actor) {
  const touched = new Map<number, string>();
  for (const productId of [...new Set(productIds)]) {
    const [inv] = await tx.select().from(inventory).where(and(eq(inventory.productId, productId), eq(inventory.warehouseId, warehouseId)));
    if (!inv || inv.reorderLevel <= 0) continue;
    const [{ onOrder }] = await tx
      .select({ onOrder: sql<number>`coalesce(sum(${purchaseOrderLines.qty} - ${purchaseOrderLines.qtyReceived}), 0)`.mapWith(Number) })
      .from(purchaseOrderLines)
      .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderLines.purchaseOrderId))
      .where(and(eq(purchaseOrderLines.productId, productId), eq(purchaseOrders.warehouseId, warehouseId), inArray(purchaseOrders.status, ["draft", "sent", "partially_received"])));
    const available = inv.qtyOnHand - inv.qtyReserved;
    if (available + onOrder >= inv.reorderLevel) continue;
    const need = Math.max(10, Math.ceil((inv.reorderLevel * 2 - available - onOrder) / 10) * 10);

    const [usual] = await tx
      .select({ supplierId: purchaseOrders.supplierId })
      .from(purchaseOrderLines)
      .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderLines.purchaseOrderId))
      .where(eq(purchaseOrderLines.productId, productId))
      .groupBy(purchaseOrders.supplierId)
      .orderBy(desc(sql`count(*)`))
      .limit(1);
    const supplierId = usual?.supplierId ?? (await tx.select({ id: suppliers.id }).from(suppliers).orderBy(desc(suppliers.rating), suppliers.id).limit(1))[0]?.id;
    if (!supplierId) continue;

    let [po] = await tx
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.supplierId, supplierId), eq(purchaseOrders.warehouseId, warehouseId), eq(purchaseOrders.status, "draft")))
      .orderBy(desc(purchaseOrders.id))
      .limit(1);
    const created = !po;
    if (!po) po = await newPurchaseOrder(tx, { supplierId, warehouseId, createdBy: actor?.id ?? null });
    const [p] = await tx.select().from(products).where(eq(products.id, productId));
    const [same] = await tx.select().from(purchaseOrderLines).where(and(eq(purchaseOrderLines.purchaseOrderId, po.id), eq(purchaseOrderLines.productId, productId)));
    if (same) await tx.update(purchaseOrderLines).set({ qty: same.qty + need }).where(eq(purchaseOrderLines.id, same.id));
    else await tx.insert(purchaseOrderLines).values({ purchaseOrderId: po.id, productId, qty: need, unitCost: p.cost, gstRate: p.gstRate });
    await recalcPurchaseOrder(tx, po.id);
    await writeAudit(tx, actor, "purchase-orders", po.id, created ? "purchase_order.auto_created" : "purchase_order.auto_updated", `Auto-reorder: ${need} × ${p.sku} added to ${created ? "new draft" : "draft"} ${po.number} (available ${available}, reorder at ${inv.reorderLevel})`, null, { productId, qty: need });
    touched.set(po.id, po.number);
  }
  return [...touched.values()];
}

// ── purchase orders ─────────────────────────────────────────────────────────
async function loadPo(tx: Tx, id: number) {
  const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).for("update");
  if (!po) throw new FlowError("Purchase order not found");
  const lines = await tx.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, id));
  return { po, lines };
}

export async function sendPurchaseOrder(tx: Tx, id: number, actor: Actor) {
  const { po, lines } = await loadPo(tx, id);
  if (po.status !== "draft") throw new FlowError(`${po.number} is already ${po.status.replace("_", " ")}`);
  if (!lines.length) throw new FlowError("Add at least one line before sending");
  await tx.update(purchaseOrders).set({ status: "sent", orderDate: todayIST() }).where(eq(purchaseOrders.id, id));
  await writeAudit(tx, actor, "purchase-orders", id, "purchase_order.sent", `${name(actor)} sent ${po.number} (${formatINR(po.total, { compact: true })}) to the supplier`, { status: "draft" }, { status: "sent" });
}

/** Receive quantities per line (omitted lines receive nothing); stock goes up at the PO's warehouse. */
export async function receivePurchaseOrder(tx: Tx, id: number, receipt: { lineId: number; qty: number }[], actor: Actor) {
  const { po, lines } = await loadPo(tx, id);
  if (po.status !== "sent" && po.status !== "partially_received") throw new FlowError(po.status === "draft" ? "Send the purchase order before receiving it" : `${po.number} is ${po.status.replace("_", " ")}`);
  let units = 0;
  for (const r of receipt) {
    const line = lines.find((l) => l.id === r.lineId);
    if (!line) throw new FlowError("Line not found on this purchase order");
    if (!Number.isInteger(r.qty) || r.qty < 0) throw new FlowError("Received quantities must be whole numbers");
    if (r.qty === 0) continue;
    if (line.qtyReceived + r.qty > line.qty) throw new FlowError(`Can't receive more than ordered (${line.qty - line.qtyReceived} remaining on a line)`);
    line.qtyReceived += r.qty;
    units += r.qty;
    await tx.update(purchaseOrderLines).set({ qtyReceived: line.qtyReceived }).where(eq(purchaseOrderLines.id, line.id));
    await ensureStockRow(tx, line.productId, po.warehouseId);
    await tx
      .update(inventory)
      .set({ qtyOnHand: sql`${inventory.qtyOnHand} + ${r.qty}` })
      .where(and(eq(inventory.productId, line.productId), eq(inventory.warehouseId, po.warehouseId)));
  }
  if (!units) throw new FlowError("Enter at least one quantity to receive");
  const complete = lines.every((l) => l.qtyReceived >= l.qty);
  const status = complete ? "received" : "partially_received";
  await tx.update(purchaseOrders).set({ status, receivedAt: complete ? new Date() : null }).where(eq(purchaseOrders.id, id));
  await writeAudit(tx, actor, "purchase-orders", id, "purchase_order.received", `${name(actor)} received ${units} units on ${po.number}${complete ? " — fully received" : " — partially received"}`, { status: po.status }, { status });
  return { status };
}

export async function cancelPurchaseOrder(tx: Tx, id: number, actor: Actor) {
  const { po, lines } = await loadPo(tx, id);
  if (po.status !== "draft" && po.status !== "sent") throw new FlowError(`A ${po.status.replace("_", " ")} purchase order can't be cancelled`);
  if (lines.some((l) => l.qtyReceived > 0)) throw new FlowError("Goods already received on this order");
  await tx.update(purchaseOrders).set({ status: "cancelled" }).where(eq(purchaseOrders.id, id));
  await writeAudit(tx, actor, "purchase-orders", id, "purchase_order.cancelled", `${name(actor)} cancelled ${po.number}`, { status: po.status }, { status: "cancelled" });
}

// ── invoices & payments ─────────────────────────────────────────────────────
export async function sendInvoice(tx: Tx, id: number, actor: Actor) {
  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, id)).for("update");
  if (!inv) throw new FlowError("Invoice not found");
  if (inv.status !== "draft") throw new FlowError(`${inv.number} is already ${inv.status.replace("_", " ")}`);
  await tx.update(invoices).set({ status: "sent" }).where(eq(invoices.id, id));
  await writeAudit(tx, actor, "invoices", id, "invoice.sent", `${name(actor)} sent ${inv.number} to the customer`, { status: "draft" }, { status: "sent" });
}

export const PAYMENT_METHODS = ["neft", "rtgs", "upi", "cheque", "card"] as const;

export async function recordPayment(tx: Tx, id: number, p: { amount: number; method: string; reference: string; paidOn: string }, actor: Actor) {
  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, id)).for("update");
  if (!inv) throw new FlowError("Invoice not found");
  if (inv.status !== "sent" && inv.status !== "partially_paid") throw new FlowError(inv.status === "draft" ? "Send the invoice before recording a payment" : `${inv.number} is ${inv.status.replace("_", " ")}`);
  const balance = r2(inv.total - inv.amountPaid);
  const amount = r2(p.amount);
  if (!(amount > 0)) throw new FlowError("Amount must be more than zero");
  if (amount > balance) throw new FlowError(`Amount is more than the balance of ${formatINR(balance, { paise: true })}`);
  if (!(PAYMENT_METHODS as readonly string[]).includes(p.method)) throw new FlowError("Choose a payment method");
  const today = todayIST();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.paidOn) || p.paidOn > today || p.paidOn < inv.issueDate) throw new FlowError(`Payment date must be between the issue date and today`);
  const paidAt = p.paidOn === today ? new Date() : new Date(`${p.paidOn}T12:00:00+05:30`);
  const [pay] = await tx
    .insert(payments)
    .values({ invoiceId: id, amount, method: p.method as (typeof PAYMENT_METHODS)[number], reference: p.reference.trim().slice(0, 60) || null, paidAt })
    .returning();
  const amountPaid = r2(inv.amountPaid + amount);
  const status = amountPaid >= inv.total ? "paid" : "partially_paid";
  await tx.update(invoices).set({ amountPaid, status }).where(eq(invoices.id, id));
  await writeAudit(tx, actor, "invoices", id, "payment.received", `${formatINR(amount)} received against ${inv.number} by ${p.method.toUpperCase()}${status === "paid" ? " — paid in full" : ` — ${formatINR(r2(inv.total - amountPaid), { compact: true })} still due`}`, { status: inv.status, amountPaid: inv.amountPaid }, { status, amountPaid });
  return { paymentId: pay.id, status };
}

// ── stock adjustments ───────────────────────────────────────────────────────
export const ADJUST_REASONS = ["Cycle count", "Damaged", "Found in stock", "Returned to supplier", "Other"] as const;

export async function adjustStock(tx: Tx, inventoryId: number, counted: number, reason: string, actor: Actor) {
  if (!Number.isInteger(counted) || counted < 0 || counted > 10_000_000) throw new FlowError("Counted quantity must be a whole number, 0 or more");
  if (!(ADJUST_REASONS as readonly string[]).includes(reason)) throw new FlowError("Choose a reason");
  const [inv] = await tx.select().from(inventory).where(eq(inventory.id, inventoryId)).for("update");
  if (!inv) throw new FlowError("Stock record not found");
  if (counted === inv.qtyOnHand) throw new FlowError("That's the current quantity — nothing to adjust");
  await tx.update(inventory).set({ qtyOnHand: counted }).where(eq(inventory.id, inventoryId));
  const [p] = await tx.select({ sku: products.sku }).from(products).where(eq(products.id, inv.productId));
  const delta = counted - inv.qtyOnHand;
  await writeAudit(tx, actor, "inventory", inventoryId, "stock.adjusted", `${name(actor)} adjusted ${p.sku} by ${delta > 0 ? "+" : ""}${delta} (${reason}): ${inv.qtyOnHand} → ${counted}`, { qtyOnHand: inv.qtyOnHand }, { qtyOnHand: counted, reason });
  const reorders = await autoReorder(tx, [inv.productId], inv.warehouseId, actor);
  return { reorders };
}
