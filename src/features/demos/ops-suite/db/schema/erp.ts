import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, money, updatedAt } from "./columns";
import { users } from "./core";
import { companies, deals } from "./crm";

/** ERP: catalogue, stock, purchasing, sales orders, invoicing, payments. All money in ₹ (GST-inclusive totals). */

export const productCategoryEnum = pgEnum("product_category", [
  "fasteners",
  "bearings",
  "electrical",
  "hydraulics",
  "safety",
  "packaging",
  "tools",
  "pipes_fittings",
  "lubricants",
  "adhesives",
]);
export const unitEnum = pgEnum("unit", ["pcs", "box", "kg", "litre", "metre", "set", "roll"]);
export const poStatusEnum = pgEnum("po_status", ["draft", "sent", "partially_received", "received", "cancelled"]);
export const soStatusEnum = pgEnum("so_status", ["draft", "confirmed", "fulfilled", "cancelled"]);
/** "overdue" is not stored: it is derived from due_date < today on unpaid invoices. */
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "partially_paid", "paid", "void"]);
export const paymentMethodEnum = pgEnum("payment_method", ["neft", "rtgs", "upi", "cheque", "card"]);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    category: productCategoryEnum("category").notNull(),
    unit: unitEnum("unit").notNull(),
    price: money("price").notNull(), // list price, ex-GST
    cost: money("cost").notNull(),
    gstRate: smallint("gst_rate").notNull(), // 5 | 12 | 18 | 28
    hsnCode: text("hsn_code").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("products_category_idx").on(t.category)],
);

export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
});

export const inventory = pgTable(
  "inventory",
  {
    /** surrogate id for list/detail views; the natural key is (product, warehouse) */
    id: serial("id").notNull().unique(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    warehouseId: integer("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    qtyOnHand: integer("qty_on_hand").notNull().default(0),
    qtyReserved: integer("qty_reserved").notNull().default(0),
    reorderLevel: integer("reorder_level").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.warehouseId] }),
    check("inventory_non_negative", sql`${t.qtyOnHand} >= 0 and ${t.qtyReserved} >= 0`),
  ],
);

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  gstin: text("gstin").unique(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  paymentTermsDays: smallint("payment_terms_days").notNull().default(30),
  rating: smallint("rating").notNull().default(3), // 1–5
  createdAt: createdAt(),
});

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: serial("id").primaryKey(),
    number: text("number").notNull().unique(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    warehouseId: integer("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    status: poStatusEnum("status").notNull().default("draft"),
    orderDate: date("order_date", { mode: "string" }).notNull(),
    expectedDate: date("expected_date", { mode: "string" }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    subtotal: money("subtotal").notNull(),
    tax: money("tax").notNull(),
    total: money("total").notNull(),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("po_status_idx").on(t.status),
    index("po_supplier_idx").on(t.supplierId),
    index("po_order_date_idx").on(t.orderDate),
  ],
);

export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    id: serial("id").primaryKey(),
    purchaseOrderId: integer("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    qty: integer("qty").notNull(),
    qtyReceived: integer("qty_received").notNull().default(0),
    unitCost: money("unit_cost").notNull(),
    gstRate: smallint("gst_rate").notNull(),
  },
  (t) => [index("pol_po_idx").on(t.purchaseOrderId), check("pol_qty_positive", sql`${t.qty} > 0`)],
);

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: serial("id").primaryKey(),
    number: text("number").notNull().unique(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id),
    dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }),
    warehouseId: integer("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    status: soStatusEnum("status").notNull().default("draft"),
    orderDate: date("order_date", { mode: "string" }).notNull(),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    subtotal: money("subtotal").notNull(),
    tax: money("tax").notNull(),
    total: money("total").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("so_status_idx").on(t.status),
    index("so_company_idx").on(t.companyId),
    index("so_order_date_idx").on(t.orderDate),
    index("so_deal_idx").on(t.dealId),
  ],
);

export const salesOrderLines = pgTable(
  "sales_order_lines",
  {
    id: serial("id").primaryKey(),
    salesOrderId: integer("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    qty: integer("qty").notNull(),
    unitPrice: money("unit_price").notNull(),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
    gstRate: smallint("gst_rate").notNull(),
    lineTotal: money("line_total").notNull(), // ex-GST, after discount
  },
  (t) => [index("sol_so_idx").on(t.salesOrderId), check("sol_qty_positive", sql`${t.qty} > 0`)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    number: text("number").notNull().unique(),
    salesOrderId: integer("sales_order_id")
      .notNull()
      .unique()
      .references(() => salesOrders.id),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    subtotal: money("subtotal").notNull(),
    tax: money("tax").notNull(),
    total: money("total").notNull(),
    amountPaid: money("amount_paid").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("invoices_status_idx").on(t.status),
    index("invoices_company_idx").on(t.companyId),
    index("invoices_due_idx").on(t.dueDate),
    check("invoices_paid_le_total", sql`${t.amountPaid} <= ${t.total}`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    method: paymentMethodEnum("method").notNull(),
    reference: text("reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId), index("payments_paid_at_idx").on(t.paidAt)],
);
