/**
 * Role-based permissions for the demo personas. Client-safe: the UI hides what a role can't do, and the
 * server actions enforce the same rules (data/actions.ts → guard()).
 *
 *   admin      everything
 *   sales      CRM records, lead conversion, drafting + confirming/cancelling sales orders, lead imports
 *   warehouse  products, purchase orders, fulfilment, stock counts, stock imports
 *   finance-only (admin): invoices, payments, price lists, ledger imports
 */

export type Role = "admin" | "sales" | "warehouse";

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", sales: "Sales", warehouse: "Warehouse" };

const WRITE: Record<Role, string[]> = {
  admin: ["companies", "contacts", "leads", "deals", "products", "sales-orders", "purchase-orders"],
  sales: ["companies", "contacts", "leads", "deals", "sales-orders"],
  warehouse: ["products", "purchase-orders"],
};

const ACTIONS: Record<Role, string[]> = {
  admin: ["*"],
  sales: ["deals:create-order", "leads:convert", "sales-orders:confirm", "sales-orders:cancel"],
  warehouse: ["sales-orders:fulfil", "purchase-orders:send", "purchase-orders:receive", "purchase-orders:cancel", "inventory:adjust"],
};

const IMPORTS: Record<Role, string[]> = { admin: ["*"], sales: ["leads"], warehouse: ["inventory"] };

/** Create, edit, bulk-edit and (for orders) edit lines. */
export const canWrite = (role: Role, entity: string) => WRITE[role].includes(entity);

/** A workflow action such as "sales-orders:fulfil". */
export const canAction = (role: Role, entity: string, key: string) => ACTIONS[role].includes("*") || ACTIONS[role].includes(`${entity}:${key}`);

/** Importing into a dataset target ("leads", "products", "inventory", "invoices"). */
export const canImport = (role: Role, target: string) => IMPORTS[role].includes("*") || IMPORTS[role].includes(target);

export const isRole = (r: unknown): r is Role => r === "admin" || r === "sales" || r === "warehouse";
