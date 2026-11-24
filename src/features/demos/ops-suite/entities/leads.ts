import type { EntityMeta } from "../filters/types";
import { STATES } from "./companies";
import { LEAD_SOURCE, LEAD_STATUS } from "./crm-options";

export const leadsMeta: EntityMeta = {
  key: "leads",
  label: "Leads",
  singular: "lead",
  defaultSort: [{ field: "createdAt", dir: "desc" }],
  bulk: { owner: true, enums: ["status"] },
  fields: [
    { key: "name", label: "Name", type: "text", primary: true, visible: true },
    { key: "companyName", label: "Company", type: "text", visible: true },
    { key: "status", label: "Status", type: "enum", options: LEAD_STATUS, facet: true, visible: true },
    { key: "score", label: "Score", type: "number", align: "end", visible: true },
    { key: "source", label: "Source", type: "enum", options: LEAD_SOURCE, facet: true, visible: true },
    { key: "owner", label: "Owner", type: "relation", dynamicOptions: true, labelKey: "ownerName", facet: true, visible: true },
    { key: "city", label: "City", type: "text", visible: true },
    { key: "state", label: "State", type: "enum", options: STATES, facet: true },
    { key: "email", label: "Email", type: "text" },
    { key: "phone", label: "Phone", type: "text", sortable: false },
    { key: "convertedCompany", label: "Converted to", type: "relation", dynamicOptions: true, labelKey: "convertedCompanyName" },
    { key: "ageDays", label: "Age", type: "number", align: "end", unit: "days" },
    { key: "createdAt", label: "Created", type: "date", visible: true },
    { key: "updatedAt", label: "Updated", type: "date" },
  ],
  views: [
    { id: "all", label: "All leads", query: {} },
    {
      id: "unassigned",
      label: "Unassigned",
      query: { filter: { combinator: "and", conditions: [{ field: "owner", op: "is_empty" }, { field: "status", op: "in", value: ["new", "contacted"] }] } },
    },
    {
      id: "hot",
      label: "Hot: score ≥ 70, not converted",
      query: { filter: { combinator: "and", conditions: [{ field: "score", op: "gte", value: 70 }, { field: "status", op: "in", value: ["new", "contacted", "qualified"] }] }, sort: [{ field: "score", dir: "desc" }] },
    },
    { id: "marketplace-month", label: "Marketplace leads this month", query: { filter: { combinator: "and", conditions: [{ field: "source", op: "in", value: ["indiamart"] }, { field: "createdAt", op: "preset", value: "this_month" }] } } },
    { id: "converted-fy", label: "Converted this FY", query: { filter: { combinator: "and", conditions: [{ field: "status", op: "in", value: ["converted"] }, { field: "updatedAt", op: "preset", value: "this_fy" }] } } },
  ],
};
