/** Portal navigation. `ready: false` entries render as "soon" placeholders until their phase lands. */
export const PORTAL_BASE = "/demos/ops-suite/app";

export interface NavItem {
  label: string;
  href: string;
  ready: boolean;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

const item = (label: string, path: string, ready = false): NavItem => ({
  label,
  href: path ? `${PORTAL_BASE}/${path}` : PORTAL_BASE,
  ready,
});

export const portalNav: NavGroup[] = [
  { label: "Overview", items: [item("Dashboard", "", true)] },
  {
    label: "CRM",
    items: [item("Companies", "companies", true), item("Contacts", "contacts"), item("Leads", "leads"), item("Deals", "deals")],
  },
  {
    label: "ERP",
    items: [
      item("Products", "products"),
      item("Inventory", "inventory"),
      item("Sales orders", "sales-orders"),
      item("Purchase orders", "purchase-orders"),
      item("Invoices", "invoices"),
      item("Payments", "payments"),
    ],
  },
  { label: "Data portal", items: [item("Datasets", "datasets"), item("Imports", "imports")] },
  { label: "System", items: [item("Audit log", "audit-log")] },
];
