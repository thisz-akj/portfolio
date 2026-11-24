import type { EntityMeta } from "../filters/types";
import { DEAL_STAGE, LEAD_SOURCE } from "./crm-options";

const OPEN = ["new", "qualified", "proposal", "negotiation"];

export const dealsMeta: EntityMeta = {
  key: "deals",
  label: "Deals",
  singular: "deal",
  defaultSort: [{ field: "value", dir: "desc" }],
  bulk: { owner: true, enums: ["stage"], tags: true },
  board: { field: "stage", sum: "value", closed: ["won", "lost"] },
  fields: [
    { key: "title", label: "Deal", type: "text", primary: true, visible: true },
    { key: "company", label: "Company", type: "relation", dynamicOptions: true, labelKey: "companyName", visible: true },
    { key: "stage", label: "Stage", type: "enum", options: DEAL_STAGE, facet: true, visible: true },
    { key: "value", label: "Value", type: "money", align: "end", visible: true },
    { key: "probability", label: "Probability", type: "number", align: "end", unit: "%" },
    { key: "weighted", label: "Weighted", type: "money", align: "end", description: "Value × probability" },
    { key: "owner", label: "Owner", type: "relation", dynamicOptions: true, labelKey: "ownerName", facet: true, visible: true },
    { key: "expectedClose", label: "Expected close", type: "date", visible: true },
    { key: "slipped", label: "Close date passed", type: "boolean", description: "Open deal whose expected close date is in the past" },
    { key: "closedAt", label: "Closed", type: "date" },
    { key: "source", label: "Source", type: "enum", options: LEAD_SOURCE, facet: true },
    { key: "contactName", label: "Contact", type: "text" },
    { key: "tags", label: "Tags", type: "tags", dynamicOptions: true, sortable: false, visible: true },
    { key: "lostReason", label: "Lost reason", type: "text" },
    { key: "ageDays", label: "Age", type: "number", align: "end", unit: "days" },
    { key: "createdAt", label: "Created", type: "date" },
  ],
  views: [
    { id: "all", label: "All deals", query: {} },
    { id: "open", label: "Open pipeline", query: { filter: { combinator: "and", conditions: [{ field: "stage", op: "in", value: OPEN }] }, sort: [{ field: "weighted", dir: "desc" }] } },
    {
      id: "closing-month",
      label: "Closing this month",
      query: { filter: { combinator: "and", conditions: [{ field: "stage", op: "in", value: OPEN }, { field: "expectedClose", op: "preset", value: "this_month" }] }, sort: [{ field: "expectedClose", dir: "asc" }] },
    },
    { id: "slipped", label: "Close date passed", query: { filter: { combinator: "and", conditions: [{ field: "slipped", op: "is_true" }] }, sort: [{ field: "expectedClose", dir: "asc" }] } },
    { id: "won-quarter", label: "Won this quarter", query: { filter: { combinator: "and", conditions: [{ field: "stage", op: "in", value: ["won"] }, { field: "closedAt", op: "preset", value: "this_quarter" }] }, sort: [{ field: "closedAt", dir: "desc" }] } },
    { id: "lost", label: "Lost (with reasons)", query: { filter: { combinator: "and", conditions: [{ field: "stage", op: "in", value: ["lost"] }] }, sort: [{ field: "closedAt", dir: "desc" }], cols: ["title", "company", "value", "owner", "lostReason", "closedAt"] } },
    { id: "strategic", label: "Strategic", query: { filter: { combinator: "and", conditions: [{ field: "tags", op: "has_any", value: ["strategic"] }] } } },
  ],
};
