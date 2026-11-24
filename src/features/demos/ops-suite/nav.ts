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
  { label: "AI", items: [item("Ask Ops Suite", "ask", true), item("AI quality", "ai-quality", true)] },
  {
    label: "CRM",
    items: [item("Companies", "companies", true), item("Contacts", "contacts", true), item("Leads", "leads", true), item("Deals", "deals", true)],
  },
  {
    label: "ERP",
    items: [
      item("Products", "products", true),
      item("Inventory", "inventory", true),
      item("Sales orders", "sales-orders", true),
      item("Purchase orders", "purchase-orders", true),
      item("Invoices", "invoices", true),
      item("Payments", "payments", true),
    ],
  },
  { label: "Data portal", items: [item("Datasets", "datasets", true), item("Imports", "imports", true)] },
  { label: "System", items: [item("Audit log", "audit-log", true)] },
];
