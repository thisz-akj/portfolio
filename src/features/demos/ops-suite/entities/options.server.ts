import { asc, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { companies, contacts, tags, users } from "../db/schema";
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
