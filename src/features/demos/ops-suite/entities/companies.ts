import type { EntityMeta, Option } from "../filters/types";
import { CITIES } from "../db/seed/reference";

/** Client-safe description of the Companies list. SQL lives in companies.server.ts. */

const opt = (value: string, label: string, color?: string): Option => ({ value, label, color });

export const LIFECYCLE = [opt("customer", "Customer", "#4ade80"), opt("prospect", "Prospect", "#a0c4ff"), opt("churned", "Churned", "#f87171")];
export const INDUSTRY = [
  opt("manufacturing", "Manufacturing"),
  opt("construction", "Construction"),
  opt("automotive", "Automotive"),
  opt("pharma", "Pharma"),
  opt("food_processing", "Food processing"),
  opt("textiles", "Textiles"),
  opt("logistics", "Logistics"),
  opt("retail", "Retail"),
  opt("hospitality", "Hospitality"),
  opt("healthcare", "Healthcare"),
  opt("education", "Education"),
  opt("energy", "Energy"),
];
export const SIZE = [
  opt("micro", "Micro (< ₹5 Cr)"),
  opt("small", "Small (₹5–50 Cr)"),
  opt("medium", "Medium (₹50–250 Cr)"),
  opt("large", "Large (₹250–1,000 Cr)"),
  opt("enterprise", "Enterprise (₹1,000 Cr+)"),
];
export const REGION = [
  opt("north", "North"),
  opt("south", "South"),
  opt("east", "East"),
  opt("west", "West"),
  opt("central", "Central"),
  opt("north_east", "North East"),
];
export const STATES = [...new Set(CITIES.map((c) => c.state))].sort().map((s) => opt(s, s));

export const companiesMeta: EntityMeta = {
  key: "companies",
  label: "Companies",
  singular: "company",
  defaultSort: [{ field: "revenue12m", dir: "desc" }],
  fields: [
    { key: "name", label: "Company", type: "text", primary: true, visible: true },
    { key: "lifecycle", label: "Lifecycle", type: "enum", options: LIFECYCLE, facet: true, visible: true },
    { key: "industry", label: "Industry", type: "enum", options: INDUSTRY, facet: true, visible: true },
    { key: "size", label: "Size", type: "enum", options: SIZE, facet: true },
    { key: "owner", label: "Owner", type: "relation", dynamicOptions: true, labelKey: "ownerName", facet: true, visible: true },
    { key: "city", label: "City", type: "text", visible: true },
    { key: "state", label: "State", type: "enum", options: STATES, facet: true },
    { key: "region", label: "Region", type: "enum", options: REGION, facet: true },
    { key: "tags", label: "Tags", type: "tags", dynamicOptions: true, sortable: false, visible: true },
    { key: "revenue12m", label: "Revenue (12 mo)", type: "money", align: "end", visible: true, description: "GST-inclusive sales orders in the last 365 days, excluding cancelled" },
    { key: "outstanding", label: "Outstanding", type: "money", align: "end", visible: true, description: "Unpaid balance on sent and partially paid invoices" },
    { key: "openDeals", label: "Open deals", type: "number", align: "end", visible: true },
    { key: "pipeline", label: "Open pipeline", type: "money", align: "end", description: "Total value of open deals" },
    { key: "lastOrder", label: "Last order", type: "date", visible: true },
    { key: "annualRevenue", label: "Annual turnover", type: "money", align: "end", description: "Company's own reported turnover" },
    { key: "paymentTermsDays", label: "Payment terms", type: "number", align: "end", unit: "days" },
    { key: "gstin", label: "GSTIN", type: "text" },
    { key: "phone", label: "Phone", type: "text", sortable: false },
    { key: "website", label: "Website", type: "text" },
    { key: "createdAt", label: "Created", type: "date" },
    { key: "updatedAt", label: "Updated", type: "date" },
  ],
  views: [
    { id: "all", label: "All companies", query: {} },
    {
      id: "key-accounts",
      label: "Key accounts",
      query: { filter: { combinator: "and", conditions: [{ field: "tags", op: "has_any", value: ["key-account"] }] }, sort: [{ field: "revenue12m", dir: "desc" }] },
    },
    {
      id: "collections",
      label: "Collections: owe > ₹10L",
      query: { filter: { combinator: "and", conditions: [{ field: "outstanding", op: "gt", value: 1_000_000 }] }, sort: [{ field: "outstanding", dir: "desc" }] },
    },
    {
      id: "big-prospects",
      label: "Large prospects with open deals",
      query: {
        filter: {
          combinator: "and",
          conditions: [
            { field: "lifecycle", op: "in", value: ["prospect"] },
            { field: "size", op: "in", value: ["large", "enterprise", "medium"] },
            { field: "openDeals", op: "gt", value: 0 },
          ],
        },
        sort: [{ field: "pipeline", dir: "desc" }],
      },
    },
    {
      id: "south-customers",
      label: "South India customers",
      query: {
        filter: { combinator: "and", conditions: [{ field: "region", op: "in", value: ["south"] }, { field: "lifecycle", op: "in", value: ["customer"] }] },
      },
    },
    {
      id: "at-risk",
      label: "At risk or churned",
      query: {
        filter: {
          combinator: "or",
          conditions: [
            { field: "tags", op: "has_any", value: ["at-risk"] },
            { field: "lifecycle", op: "in", value: ["churned"] },
          ],
        },
        sort: [{ field: "outstanding", dir: "desc" }],
      },
    },
    {
      id: "new-this-fy",
      label: "New this financial year",
      query: { filter: { combinator: "and", conditions: [{ field: "createdAt", op: "preset", value: "this_fy" }] }, sort: [{ field: "createdAt", dir: "desc" }] },
    },
  ],
};
