import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type Db } from "../db/client";
import { activities, auditLog, companies, contacts, deals, inventory, invoices, leads, payments, products, purchaseOrderLines, purchaseOrders, salesOrderLines, salesOrders, suppliers, users, warehouses } from "../db/schema";
import { getEntityServer } from "../entities/server";
import { entityMetas } from "../entities";
import { forms } from "../entities/forms";
import { DEAL_STAGE } from "../entities/crm-options";
import { LIFECYCLE } from "../entities/companies";
import { serializeFilter } from "../filters/parse";
import { selectionFor } from "../filters/toSql";
import { formatDate, formatINR } from "../lib/format";
import { PORTAL_BASE } from "../nav";
import type { DetailItem, DetailSection, LinesBlock, RecordAction, RecordDetail, TimelineItem } from "./detail-types";
import { auditName } from "./audit";
import { loadProducts } from "../entities/options.server";
import { PAYMENT_METHOD, SO_STATUS as SO_OPTS, PO_STATUS, INVOICE_STATUS, STOCK_STATUS } from "../entities/erp-options";
import { todayIST } from "../filters/dates";

/** Loads one record with related records and a merged activity + audit timeline. Server-only. */

const href = (entity: string, id: number) => (entityMetas[entity] ? `${PORTAL_BASE}/${entity}/${id}` : undefined);
const listHref = (entity: string, field: string, id: number) =>
  `${PORTAL_BASE}/${entity}?f=${encodeURIComponent(serializeFilter({ combinator: "and", conditions: [{ field, op: "in", value: [id] }] })!)}`;
const badge = (opts: { value: string; label: string; color?: string }[], v: string) => {
  const o = opts.find((x) => x.value === v);
  return o ? { label: o.label, color: o.color } : { label: v };
};
const soItem = (o: { id: number; number: string; orderDate: string; total: number; status: string }): DetailItem => ({
  id: o.id,
  title: o.number,
  meta: `${formatDate(o.orderDate)} · ${formatINR(o.total, { compact: true })}`,
  badge: badge(SO_OPTS, o.status),
  href: href("sales-orders", o.id),
});
const invItem = (i: { id: number; number: string; total: number; amountPaid: number; dueDate: string; status: string }): DetailItem => {
  const unpaid = i.status === "sent" || i.status === "partially_paid";
  const overdue = unpaid && i.dueDate < todayIST();
  return {
    id: i.id,
    title: i.number,
    meta: unpaid ? `${formatINR(i.total - i.amountPaid, { compact: true })} due ${formatDate(i.dueDate)}` : formatINR(i.total, { compact: true }),
    badge: overdue ? { label: "Overdue", color: "#f87171" } : badge(INVOICE_STATUS, i.status),
    href: href("invoices", i.id),
  };
};

const dealItem = (d: { id: number; title: string; stage: string; value: number; expectedClose: string; company?: string | null }): DetailItem => ({
  id: d.id,
  title: d.title,
  subtitle: d.company ?? undefined,
  meta: `${formatINR(d.value, { compact: true })} · close ${formatDate(d.expectedClose)}`,
  badge: badge(DEAL_STAGE, d.stage),
  href: href("deals", d.id),
});

async function sections(db: Db, entity: string, id: number, row: Record<string, unknown>): Promise<DetailSection[]> {
  const dealCols = { id: deals.id, title: deals.title, stage: deals.stage, value: deals.value, expectedClose: deals.expectedClose };
  const count = (n: { n: number }[]) => Number(n[0]?.n ?? 0);
  switch (entity) {
    case "companies": {
      const [cts, ctN, dls, dlN, sos, invs] = await Promise.all([
        db.select().from(contacts).where(eq(contacts.companyId, id)).orderBy(desc(contacts.isPrimary), contacts.firstName).limit(6),
        db.select({ n: sql<number>`count(*)` }).from(contacts).where(eq(contacts.companyId, id)),
        db.select(dealCols).from(deals).where(and(eq(deals.companyId, id), sql`${deals.stage} not in ('won','lost')`)).orderBy(desc(deals.value)).limit(6),
        db.select({ n: sql<number>`count(*)` }).from(deals).where(eq(deals.companyId, id)),
        db.select().from(salesOrders).where(eq(salesOrders.companyId, id)).orderBy(desc(salesOrders.orderDate), desc(salesOrders.id)).limit(5),
        db.select().from(invoices).where(and(eq(invoices.companyId, id), inArray(invoices.status, ["sent", "partially_paid"]))).orderBy(invoices.dueDate).limit(6),
      ]);
      return [
        {
          key: "contacts",
          title: "Contacts",
          total: count(ctN),
          viewAll: listHref("contacts", "company", id),
          items: cts.map((c) => ({ id: c.id, title: `${c.firstName} ${c.lastName}`, subtitle: c.title ?? undefined, meta: c.email, badge: c.isPrimary ? { label: "Primary", color: "#4ade80" } : undefined, href: href("contacts", c.id) })),
        },
        { key: "deals", title: "Open deals", total: count(dlN), viewAll: listHref("deals", "company", id), items: dls.map(dealItem), empty: "No open deals" },
        {
          key: "orders",
          title: "Recent sales orders",
          total: sos.length,
          items: sos.map(soItem),
          viewAll: listHref("sales-orders", "company", id),
          empty: "No orders yet",
        },
        {
          key: "invoices",
          title: "Unpaid invoices",
          total: invs.length,
          items: invs.map(invItem),
          viewAll: listHref("invoices", "company", id),
          empty: "Nothing outstanding",
        },
      ];
    }
    case "contacts": {
      const companyId = row.company as number;
      const [[co], dls] = await Promise.all([
        db.select().from(companies).where(eq(companies.id, companyId)),
        db.select({ ...dealCols }).from(deals).where(eq(deals.contactId, id)).orderBy(desc(deals.createdAt)).limit(6),
      ]);
      return [
        { key: "company", title: "Company", total: co ? 1 : 0, items: co ? [{ id: co.id, title: co.name, subtitle: `${co.city}, ${co.state}`, badge: badge(LIFECYCLE, co.lifecycle), href: href("companies", co.id) }] : [] },
        { key: "deals", title: "Deals", total: dls.length, items: dls.map(dealItem), empty: "Not on any deal" },
      ];
    }
    case "leads": {
      const cid = row.convertedCompany as number | null;
      if (!cid) return [];
      const [co] = await db.select().from(companies).where(eq(companies.id, cid));
      return co ? [{ key: "company", title: "Converted to", total: 1, items: [{ id: co.id, title: co.name, subtitle: `${co.city}, ${co.state}`, badge: badge(LIFECYCLE, co.lifecycle), href: href("companies", co.id) }] }] : [];
    }
    case "deals": {
      const [[d]] = await Promise.all([db.select().from(deals).where(eq(deals.id, id))]);
      const [[co], [ct], sos] = await Promise.all([
        db.select().from(companies).where(eq(companies.id, d.companyId)),
        d.contactId ? db.select().from(contacts).where(eq(contacts.id, d.contactId)) : Promise.resolve([]),
        db.select().from(salesOrders).where(eq(salesOrders.dealId, id)).orderBy(desc(salesOrders.orderDate)),
      ]);
      return [
        {
          key: "parties",
          title: "Company & contact",
          total: 2,
          items: [
            ...(co ? [{ id: co.id, title: co.name, subtitle: `${co.city}, ${co.state}`, badge: badge(LIFECYCLE, co.lifecycle), href: href("companies", co.id) }] : []),
            ...(ct ? [{ id: ct.id, title: `${ct.firstName} ${ct.lastName}`, subtitle: ct.title ?? undefined, meta: ct.email, href: href("contacts", ct.id) }] : []),
          ],
        },
        {
          key: "orders",
          title: "Sales orders",
          total: sos.length,
          items: sos.map(soItem),
          empty: d.stage === "won" ? "No order yet" : "Orders appear once the deal is won",
        },
      ];
    }
    case "products": {
      const [stock, sos, pos] = await Promise.all([
        db.select({ inv: inventory, code: warehouses.code }).from(inventory).innerJoin(warehouses, eq(warehouses.id, inventory.warehouseId)).where(eq(inventory.productId, id)).orderBy(warehouses.id),
        db
          .selectDistinct({ id: salesOrders.id, number: salesOrders.number, orderDate: salesOrders.orderDate, total: salesOrders.total, status: salesOrders.status })
          .from(salesOrders)
          .innerJoin(salesOrderLines, eq(salesOrderLines.salesOrderId, salesOrders.id))
          .where(eq(salesOrderLines.productId, id))
          .orderBy(desc(salesOrders.orderDate), desc(salesOrders.id))
          .limit(5),
        db
          .selectDistinct({ id: purchaseOrders.id, number: purchaseOrders.number, status: purchaseOrders.status, expectedDate: purchaseOrders.expectedDate, total: purchaseOrders.total })
          .from(purchaseOrders)
          .innerJoin(purchaseOrderLines, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
          .where(and(eq(purchaseOrderLines.productId, id), inArray(purchaseOrders.status, ["draft", "sent", "partially_received"])))
          .limit(5),
      ]);
      return [
        {
          key: "stock",
          title: "Stock by warehouse",
          total: stock.length,
          items: stock.map(({ inv, code }) => {
            const status = inv.qtyOnHand === 0 ? "out" : inv.qtyOnHand - inv.qtyReserved < inv.reorderLevel ? "low" : "ok";
            return { id: inv.id, title: code, meta: `${inv.qtyOnHand} on hand · ${inv.qtyReserved} reserved · reorder at ${inv.reorderLevel}`, badge: badge(STOCK_STATUS, status), href: href("inventory", inv.id) };
          }),
        },
        { key: "orders", title: "Recent sales orders", total: sos.length, items: sos.map(soItem), empty: "Not ordered yet" },
        { key: "pos", title: "Open purchase orders", total: pos.length, items: pos.map((p) => ({ id: p.id, title: p.number, meta: `${formatINR(p.total, { compact: true })}${p.expectedDate ? ` · expected ${formatDate(p.expectedDate)}` : ""}`, badge: badge(PO_STATUS, p.status), href: href("purchase-orders", p.id) })), empty: "Nothing on order" },
      ];
    }
    case "inventory": {
      const [[inv]] = await Promise.all([db.select().from(inventory).where(eq(inventory.id, id))]);
      const [[p], pos, sos] = await Promise.all([
        db.select().from(products).where(eq(products.id, inv.productId)),
        db
          .select({ id: purchaseOrders.id, number: purchaseOrders.number, status: purchaseOrders.status, expectedDate: purchaseOrders.expectedDate, qty: purchaseOrderLines.qty, received: purchaseOrderLines.qtyReceived })
          .from(purchaseOrders)
          .innerJoin(purchaseOrderLines, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
          .where(and(eq(purchaseOrderLines.productId, inv.productId), eq(purchaseOrders.warehouseId, inv.warehouseId), inArray(purchaseOrders.status, ["draft", "sent", "partially_received"]))),
        db
          .select({ id: salesOrders.id, number: salesOrders.number, orderDate: salesOrders.orderDate, total: salesOrders.total, status: salesOrders.status, qty: salesOrderLines.qty })
          .from(salesOrders)
          .innerJoin(salesOrderLines, eq(salesOrderLines.salesOrderId, salesOrders.id))
          .where(and(eq(salesOrderLines.productId, inv.productId), eq(salesOrders.warehouseId, inv.warehouseId), eq(salesOrders.status, "confirmed"))),
      ]);
      return [
        { key: "product", title: "Product", total: 1, items: p ? [{ id: p.id, title: p.name, subtitle: p.sku, meta: formatINR(p.price), href: href("products", p.id) }] : [] },
        { key: "incoming", title: "Incoming (open POs)", total: pos.length, items: pos.map((o) => ({ id: o.id, title: o.number, meta: `${o.qty - o.received} to receive${o.expectedDate ? ` · ${formatDate(o.expectedDate)}` : ""}`, badge: badge(PO_STATUS, o.status), href: href("purchase-orders", o.id) })), empty: "Nothing on order" },
        { key: "reserved", title: "Reserved by confirmed orders", total: sos.length, items: sos.map((o) => ({ ...soItem(o), meta: `${o.qty} units · ${formatDate(o.orderDate)}` })), empty: "No reservations" },
      ];
    }
    case "sales-orders": {
      const [so] = await db.select().from(salesOrders).where(eq(salesOrders.id, id));
      const [[co], [deal], [inv]] = await Promise.all([
        db.select().from(companies).where(eq(companies.id, so.companyId)),
        so.dealId ? db.select().from(deals).where(eq(deals.id, so.dealId)) : Promise.resolve([]),
        db.select().from(invoices).where(eq(invoices.salesOrderId, id)),
      ]);
      return [
        {
          key: "links",
          title: "Customer, deal & invoice",
          total: 3,
          items: [
            ...(co ? [{ id: co.id, title: co.name, subtitle: `${co.city}, ${co.state} · ${co.paymentTermsDays}-day terms`, badge: badge(LIFECYCLE, co.lifecycle), href: href("companies", co.id) }] : []),
            ...(deal ? [dealItem({ ...deal, company: null })] : []),
            ...(inv ? [invItem(inv)] : []),
          ],
          empty: "—",
        },
      ];
    }
    case "purchase-orders": {
      const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
      const [[sup]] = await Promise.all([db.select().from(suppliers).where(eq(suppliers.id, po.supplierId))]);
      return [{ key: "supplier", title: "Supplier", total: 1, items: sup ? [{ id: sup.id, title: sup.name, subtitle: `${sup.city}, ${sup.state}`, meta: `${sup.paymentTermsDays}-day terms · rating ${sup.rating}/5` }] : [] }];
    }
    case "invoices": {
      const [inv] = await db.select().from(invoices).where(eq(invoices.id, id));
      const [[co], [so], pays] = await Promise.all([
        db.select().from(companies).where(eq(companies.id, inv.companyId)),
        db.select().from(salesOrders).where(eq(salesOrders.id, inv.salesOrderId)),
        db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(desc(payments.paidAt)),
      ]);
      const method = (m: string) => PAYMENT_METHOD.find((o) => o.value === m)?.label ?? m;
      return [
        {
          key: "links",
          title: "Customer & order",
          total: 2,
          items: [...(co ? [{ id: co.id, title: co.name, subtitle: `${co.paymentTermsDays}-day terms`, badge: badge(LIFECYCLE, co.lifecycle), href: href("companies", co.id) }] : []), ...(so ? [soItem(so)] : [])],
        },
        {
          key: "payments",
          title: "Payments",
          total: pays.length,
          items: pays.map((p) => ({ id: p.id, title: formatINR(p.amount, { paise: true }), subtitle: p.reference ?? undefined, meta: `${method(p.method)} · ${formatDate(p.paidAt)}`, href: href("payments", p.id) })),
          empty: "No payments yet",
        },
      ];
    }
    case "payments": {
      const [p] = await db.select().from(payments).where(eq(payments.id, id));
      const [inv] = await db.select().from(invoices).where(eq(invoices.id, p.invoiceId));
      const [co] = inv ? await db.select().from(companies).where(eq(companies.id, inv.companyId)) : [];
      return [{ key: "links", title: "Invoice & customer", total: 2, items: [...(inv ? [invItem(inv)] : []), ...(co ? [{ id: co.id, title: co.name, badge: badge(LIFECYCLE, co.lifecycle), href: href("companies", co.id) }] : [])] }];
    }
  }
  return [];
}

/** State-dependent actions, editability and order lines. */
async function workflow(db: Db, entity: string, id: number): Promise<{ actions: RecordAction[]; editable: boolean; lines?: LinesBlock; context?: Record<string, string | number> }> {
  switch (entity) {
    case "deals": {
      const [d] = await db.select({ stage: deals.stage }).from(deals).where(eq(deals.id, id));
      const [so] = await db.select({ id: salesOrders.id }).from(salesOrders).where(eq(salesOrders.dealId, id)).limit(1);
      return { editable: true, actions: d?.stage === "won" && !so ? [{ key: "create-order", label: "Create sales order", tone: "primary" }] : [] };
    }
    case "sales-orders": {
      const [so] = await db.select().from(salesOrders).where(eq(salesOrders.id, id));
      const rows = await db
        .select({ l: salesOrderLines, sku: products.sku, name: products.name, available: sql<number>`coalesce(${inventory.qtyOnHand} - ${inventory.qtyReserved}, 0)`.mapWith(Number) })
        .from(salesOrderLines)
        .innerJoin(products, eq(products.id, salesOrderLines.productId))
        .leftJoin(inventory, and(eq(inventory.productId, salesOrderLines.productId), eq(inventory.warehouseId, so.warehouseId)))
        .where(eq(salesOrderLines.salesOrderId, id))
        .orderBy(salesOrderLines.id);
      const draft = so.status === "draft";
      const actions: RecordAction[] =
        so.status === "draft"
          ? [{ key: "confirm", label: "Confirm order", tone: "primary" }, { key: "cancel", label: "Cancel order", tone: "danger", confirm: `Cancel ${so.number}?` }]
          : so.status === "confirmed"
            ? [{ key: "fulfil", label: "Fulfil & invoice", tone: "primary" }, { key: "cancel", label: "Cancel order", tone: "danger", confirm: `Cancel ${so.number} and release reserved stock?` }]
            : [];
      return {
        editable: draft,
        actions,
        lines: {
          kind: "so",
          editable: draft,
          rows: rows.map(({ l, sku, name, available }) => ({ id: l.id, productId: l.productId, sku, name, qty: l.qty, unitPrice: l.unitPrice, discountPct: l.discountPct, gstRate: l.gstRate, lineTotal: l.lineTotal, available })),
          subtotal: so.subtotal,
          tax: so.tax,
          total: so.total,
          productOptions: draft ? await loadProducts(db) : undefined,
        },
      };
    }
    case "purchase-orders": {
      const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
      const rows = await db
        .select({ l: purchaseOrderLines, sku: products.sku, name: products.name })
        .from(purchaseOrderLines)
        .innerJoin(products, eq(products.id, purchaseOrderLines.productId))
        .where(eq(purchaseOrderLines.purchaseOrderId, id))
        .orderBy(purchaseOrderLines.id);
      const draft = po.status === "draft";
      const receivedAny = rows.some((r) => r.l.qtyReceived > 0);
      const actions: RecordAction[] = [
        ...(draft ? [{ key: "send", label: "Send to supplier", tone: "primary" as const }] : []),
        ...(po.status === "sent" || po.status === "partially_received" ? [{ key: "receive", label: "Receive goods", tone: "primary" as const, input: "receive" as const }] : []),
        ...((draft || po.status === "sent") && !receivedAny ? [{ key: "cancel", label: "Cancel PO", tone: "danger" as const, confirm: `Cancel ${po.number}?` }] : []),
      ];
      return {
        editable: draft,
        actions,
        lines: {
          kind: "po",
          editable: draft,
          rows: rows.map(({ l, sku, name }) => ({ id: l.id, productId: l.productId, sku, name, qty: l.qty, qtyReceived: l.qtyReceived, unitPrice: l.unitCost, gstRate: l.gstRate, lineTotal: Math.round(l.qty * l.unitCost * 100) / 100 })),
          subtotal: po.subtotal,
          tax: po.tax,
          total: po.total,
          productOptions: draft ? await loadProducts(db) : undefined,
        },
      };
    }
    case "invoices": {
      const [inv] = await db.select().from(invoices).where(eq(invoices.id, id));
      const balance = Math.round((inv.total - inv.amountPaid) * 100) / 100;
      const actions: RecordAction[] =
        inv.status === "draft" ? [{ key: "send", label: "Send invoice", tone: "primary" }] : inv.status === "sent" || inv.status === "partially_paid" ? [{ key: "payment", label: "Record payment", tone: "primary", input: "payment" }] : [];
      return { editable: false, actions, context: { balance, issueDate: inv.issueDate, number: inv.number } };
    }
    case "inventory": {
      const [inv] = await db.select().from(inventory).where(eq(inventory.id, id));
      return { editable: false, actions: [{ key: "adjust", label: "Adjust stock", input: "adjust" }], context: { qtyOnHand: inv.qtyOnHand } };
    }
    case "payments":
      return { editable: false, actions: [] };
    default:
      return { editable: true, actions: [] };
  }
}

async function timeline(db: Db, entity: string, id: number): Promise<TimelineItem[]> {
  const actCol = entity === "companies" ? activities.companyId : entity === "contacts" ? activities.contactId : entity === "deals" ? activities.dealId : null;
  const [acts, audits] = await Promise.all([
    actCol
      ? db
          .select({ a: activities, owner: users.name })
          .from(activities)
          .leftJoin(users, eq(users.id, activities.ownerId))
          .where(eq(actCol, id))
          .orderBy(desc(activities.createdAt))
          .limit(25)
      : Promise.resolve([]),
    db
      .select({ l: auditLog, actor: users.name })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorId))
      .where(and(eq(auditLog.entity, auditName(entity)), eq(auditLog.entityId, String(id))))
      .orderBy(desc(auditLog.at))
      .limit(25),
  ]);
  const items: TimelineItem[] = [
    ...acts.map(({ a, owner }) => ({
      id: `a${a.id}`,
      at: (a.completedAt ?? a.createdAt).toISOString(),
      kind: a.type,
      title: a.subject,
      actor: owner ?? undefined,
      pending: a.type === "task" && !a.completedAt,
      due: a.dueAt?.toISOString(),
    })),
    ...audits.map(({ l, actor }) => ({ id: `l${l.id}`, at: l.at.toISOString(), kind: "audit" as const, title: l.summary ?? l.action, actor: actor ?? undefined })),
  ];
  return items.sort((x, y) => (x.pending === y.pending ? y.at.localeCompare(x.at) : x.pending ? -1 : 1)).slice(0, 40);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TABLE_FOR: Record<string, any> = { companies, contacts, leads, deals, products, inventory, "sales-orders": salesOrders, "purchase-orders": purchaseOrders, invoices, payments };

export async function getDetail(entity: string, id: number): Promise<RecordDetail | null> {
  const ent = getEntityServer(entity);
  const table = TABLE_FOR[entity];
  if (!ent || !table || !Number.isInteger(id) || id <= 0) return null;
  const db = await getDb();
  const keys = ent.meta.fields.map((f) => f.key);
  const [[row], [raw], options] = await Promise.all([
    db.select(selectionFor(ent, keys)).from(ent.table).where(eq(ent.id, id)) as unknown as Promise<(Record<string, unknown> & { id: number })[]>,
    db.select().from(table).where(eq(table.id, id)) as Promise<Record<string, unknown>[]>,
    ent.options ? ent.options(db) : Promise.resolve({}),
  ]);
  if (!row) return null;
  const [secs, tl, wf] = await Promise.all([sections(db, entity, id, row), timeline(db, entity, id), workflow(db, entity, id)]);
  const primary = ent.meta.fields.find((f) => f.primary)!;
  const form = forms[entity];
  const formValues = form ? Object.fromEntries(form.fields.map((f) => [f.key, raw[f.key] ?? null])) : null;
  return { entity, id, title: String(row[primary.key]), row, options, sections: secs, timeline: tl, formValues, editable: !!form && wf.editable, actions: wf.actions, lines: wf.lines, context: wf.context };
}
