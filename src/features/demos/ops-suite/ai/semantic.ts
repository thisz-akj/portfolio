import { INDUSTRY, LIFECYCLE, REGION, SIZE, STATES } from "../entities/companies";
import { DEAL_STAGE, LEAD_SOURCE, LEAD_STATUS } from "../entities/crm-options";
import { CATEGORY, INVOICE_STATUS, PAYMENT_METHOD, SO_STATUS } from "../entities/erp-options";
import { WAREHOUSES } from "../db/seed/reference";
import { DATE_PRESETS } from "../filters/types";

/**
 * The semantic layer: the only vocabulary "Ask Ops Suite" may use. Claude picks a metric, an optional dimension to
 * group by, dimension filters and a period; the server turns that into SQL from fixed fragments (semantic.server.ts).
 * Client-safe — it also feeds the system prompt, the plan validator, the UI and the Python eval contract.
 */

export type Fact = "orders" | "order_lines" | "invoices" | "deals" | "leads" | "payments" | "stock";
export type Unit = "inr" | "count" | "pct";

export interface MetricDef {
  key: string;
  label: string;
  fact: Fact;
  unit: Unit;
  description: string;
  /** dimension used for the period filter, or null when the metric is a snapshot (no time range) */
  timed: boolean;
}

export const METRICS: MetricDef[] = [
  { key: "orders_value", label: "Orders booked (₹)", fact: "orders", unit: "inr", timed: true, description: "Total value of sales orders incl. GST by order date, excluding cancelled. Use for sales/revenue/bookings questions." },
  { key: "orders_count", label: "Number of orders", fact: "orders", unit: "count", timed: true, description: "Count of sales orders by order date, excluding cancelled." },
  { key: "units_sold", label: "Units sold", fact: "order_lines", unit: "count", timed: true, description: "Quantity sold on order lines (excluding cancelled orders) by order date." },
  { key: "sales_ex_gst", label: "Line sales ex-GST (₹)", fact: "order_lines", unit: "inr", timed: true, description: "Order line value before GST, after discount. Use for product/category sales questions." },
  { key: "invoiced_value", label: "Invoiced (₹)", fact: "invoices", unit: "inr", timed: true, description: "Total of issued invoices (not void) by issue date." },
  { key: "outstanding", label: "Outstanding receivables (₹)", fact: "invoices", unit: "inr", timed: false, description: "Unpaid balance on sent and part-paid invoices right now (snapshot)." },
  { key: "overdue", label: "Overdue receivables (₹)", fact: "invoices", unit: "inr", timed: false, description: "Unpaid balance on invoices past their due date right now (snapshot)." },
  { key: "payments_received", label: "Payments received (₹)", fact: "payments", unit: "inr", timed: true, description: "Money received against invoices, by payment date." },
  { key: "pipeline_value", label: "Open pipeline (₹)", fact: "deals", unit: "inr", timed: false, description: "Value of open deals (new, qualified, proposal, negotiation) right now (snapshot)." },
  { key: "deals_won_value", label: "Deals won (₹)", fact: "deals", unit: "inr", timed: true, description: "Value of deals marked won, by close date." },
  { key: "deals_won_count", label: "Deals won", fact: "deals", unit: "count", timed: true, description: "Number of deals won, by close date." },
  { key: "deals_lost_count", label: "Deals lost", fact: "deals", unit: "count", timed: true, description: "Number of deals lost, by close date." },
  { key: "win_rate", label: "Win rate", fact: "deals", unit: "pct", timed: true, description: "Won ÷ (won + lost) for deals closed in the period." },
  { key: "new_leads", label: "New leads", fact: "leads", unit: "count", timed: true, description: "Leads created, by creation date." },
  { key: "stock_value", label: "Stock value (₹)", fact: "stock", unit: "inr", timed: false, description: "On-hand quantity × unit cost right now (snapshot)." },
  { key: "low_stock_items", label: "Stock rows below reorder", fact: "stock", unit: "count", timed: false, description: "Product × warehouse rows whose available stock is below the reorder level right now (snapshot)." },
];

export interface DimensionDef {
  key: string;
  label: string;
  /** facts this dimension is available on */
  facts: Fact[];
  /** fixed values (value + label) — free-text dimensions (company, owner, product, city) have none */
  values?: { value: string; label: string }[];
  description?: string;
}

const v = (opts: { value: string; label: string }[]) => opts.map(({ value, label }) => ({ value, label }));

export const DIMENSIONS: DimensionDef[] = [
  { key: "month", label: "Month", facts: ["orders", "order_lines", "invoices", "deals", "leads", "payments"], description: "Calendar month of the metric's date (YYYY-MM). Use for trends." },
  { key: "region", label: "Region", facts: ["orders", "order_lines", "invoices", "deals", "payments"], values: v(REGION) },
  { key: "state", label: "State", facts: ["orders", "invoices", "deals", "leads"], values: v(STATES) },
  { key: "industry", label: "Industry", facts: ["orders", "order_lines", "invoices", "deals", "payments"], values: v(INDUSTRY) },
  { key: "size", label: "Company size", facts: ["orders", "invoices", "deals"], values: v(SIZE) },
  { key: "lifecycle", label: "Company lifecycle", facts: ["orders", "invoices", "deals"], values: v(LIFECYCLE) },
  { key: "company", label: "Company", facts: ["orders", "order_lines", "invoices", "deals", "payments"], description: "Company name (free text, matched case-insensitively)." },
  { key: "owner", label: "Owner (sales rep)", facts: ["orders", "invoices", "deals", "leads"], description: "Sales rep's full name, e.g. 'Riya Mehta'. For invoices this is the account owner." },
  { key: "warehouse", label: "Warehouse", facts: ["orders", "order_lines", "stock"], values: WAREHOUSES.map((w) => ({ value: w.code, label: w.name })) },
  { key: "category", label: "Product category", facts: ["order_lines", "stock"], values: v(CATEGORY) },
  { key: "product", label: "Product", facts: ["order_lines", "stock"], description: "Product SKU (e.g. FAS-0003) or exact name." },
  { key: "order_status", label: "Order status", facts: ["orders"], values: v(SO_STATUS.filter((o) => o.value !== "cancelled")) },
  { key: "invoice_status", label: "Invoice status", facts: ["invoices"], values: v(INVOICE_STATUS.filter((o) => o.value !== "void")) },
  { key: "stage", label: "Deal stage", facts: ["deals"], values: v(DEAL_STAGE) },
  { key: "source", label: "Source", facts: ["deals", "leads"], values: v(LEAD_SOURCE) },
  { key: "lead_status", label: "Lead status", facts: ["leads"], values: v(LEAD_STATUS) },
  { key: "method", label: "Payment method", facts: ["payments"], values: v(PAYMENT_METHOD) },
  { key: "aging", label: "Aging bucket", facts: ["invoices"], values: [
    { value: "not_due", label: "Not yet due" },
    { value: "1_30", label: "1–30 days overdue" },
    { value: "31_60", label: "31–60 days overdue" },
    { value: "61_90", label: "61–90 days overdue" },
    { value: "90_plus", label: "90+ days overdue" },
  ] },
];

export const PERIODS = [...DATE_PRESETS.filter((p) => p !== "next_7_days" && p !== "next_30_days" && p !== "future"), "last_12_months", "all_time"] as const;
export type Period = (typeof PERIODS)[number];

export const metricOf = (key: string) => METRICS.find((m) => m.key === key);
export const dimensionOf = (key: string) => DIMENSIONS.find((d) => d.key === key);
export const dimensionsFor = (fact: Fact) => DIMENSIONS.filter((d) => d.facts.includes(fact));

/** Entities a "list" plan may open, and the fields it may filter on (see entities/*.ts for operators and values). */
export const LIST_ENTITIES = ["companies", "contacts", "leads", "deals", "products", "inventory", "sales-orders", "purchase-orders", "invoices", "payments"] as const;
