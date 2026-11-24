import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { companies, contacts, products, suppliers, tags, users, warehouses } from "../db/schema";
import type { Option } from "../filters/types";

/** Shared option loaders for relation/tag pickers. Server-only. Small tables, loaded whole. */

export const loadOwners = async (db: Db): Promise<Option[]> =>
  (await db.select({ id: users.id, name: users.name }).from(users).where(sql`${users.role} in ('sales', 'admin')`).orderBy(asc(users.name))).map((u) => ({
    value: String(u.id),
    label: u.name,
  }));

export const loadTags = async (db: Db): Promise<Option[]> =>
  (await db.select({ name: tags.name, color: tags.color }).from(tags).orderBy(asc(tags.name))).map((t) => ({ value: t.name, label: t.name, color: t.color }));

export const loadCompanies = async (db: Db): Promise<Option[]> =>
  (await db.select({ id: companies.id, name: companies.name }).from(companies).orderBy(asc(companies.name))).map((c) => ({ value: String(c.id), label: c.name }));

export const loadContacts = async (db: Db): Promise<Option[]> =>
  (
    await db
      .select({ id: contacts.id, first: contacts.firstName, last: contacts.lastName, companyId: contacts.companyId })
      .from(contacts)
      .orderBy(asc(contacts.firstName), asc(contacts.lastName))
  ).map((c) => ({ value: String(c.id), label: `${c.first} ${c.last}`, group: String(c.companyId) }));

export const loadAllUsers = async (db: Db): Promise<Option[]> =>
  (await db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name))).map((u) => ({ value: String(u.id), label: u.name }));

export const loadWarehouses = async (db: Db): Promise<Option[]> =>
  (await db.select({ id: warehouses.id, code: warehouses.code, name: warehouses.name }).from(warehouses).orderBy(asc(warehouses.id))).map((w) => ({ value: String(w.id), label: `${w.code} · ${w.name}` }));

export const loadSuppliers = async (db: Db): Promise<Option[]> =>
  (await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(asc(suppliers.name))).map((s) => ({ value: String(s.id), label: s.name }));

/** Active products, labelled "SKU · name", grouped by category. */
export const loadProducts = async (db: Db): Promise<Option[]> =>
  (await db.select({ id: products.id, sku: products.sku, name: products.name, category: products.category }).from(products).where(eq(products.active, true)).orderBy(asc(products.sku))).map((p) => ({
    value: String(p.id),
    label: `${p.sku} · ${p.name}`,
    group: p.category,
  }));
