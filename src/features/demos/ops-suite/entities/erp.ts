import type { EntityMeta } from "../filters/types";
import { AGING, CATEGORY, GST_RATE, INVOICE_STATUS, ORDER_INVOICE, PAYMENT_METHOD, PO_STATUS, SO_STATUS, STOCK_STATUS, UNIT } from "./erp-options";

/** Client-safe metadata for the ERP lists. SQL lives in erp.server.ts. */

const and = (...conditions: NonNullable<EntityMeta["views"][number]["query"]["filter"]>["conditions"]) => ({ combinator: "and" as const, conditions });

export const productsMeta: EntityMeta = {
  key: "products",
  statusField: "category",
  label: "Products",
  singular: "product",
  defaultSort: [{ field: "revenue90d", dir: "desc" }],
  fields: [
    { key: "name", label: "Product", type: "text", primary: true, visible: true },
    { key: "sku", label: "SKU", type: "text", visible: true },
    { key: "category", label: "Category", type: "enum", options: CATEGORY, facet: true, visible: true },
    { key: "price", label: "Price", type: "money", align: "end", visible: true, description: "List price per unit, ex-GST" },
    { key: "cost", label: "Cost", type: "money", align: "end" },
    { key: "margin", label: "Margin", type: "number", align: "end", unit: "%", visible: true },
    { key: "gstRate", label: "GST", type: "enum", options: GST_RATE, facet: true },
    { key: "unit", label: "Unit", type: "enum", options: UNIT },
    { key: "onHand", label: "On hand", type: "number", align: "end", visible: true, description: "Across all warehouses" },
    { key: "available", label: "Available", type: "number", align: "end", visible: true, description: "On hand minus reserved for confirmed orders" },
    { key: "lowLocations", label: "Low at", type: "number", align: "end", unit: "DCs", visible: true, description: "Warehouses below reorder level" },
    { key: "sold90d", label: "Sold (90 d)", type: "number", align: "end" },
    { key: "revenue90d", label: "Sales (90 d)", type: "money", align: "end", visible: true, description: "Ex-GST line value, last 90 days, excluding cancelled orders" },
    { key: "hsnCode", label: "HSN", type: "text" },
    { key: "active", label: "Active", type: "boolean" },
    { key: "createdAt", label: "Created", type: "date" },
  ],
  views: [
    { id: "all", label: "All products", query: {} },
    { id: "low", label: "Below reorder somewhere", query: { filter: and({ field: "lowLocations", op: "gt", value: 0 }), sort: [{ field: "lowLocations", dir: "desc" }] } },
    { id: "best", label: "Best sellers (90 days)", query: { sort: [{ field: "revenue90d", dir: "desc" }] } },
    { id: "thin", label: "Margin under 25%", query: { filter: and({ field: "margin", op: "lt", value: 25 }), sort: [{ field: "margin", dir: "asc" }] } },
    { id: "inactive", label: "Inactive", query: { filter: and({ field: "active", op: "is_false" }) } },
  ],
};

export const inventoryMeta: EntityMeta = {
  key: "inventory",
  statusField: "status",
  label: "Inventory",
  singular: "stock record",
  defaultSort: [{ field: "cover", dir: "asc" }],
  fields: [
    { key: "productName", label: "Product", type: "text", primary: true, visible: true },
    { key: "sku", label: "SKU", type: "text", visible: true },
    { key: "warehouse", label: "Warehouse", type: "relation", dynamicOptions: true, labelKey: "warehouseName", facet: true, visible: true },
    { key: "category", label: "Category", type: "enum", options: CATEGORY, facet: true },
    { key: "status", label: "Status", type: "enum", options: STOCK_STATUS, facet: true, visible: true },
    { key: "qtyOnHand", label: "On hand", type: "number", align: "end", visible: true },
    { key: "qtyReserved", label: "Reserved", type: "number", align: "end", visible: true },
    { key: "available", label: "Available", type: "number", align: "end", visible: true },
    { key: "reorderLevel", label: "Reorder at", type: "number", align: "end", visible: true },
    { key: "cover", label: "Cover", type: "number", align: "end", unit: "× reorder", visible: true, description: "Available ÷ reorder level — under 1 means reorder" },
    { key: "onOrder", label: "On order", type: "number", align: "end", description: "Open purchase-order quantity not yet received" },
    { key: "stockValue", label: "Stock value", type: "money", align: "end", description: "On hand × unit cost" },
    { key: "updatedAt", label: "Updated", type: "date" },
  ],
  views: [
    { id: "all", label: "All stock", query: {} },
    { id: "reorder", label: "Needs reorder", query: { filter: and({ field: "status", op: "in", value: ["low", "out"] }), sort: [{ field: "cover", dir: "asc" }] } },
    { id: "uncovered", label: "Low with nothing on order", query: { filter: and({ field: "status", op: "in", value: ["low", "out"] }, { field: "onOrder", op: "eq", value: 0 }) } },
    { id: "value", label: "Highest stock value", query: { sort: [{ field: "stockValue", dir: "desc" }], cols: ["productName", "warehouse", "qtyOnHand", "stockValue", "cover"] } },
  ],
};

export const salesOrdersMeta: EntityMeta = {
  key: "sales-orders",
  statusField: "status",
  label: "Sales orders",
  singular: "sales order",
  defaultSort: [{ field: "orderDate", dir: "desc" }],
  fields: [
    { key: "number", label: "Order", type: "text", primary: true, visible: true },
    { key: "company", label: "Customer", type: "relation", dynamicOptions: true, labelKey: "companyName", visible: true },
    { key: "status", label: "Status", type: "enum", options: SO_STATUS, facet: true, visible: true },
    { key: "invoice", label: "Invoice", type: "enum", options: ORDER_INVOICE, facet: true, visible: true },
    { key: "orderDate", label: "Order date", type: "date", visible: true },
    { key: "total", label: "Total", type: "money", align: "end", visible: true, description: "Incl. GST" },
    { key: "subtotal", label: "Subtotal", type: "money", align: "end" },
    { key: "lines", label: "Lines", type: "number", align: "end" },
    { key: "warehouse", label: "Ships from", type: "relation", dynamicOptions: true, labelKey: "warehouseName", facet: true, visible: true },
    { key: "owner", label: "Owner", type: "relation", dynamicOptions: true, labelKey: "ownerName", facet: true },
    { key: "deal", label: "From deal", type: "text" },
    { key: "fulfilledAt", label: "Fulfilled", type: "date" },
  ],
  views: [
    { id: "all", label: "All orders", query: {} },
    { id: "open", label: "Open (draft + confirmed)", query: { filter: and({ field: "status", op: "in", value: ["draft", "confirmed"] }), sort: [{ field: "orderDate", dir: "asc" }] } },
    { id: "to-fulfil", label: "Ready to fulfil", query: { filter: and({ field: "status", op: "in", value: ["confirmed"] }), sort: [{ field: "orderDate", dir: "asc" }] } },
    { id: "from-deals", label: "Drafts from won deals", query: { filter: and({ field: "status", op: "in", value: ["draft"] }, { field: "deal", op: "is_not_empty" }) } },
    { id: "month", label: "This month", query: { filter: and({ field: "orderDate", op: "preset", value: "this_month" }) } },
  ],
};

export const purchaseOrdersMeta: EntityMeta = {
  key: "purchase-orders",
  statusField: "status",
  label: "Purchase orders",
  singular: "purchase order",
  defaultSort: [{ field: "orderDate", dir: "desc" }],
  fields: [
    { key: "number", label: "PO", type: "text", primary: true, visible: true },
    { key: "supplier", label: "Supplier", type: "relation", dynamicOptions: true, labelKey: "supplierName", visible: true },
    { key: "status", label: "Status", type: "enum", options: PO_STATUS, facet: true, visible: true },
    { key: "warehouse", label: "Deliver to", type: "relation", dynamicOptions: true, labelKey: "warehouseName", facet: true, visible: true },
    { key: "orderDate", label: "Ordered", type: "date", visible: true },
    { key: "expectedDate", label: "Expected", type: "date", visible: true },
    { key: "late", label: "Late", type: "boolean", visible: true, description: "Sent or part-received and past its expected date" },
    { key: "total", label: "Total", type: "money", align: "end", visible: true },
    { key: "lines", label: "Lines", type: "number", align: "end" },
    { key: "receivedAt", label: "Received", type: "date" },
    { key: "createdBy", label: "Raised by", type: "relation", dynamicOptions: true, labelKey: "createdByName", facet: true },
  ],
  views: [
    { id: "all", label: "All purchase orders", query: {} },
    { id: "open", label: "Open", query: { filter: and({ field: "status", op: "in", value: ["draft", "sent", "partially_received"] }) } },
    { id: "late", label: "Late deliveries", query: { filter: and({ field: "late", op: "is_true" }), sort: [{ field: "expectedDate", dir: "asc" }] } },
    { id: "drafts", label: "Drafts to send", query: { filter: and({ field: "status", op: "in", value: ["draft"] }) } },
    { id: "received-month", label: "Received this month", query: { filter: and({ field: "receivedAt", op: "preset", value: "this_month" }) } },
  ],
};

export const invoicesMeta: EntityMeta = {
  key: "invoices",
  statusField: "status",
  label: "Invoices",
  singular: "invoice",
  defaultSort: [{ field: "issueDate", dir: "desc" }],
  fields: [
    { key: "number", label: "Invoice", type: "text", primary: true, visible: true },
    { key: "company", label: "Customer", type: "relation", dynamicOptions: true, labelKey: "companyName", visible: true },
    { key: "status", label: "Status", type: "enum", options: INVOICE_STATUS, facet: true, visible: true },
    { key: "aging", label: "Aging", type: "enum", options: AGING, facet: true, visible: true, description: "Unpaid balance by days past due" },
    { key: "issueDate", label: "Issued", type: "date", visible: true },
    { key: "dueDate", label: "Due", type: "date", visible: true },
    { key: "daysOverdue", label: "Days overdue", type: "number", align: "end" },
    { key: "total", label: "Total", type: "money", align: "end", visible: true },
    { key: "balance", label: "Balance", type: "money", align: "end", visible: true },
    { key: "amountPaid", label: "Paid", type: "money", align: "end" },
    { key: "owner", label: "Account owner", type: "relation", dynamicOptions: true, labelKey: "ownerName", facet: true },
    { key: "order", label: "Order", type: "text" },
  ],
  views: [
    { id: "all", label: "All invoices", query: {} },
    { id: "unpaid", label: "Unpaid", query: { filter: and({ field: "balance", op: "gt", value: 0 }, { field: "status", op: "in", value: ["sent", "partially_paid"] }), sort: [{ field: "dueDate", dir: "asc" }] } },
    { id: "overdue", label: "Overdue", query: { filter: and({ field: "daysOverdue", op: "gt", value: 0 }), sort: [{ field: "daysOverdue", dir: "desc" }] } },
    { id: "90plus", label: "90+ days overdue", query: { filter: and({ field: "aging", op: "in", value: ["90_plus"] }), sort: [{ field: "balance", dir: "desc" }] } },
    { id: "due-soon", label: "Due in the next 7 days", query: { filter: and({ field: "dueDate", op: "preset", value: "next_7_days" }, { field: "balance", op: "gt", value: 0 }) } },
  ],
};

export const paymentsMeta: EntityMeta = {
  key: "payments",
  statusField: "method",
  label: "Payments",
  singular: "payment",
  defaultSort: [{ field: "paidAt", dir: "desc" }],
  fields: [
    { key: "invoice", label: "Invoice", type: "text", primary: true, visible: true },
    { key: "company", label: "Customer", type: "relation", dynamicOptions: true, labelKey: "companyName", visible: true },
    { key: "amount", label: "Amount", type: "money", align: "end", visible: true },
    { key: "method", label: "Method", type: "enum", options: PAYMENT_METHOD, facet: true, visible: true },
    { key: "reference", label: "Reference", type: "text", visible: true },
    { key: "paidAt", label: "Received", type: "date", visible: true },
    { key: "daysToPay", label: "Days after issue", type: "number", align: "end" },
  ],
  views: [
    { id: "all", label: "All payments", query: {} },
    { id: "month", label: "This month", query: { filter: and({ field: "paidAt", op: "preset", value: "this_month" }) } },
    { id: "large", label: "Over ₹10L", query: { filter: and({ field: "amount", op: "gt", value: 1_000_000 }), sort: [{ field: "amount", dir: "desc" }] } },
    { id: "cheques", label: "Cheques this quarter", query: { filter: and({ field: "method", op: "in", value: ["cheque"] }, { field: "paidAt", op: "preset", value: "this_quarter" }) } },
  ],
};
