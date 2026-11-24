/**
 * Golden questions for evaluating "Ask Ops Suite". Each expected plan lists only the fields that decide correctness
 * (metric, groupBy, period, compare, filters — or entity + conditions); titles, wording, sort and limit aren't graded.
 * `alternatives` are other plans that are equally correct. `example: true` cases double as hand-written demo plans
 * when no API key is configured. Exported to ops-ai/contract.json for the Python eval harness.
 */

export type Expected =
  | { kind: "metric"; metric: string; groupBy: string | null; period: string; compare: "none" | "previous_period"; filters: [string, string[]][] }
  | { kind: "list"; entity: string; conditions: unknown[] }
  | { kind: "unsupported" };

export interface GoldenCase {
  id: string;
  question: string;
  expected: Expected;
  alternatives?: Expected[];
  example?: boolean;
  tags: string[];
}

const metric = (metric: string, groupBy: string | null, period: string, filters: [string, string[]][] = [], compare: "none" | "previous_period" = "none"): Expected => ({ kind: "metric", metric, groupBy, period, compare, filters });
const list = (entity: string, ...conditions: unknown[]): Expected => ({ kind: "list", entity, conditions });
const OPEN = ["new", "qualified", "proposal", "negotiation"];

export const GOLDEN: GoldenCase[] = [
  { id: "orders-last-month", question: "What were total orders booked last month?", expected: metric("orders_value", null, "last_month"), tags: ["metric", "simple"] },
  { id: "orders-count-month", question: "How many orders have we received this month?", expected: metric("orders_count", null, "this_month"), tags: ["metric", "simple"] },
  { id: "region-drop", question: "Which region's orders dropped the most last month compared with the month before?", expected: metric("orders_value", "region", "last_month", [], "previous_period"), example: true, tags: ["metric", "compare"] },
  { id: "trend-12m", question: "Show the monthly bookings trend for the last 12 months", expected: metric("orders_value", "month", "last_12_months"), example: true, tags: ["metric", "trend"] },
  { id: "top-customers-fy", question: "Top 5 customers by orders this financial year", expected: metric("orders_value", "company", "this_fy"), example: true, tags: ["metric", "ranking", "fy"] },
  { id: "category-sales", question: "Sales by product category in the last 90 days, before GST", expected: metric("sales_ex_gst", "category", "last_90_days"), tags: ["metric", "breakdown"] },
  { id: "owed-now", question: "How much do customers owe us right now?", expected: metric("outstanding", null, "all_time"), tags: ["metric", "snapshot"] },
  { id: "overdue-by-owner", question: "Overdue receivables by account owner", expected: metric("overdue", "owner", "all_time"), example: true, tags: ["metric", "snapshot", "breakdown"] },
  { id: "aging", question: "Break down what customers owe by how late it is", expected: metric("outstanding", "aging", "all_time"), tags: ["metric", "snapshot", "paraphrase"] },
  { id: "win-rate-q", question: "What's our win rate this quarter?", expected: metric("win_rate", null, "this_quarter"), tags: ["metric", "ratio", "fy"] },
  { id: "win-rate-rep", question: "Win rate by sales rep over the last 90 days", expected: metric("win_rate", "owner", "last_90_days"), example: true, tags: ["metric", "ratio", "breakdown"] },
  { id: "pipeline-stage", question: "Open pipeline by stage", expected: metric("pipeline_value", "stage", "all_time"), tags: ["metric", "snapshot"] },
  { id: "pipeline-auto", question: "How big is the open pipeline with automotive customers?", expected: metric("pipeline_value", null, "all_time", [["industry", ["automotive"]]]), tags: ["metric", "filter"] },
  { id: "marketplace-leads", question: "How many leads came in from the marketplace this month?", expected: metric("new_leads", null, "this_month", [["source", ["indiamart"]]]), tags: ["metric", "filter", "synonym"] },
  { id: "leads-by-source", question: "Leads by source last month", expected: metric("new_leads", "source", "last_month"), tags: ["metric", "breakdown"] },
  { id: "payments-method", question: "Payments received this month, split by payment method", expected: metric("payments_received", "method", "this_month"), tags: ["metric", "breakdown"] },
  { id: "stock-mumbai", question: "How much stock value is sitting in the Mumbai warehouse?", expected: metric("stock_value", null, "all_time", [["warehouse", ["BHW-01"]]]), tags: ["metric", "snapshot", "synonym"] },
  { id: "low-stock-category", question: "Which product categories have the most items below reorder level?", expected: metric("low_stock_items", "category", "all_time"), tags: ["metric", "snapshot", "ranking"] },
  {
    id: "bearings-units",
    question: "Units of bearings sold last month by warehouse",
    expected: metric("units_sold", "warehouse", "last_month", [["category", ["bearings"]]]),
    tags: ["metric", "filter", "breakdown"],
  },
  {
    id: "south-fy-compare",
    question: "Orders booked in South India this financial year versus the same time last year",
    expected: metric("orders_value", null, "this_fy", [["region", ["south"]]], "previous_period"),
    tags: ["metric", "compare", "synonym", "fy"],
  },
  { id: "riya-won", question: "Value of deals won by Riya Mehta last quarter", expected: metric("deals_won_value", null, "last_quarter", [["owner", ["Riya Mehta"]]]), tags: ["metric", "person", "fy"] },
  { id: "invoiced-industry", question: "Invoiced amount by industry this quarter", expected: metric("invoiced_value", "industry", "this_quarter"), tags: ["metric", "breakdown"] },
  {
    id: "overdue-big",
    question: "Show me overdue invoices over 5 lakh",
    expected: list("invoices", ["daysOverdue", "gt", 0], ["balance", "gt", 500000]),
    alternatives: [list("invoices", ["aging", "in", ["1_30", "31_60", "61_90", "90_plus"]], ["balance", "gt", 500000])],
    example: true,
    tags: ["list", "money", "lakh"],
  },
  { id: "closing-month", question: "Open deals closing this month", expected: list("deals", ["stage", "in", OPEN], ["expectedClose", "preset", "this_month"]), example: true, tags: ["list", "date"] },
  { id: "unassigned-leads", question: "List new leads that nobody owns yet", expected: list("leads", ["owner", "is_empty"], ["status", "in", ["new"]]), tags: ["list", "empty"] },
  { id: "gujarat-customers", question: "Companies in Gujarat that are customers", expected: list("companies", ["state", "in", ["Gujarat"]], ["lifecycle", "in", ["customer"]]), tags: ["list", "enum"] },
  {
    id: "chennai-out",
    question: "Which products are out of stock at the Chennai warehouse?",
    expected: list("inventory", ["status", "in", ["out"]], ["warehouse", "in", [1]]),
    tags: ["list", "relation", "synonym"],
  },
  { id: "late-pos", question: "Purchase orders that are running late", expected: list("purchase-orders", ["late", "is_true"]), tags: ["list", "boolean"] },
  { id: "to-fulfil", question: "Sales orders waiting to be fulfilled", expected: list("sales-orders", ["status", "in", ["confirmed"]]), tags: ["list", "enum"] },
  { id: "slipped", question: "Deals that slipped past their expected close date", expected: list("deals", ["slipped", "is_true"]), tags: ["list", "boolean"] },
  { id: "forecast", question: "What will our revenue be next quarter?", expected: { kind: "unsupported" }, tags: ["unsupported", "forecast"] },
  { id: "write", question: "Delete all cancelled sales orders", expected: { kind: "unsupported" }, tags: ["unsupported", "write"] },
  { id: "offtopic", question: "Write a short poem about invoices", expected: { kind: "unsupported" }, tags: ["unsupported", "off-topic"] },
];
