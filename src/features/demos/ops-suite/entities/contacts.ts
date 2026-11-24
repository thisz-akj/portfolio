import type { EntityMeta } from "../filters/types";
import { LIFECYCLE } from "./companies";

export const contactsMeta: EntityMeta = {
  key: "contacts",
  label: "Contacts",
  singular: "contact",
  defaultSort: [{ field: "lastActivity", dir: "desc" }],
  bulk: { owner: true },
  fields: [
    { key: "name", label: "Name", type: "text", primary: true, visible: true },
    { key: "title", label: "Title", type: "text", visible: true },
    { key: "company", label: "Company", type: "relation", dynamicOptions: true, labelKey: "companyName", visible: true },
    { key: "companyLifecycle", label: "Company lifecycle", type: "enum", options: LIFECYCLE, facet: true },
    { key: "email", label: "Email", type: "text", visible: true },
    { key: "phone", label: "Phone", type: "text", sortable: false, visible: true },
    { key: "isPrimary", label: "Primary contact", type: "boolean" },
    { key: "city", label: "City", type: "text" },
    { key: "owner", label: "Owner", type: "relation", dynamicOptions: true, labelKey: "ownerName", facet: true, visible: true },
    { key: "openDeals", label: "Open deals", type: "number", align: "end", visible: true },
    { key: "lastActivity", label: "Last activity", type: "date", visible: true },
    { key: "createdAt", label: "Created", type: "date" },
  ],
  views: [
    { id: "all", label: "All contacts", query: {} },
    { id: "primary", label: "Primary contacts at customers", query: { filter: { combinator: "and", conditions: [{ field: "isPrimary", op: "is_true" }, { field: "companyLifecycle", op: "in", value: ["customer"] }] } } },
    { id: "with-deals", label: "In open deals", query: { filter: { combinator: "and", conditions: [{ field: "openDeals", op: "gt", value: 0 }] } } },
    { id: "gone-quiet", label: "No activity in 90 days", query: { filter: { combinator: "or", conditions: [{ field: "lastActivity", op: "is_empty" }, { field: "lastActivity", op: "older_than", value: 90 }] } } },
  ],
};
