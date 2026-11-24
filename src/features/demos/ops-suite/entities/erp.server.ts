import { sql } from "drizzle-orm";
import { inventory, invoices, payments, products, purchaseOrders, salesOrders } from "../db/schema";
import { istDate, outer, type EntityServer } from "../filters/toSql";
import { inventoryMeta, invoicesMeta, paymentsMeta, productsMeta, purchaseOrdersMeta, salesOrdersMeta } from "./erp";
import { loadAllUsers, loadCompanies, loadOwners, loadSuppliers, loadWarehouses } from "./options.server";

/** ERP list configs. Every outer-row reference inside a subquery goes through outer(). Server-only. */

const today = sql`(now() at time zone 'Asia/Kolkata')::date`;
const num = (q: ReturnType<typeof sql>) => q.mapWith(Number);
const userLabel = (col: Parameters<typeof outer>[0]) => sql<string>`(select u.name from users u where u.id = ${outer(col)})`;
const whLabel = (col: Parameters<typeof outer>[0]) => sql<string>`(select w.code || ' · ' || w.name from warehouses w where w.id = ${outer(col)})`;
const companyLabel = (col: Parameters<typeof outer>[0]) => sql<string>`(select c.name from companies c where c.id = ${outer(col)})`;

// ── products ────────────────────────────────────────────────────────────────
const pid = outer(products.id);
export const productsServer: EntityServer = {
  meta: productsMeta,
  table: products,
  id: products.id,
  fields: {
    name: { expr: products.name, searchable: true },
    sku: { expr: products.sku, searchable: true },
    category: { expr: products.category },
    price: { expr: products.price },
    cost: { expr: products.cost },
    margin: { expr: num(sql`round((${outer(products.price)} - ${outer(products.cost)}) / nullif(${outer(products.price)}, 0) * 100, 1)`) },
    gstRate: { expr: products.gstRate },
    unit: { expr: products.unit },
    onHand: { expr: num(sql`(select coalesce(sum(i.qty_on_hand), 0) from inventory i where i.product_id = ${pid})`) },
    available: { expr: num(sql`(select coalesce(sum(i.qty_on_hand - i.qty_reserved), 0) from inventory i where i.product_id = ${pid})`) },
    lowLocations: { expr: num(sql`(select count(*) from inventory i where i.product_id = ${pid} and i.reorder_level > 0 and i.qty_on_hand - i.qty_reserved < i.reorder_level)`) },
    sold90d: {
      expr: num(sql`(select coalesce(sum(l.qty), 0) from sales_order_lines l join sales_orders so on so.id = l.sales_order_id where l.product_id = ${pid} and so.status <> 'cancelled' and so.order_date > ${today} - 90)`),
    },
    revenue90d: {
      expr: num(sql`(select coalesce(sum(l.line_total), 0) from sales_order_lines l join sales_orders so on so.id = l.sales_order_id where l.product_id = ${pid} and so.status <> 'cancelled' and so.order_date > ${today} - 90)`),
    },
    hsnCode: { expr: products.hsnCode, searchable: true },
    active: { expr: products.active },
    createdAt: { expr: istDate(products.createdAt), select: products.createdAt },
  },
};

// ── inventory ───────────────────────────────────────────────────────────────
const avail = sql`(${outer(inventory.qtyOnHand)} - ${outer(inventory.qtyReserved)})`;
export const inventoryServer: EntityServer = {
  meta: inventoryMeta,
  table: inventory,
  id: inventory.id,
  fields: {
    productName: { expr: sql<string>`(select p.name from products p where p.id = ${outer(inventory.productId)})`, searchable: true },
    sku: { expr: sql<string>`(select p.sku from products p where p.id = ${outer(inventory.productId)})`, searchable: true },
    warehouse: { expr: inventory.warehouseId, label: whLabel(inventory.warehouseId) },
    category: { expr: sql`(select p.category from products p where p.id = ${outer(inventory.productId)})` },
    status: { expr: sql`(case when ${outer(inventory.qtyOnHand)} = 0 then 'out' when ${avail} < ${outer(inventory.reorderLevel)} then 'low' else 'ok' end)` },
    qtyOnHand: { expr: inventory.qtyOnHand },
    qtyReserved: { expr: inventory.qtyReserved },
    available: { expr: num(avail) },
    reorderLevel: { expr: inventory.reorderLevel },
    cover: { expr: num(sql`round(${avail}::numeric / nullif(${outer(inventory.reorderLevel)}, 0), 2)`) },
    onOrder: {
      expr: num(sql`(select coalesce(sum(pol.qty - pol.qty_received), 0) from purchase_order_lines pol join purchase_orders po on po.id = pol.purchase_order_id
        where pol.product_id = ${outer(inventory.productId)} and po.warehouse_id = ${outer(inventory.warehouseId)} and po.status in ('draft', 'sent', 'partially_received'))`),
    },
    stockValue: { expr: num(sql`(${outer(inventory.qtyOnHand)} * (select p.cost from products p where p.id = ${outer(inventory.productId)}))`) },
    updatedAt: { expr: istDate(inventory.updatedAt), select: inventory.updatedAt },
  },
  options: async (db) => ({ warehouse: await loadWarehouses(db) }),
};

// ── sales orders ────────────────────────────────────────────────────────────
const soId = outer(salesOrders.id);
export const salesOrdersServer: EntityServer = {
  meta: salesOrdersMeta,
  table: salesOrders,
  id: salesOrders.id,
  fields: {
    number: { expr: salesOrders.number, searchable: true },
    company: { expr: salesOrders.companyId, label: companyLabel(salesOrders.companyId) },
    companySearch: { expr: companyLabel(salesOrders.companyId), searchable: true },
    status: { expr: salesOrders.status },
    invoice: { expr: sql`coalesce((select i.status::text from invoices i where i.sales_order_id = ${soId}), 'none')` },
    orderDate: { expr: salesOrders.orderDate },
    total: { expr: salesOrders.total },
    subtotal: { expr: salesOrders.subtotal },
    lines: { expr: num(sql`(select count(*) from sales_order_lines l where l.sales_order_id = ${soId})`) },
    warehouse: { expr: salesOrders.warehouseId, label: whLabel(salesOrders.warehouseId) },
    owner: { expr: salesOrders.ownerId, label: userLabel(salesOrders.ownerId) },
    deal: { expr: sql<string>`(select d.title from deals d where d.id = ${outer(salesOrders.dealId)})`, searchable: true },
    fulfilledAt: { expr: istDate(salesOrders.fulfilledAt), select: salesOrders.fulfilledAt },
  },
  options: async (db) => {
    const [company, warehouse, owner] = await Promise.all([loadCompanies(db), loadWarehouses(db), loadOwners(db)]);
    return { company, warehouse, owner };
  },
};

// ── purchase orders ─────────────────────────────────────────────────────────
const poId = outer(purchaseOrders.id);
const supplierLabel = sql<string>`(select s.name from suppliers s where s.id = ${outer(purchaseOrders.supplierId)})`;
export const purchaseOrdersServer: EntityServer = {
  meta: purchaseOrdersMeta,
  table: purchaseOrders,
  id: purchaseOrders.id,
  fields: {
    number: { expr: purchaseOrders.number, searchable: true },
    supplier: { expr: purchaseOrders.supplierId, label: supplierLabel },
    supplierSearch: { expr: supplierLabel, searchable: true },
    status: { expr: purchaseOrders.status },
    warehouse: { expr: purchaseOrders.warehouseId, label: whLabel(purchaseOrders.warehouseId) },
    orderDate: { expr: purchaseOrders.orderDate },
    expectedDate: { expr: purchaseOrders.expectedDate },
    late: { expr: sql<boolean>`(${outer(purchaseOrders.status)} in ('sent', 'partially_received') and ${outer(purchaseOrders.expectedDate)} < ${today})` },
    total: { expr: purchaseOrders.total },
    lines: { expr: num(sql`(select count(*) from purchase_order_lines l where l.purchase_order_id = ${poId})`) },
    receivedAt: { expr: istDate(purchaseOrders.receivedAt), select: purchaseOrders.receivedAt },
    createdBy: { expr: purchaseOrders.createdBy, label: userLabel(purchaseOrders.createdBy) },
  },
  options: async (db) => {
    const [supplier, warehouse, createdBy] = await Promise.all([loadSuppliers(db), loadWarehouses(db), loadAllUsers(db)]);
    return { supplier, warehouse, createdBy };
  },
};

// ── invoices ────────────────────────────────────────────────────────────────
const unpaid = sql`(${outer(invoices.status)} in ('sent', 'partially_paid'))`;
const overdueDays = sql`(${today} - ${outer(invoices.dueDate)})`;
export const invoicesServer: EntityServer = {
  meta: invoicesMeta,
  table: invoices,
  id: invoices.id,
  fields: {
    number: { expr: invoices.number, searchable: true },
    company: { expr: invoices.companyId, label: companyLabel(invoices.companyId) },
    companySearch: { expr: companyLabel(invoices.companyId), searchable: true },
    status: { expr: invoices.status },
    aging: {
      expr: sql`(case when not ${unpaid} then null when ${overdueDays} <= 0 then 'not_due' when ${overdueDays} <= 30 then '1_30' when ${overdueDays} <= 60 then '31_60' when ${overdueDays} <= 90 then '61_90' else '90_plus' end)`,
    },
    issueDate: { expr: invoices.issueDate },
    dueDate: { expr: invoices.dueDate },
    daysOverdue: { expr: num(sql`(case when ${unpaid} and ${overdueDays} > 0 then ${overdueDays} else 0 end)`) },
    total: { expr: invoices.total },
    balance: { expr: num(sql`(case when ${outer(invoices.status)} = 'void' then 0 else ${outer(invoices.total)} - ${outer(invoices.amountPaid)} end)`) },
    amountPaid: { expr: invoices.amountPaid },
    owner: {
      expr: sql`(select c.owner_id from companies c where c.id = ${outer(invoices.companyId)})`,
      label: sql<string>`(select u.name from companies c join users u on u.id = c.owner_id where c.id = ${outer(invoices.companyId)})`,
    },
    order: { expr: sql<string>`(select so.number from sales_orders so where so.id = ${outer(invoices.salesOrderId)})`, searchable: true },
  },
  options: async (db) => {
    const [company, owner] = await Promise.all([loadCompanies(db), loadOwners(db)]);
    return { company, owner };
  },
};

// ── payments ────────────────────────────────────────────────────────────────
const invOf = outer(payments.invoiceId);
export const paymentsServer: EntityServer = {
  meta: paymentsMeta,
  table: payments,
  id: payments.id,
  fields: {
    invoice: { expr: sql<string>`(select i.number from invoices i where i.id = ${invOf})`, searchable: true },
    company: {
      expr: sql`(select i.company_id from invoices i where i.id = ${invOf})`,
      label: sql<string>`(select c.name from invoices i join companies c on c.id = i.company_id where i.id = ${invOf})`,
    },
    companySearch: { expr: sql<string>`(select c.name from invoices i join companies c on c.id = i.company_id where i.id = ${invOf})`, searchable: true },
    amount: { expr: payments.amount },
    method: { expr: payments.method },
    reference: { expr: payments.reference, searchable: true },
    paidAt: { expr: istDate(payments.paidAt), select: payments.paidAt },
    daysToPay: { expr: num(sql`((${outer(payments.paidAt)} at time zone 'Asia/Kolkata')::date - (select i.issue_date from invoices i where i.id = ${invOf}))`) },
  },
  options: async (db) => ({ company: await loadCompanies(db) }),
};
