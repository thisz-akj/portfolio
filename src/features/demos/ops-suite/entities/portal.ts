import type { EntityMeta, Option } from "../filters/types";
import { PORTAL_BASE } from "../nav";

/** Client-safe metadata for the data portal (datasets, import jobs) and the audit log. */

const opt = (value: string, label: string, color?: string): Option => ({ value, label, color });
const and = (...conditions: NonNullable<EntityMeta["views"][number]["query"]["filter"]>["conditions"]) => ({ combinator: "and" as const, conditions });

export const DATASET_SOURCE = [opt("csv", "CSV upload"), opt("api", "API pull"), opt("webhook", "Webhook")];
export const TARGET = [opt("leads", "Leads"), opt("products", "Products"), opt("invoices", "Payments → invoices"), opt("inventory", "Stock levels")];
export const IMPORT_STATUS = [opt("succeeded", "Succeeded", "#4ade80"), opt("partial", "Partial", "#fbbf24"), opt("failed", "Failed", "#f87171"), opt("running", "Running", "#a0c4ff"), opt("queued", "Queued", "#6b6b6b")];

export const datasetsMeta: EntityMeta = {
  key: "datasets",
  label: "Datasets",
  singular: "dataset",
  statusField: "source",
  defaultSort: [{ field: "lastImportAt", dir: "desc" }],
  fields: [
    { key: "name", label: "Dataset", type: "text", primary: true, visible: true },
    { key: "source", label: "Source", type: "enum", options: DATASET_SOURCE, facet: true, visible: true },
    { key: "target", label: "Feeds", type: "enum", options: TARGET, facet: true, visible: true },
    { key: "lastStatus", label: "Last run", type: "enum", options: IMPORT_STATUS, visible: true },
    { key: "lastImportAt", label: "Last import", type: "date", visible: true },
    { key: "jobs30d", label: "Runs (30 d)", type: "number", align: "end", visible: true },
    { key: "rows30d", label: "Rows in (30 d)", type: "number", align: "end", visible: true },
    { key: "rejectRate", label: "Rejected (30 d)", type: "number", align: "end", unit: "%", visible: true },
    { key: "description", label: "Description", type: "text" },
  ],
  views: [{ id: "all", label: "All datasets", query: {} }],
};

export const importsMeta: EntityMeta = {
  key: "imports",
  label: "Imports",
  singular: "import",
  statusField: "status",
  defaultSort: [{ field: "startedAt", dir: "desc" }],
  fields: [
    { key: "label", label: "Run", type: "text", primary: true, visible: true },
    { key: "dataset", label: "Dataset", type: "relation", dynamicOptions: true, labelKey: "datasetName", facet: true, visible: true },
    { key: "status", label: "Status", type: "enum", options: IMPORT_STATUS, facet: true, visible: true },
    { key: "rowsTotal", label: "Rows", type: "number", align: "end", visible: true },
    { key: "rowsOk", label: "Imported", type: "number", align: "end", visible: true },
    { key: "rowsFailed", label: "Rejected", type: "number", align: "end", visible: true },
    { key: "durationS", label: "Took", type: "number", align: "end", unit: "s" },
    { key: "error", label: "Error", type: "text" },
    { key: "createdBy", label: "Run by", type: "relation", dynamicOptions: true, labelKey: "createdByName", facet: true },
    { key: "startedAt", label: "Started", type: "date", visible: true },
  ],
  views: [
    { id: "all", label: "All runs", query: {} },
    { id: "problems", label: "Failed or partial", query: { filter: and({ field: "status", op: "in", value: ["failed", "partial"] }) } },
    { id: "week", label: "Last 7 days", query: { filter: and({ field: "startedAt", op: "within_last", value: 7 }) } },
  ],
};

export const AUDIT_ENTITY = [
  opt("companies", "Company"),
  opt("contacts", "Contact"),
  opt("leads", "Lead"),
  opt("deals", "Deal"),
  opt("products", "Product"),
  opt("inventory", "Stock"),
  opt("sales_orders", "Sales order"),
  opt("purchase_orders", "Purchase order"),
  opt("invoices", "Invoice"),
  opt("import_jobs", "Import"),
];
const SLUG: Record<string, string> = { sales_orders: "sales-orders", purchase_orders: "purchase-orders", import_jobs: "imports" };

export const auditMeta: EntityMeta = {
  key: "audit-log",
  label: "Audit log",
  singular: "audit event",
  defaultSort: [{ field: "at", dir: "desc" }],
  alwaysSelect: ["entity", "entityId"],
  rowHref: (r) => (r.entity && r.entityId ? `${PORTAL_BASE}/${SLUG[String(r.entity)] ?? r.entity}/${r.entityId}` : null),
  fields: [
    { key: "summary", label: "What happened", type: "text", primary: true, visible: true },
    { key: "entity", label: "Record type", type: "enum", options: AUDIT_ENTITY, facet: true, visible: true },
    { key: "action", label: "Action", type: "text", visible: true },
    { key: "actor", label: "By", type: "relation", dynamicOptions: true, labelKey: "actorName", facet: true, visible: true },
    { key: "at", label: "When", type: "date", visible: true },
    { key: "entityId", label: "Record id", type: "text" },
  ],
  views: [
    { id: "all", label: "Everything", query: {} },
    { id: "today", label: "Today", query: { filter: and({ field: "at", op: "preset", value: "today" }) } },
    { id: "deals", label: "Deals won or lost", query: { filter: and({ field: "action", op: "starts_with", value: "deal." }) } },
    { id: "money", label: "Payments received", query: { filter: and({ field: "action", op: "eq", value: "payment.received" }) } },
    { id: "automation", label: "Automations (auto-reorder, orders from deals)", query: { filter: { combinator: "or", conditions: [{ field: "action", op: "starts_with", value: "purchase_order.auto" }, { field: "action", op: "eq", value: "sales_order.created" }] } } },
  ],
};
