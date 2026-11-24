import { sql } from "drizzle-orm";
import { contacts } from "../db/schema";
import { istDate, outer, type EntityServer } from "../filters/toSql";
import { contactsMeta } from "./contacts";
import { loadCompanies, loadOwners } from "./options.server";

const id = outer(contacts.id);
const companyId = outer(contacts.companyId);

export const contactsServer: EntityServer = {
  meta: contactsMeta,
  table: contacts,
  id: contacts.id,
  fields: {
    name: { expr: sql<string>`(${outer(contacts.firstName)} || ' ' || ${outer(contacts.lastName)})`, searchable: true },
    title: { expr: contacts.title, searchable: true },
    company: { expr: contacts.companyId, label: sql<string>`(select c.name from companies c where c.id = ${companyId})` },
    companyLifecycle: { expr: sql`(select c.lifecycle from companies c where c.id = ${companyId})` },
    email: { expr: contacts.email, searchable: true },
    phone: { expr: contacts.phone, searchable: true },
    isPrimary: { expr: contacts.isPrimary },
    city: { expr: sql<string>`(select c.city from companies c where c.id = ${companyId})`, searchable: true },
    owner: { expr: contacts.ownerId, label: sql<string>`(select u.name from users u where u.id = ${outer(contacts.ownerId)})` },
    openDeals: { expr: sql<number>`(select count(*) from deals d where d.contact_id = ${id} and d.stage not in ('won', 'lost'))`.mapWith(Number) },
    lastActivity: {
      expr: sql`(select max((a.created_at at time zone 'Asia/Kolkata')::date) from activities a where a.contact_id = ${id})`,
      select: sql<string | null>`(select to_char(max(a.created_at at time zone 'Asia/Kolkata'), 'YYYY-MM-DD') from activities a where a.contact_id = ${id})`,
    },
    createdAt: { expr: istDate(contacts.createdAt), select: contacts.createdAt },
  },
  options: async (db) => {
    const [company, owner] = await Promise.all([loadCompanies(db), loadOwners(db)]);
    return { company, owner };
  },
};
