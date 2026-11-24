import { sql } from "drizzle-orm";
import { leads } from "../db/schema";
import { istDate, outer, type EntityServer } from "../filters/toSql";
import { leadsMeta } from "./leads";
import { loadCompanies, loadOwners } from "./options.server";

export const leadsServer: EntityServer = {
  meta: leadsMeta,
  table: leads,
  id: leads.id,
  fields: {
    name: { expr: leads.name, searchable: true },
    companyName: { expr: leads.companyName, searchable: true },
    status: { expr: leads.status },
    score: { expr: leads.score },
    source: { expr: leads.source },
    owner: { expr: leads.ownerId, label: sql<string>`(select u.name from users u where u.id = ${outer(leads.ownerId)})` },
    city: { expr: leads.city, searchable: true },
    state: { expr: leads.state },
    email: { expr: leads.email, searchable: true },
    phone: { expr: leads.phone, searchable: true },
    convertedCompany: { expr: leads.convertedCompanyId, label: sql<string>`(select c.name from companies c where c.id = ${outer(leads.convertedCompanyId)})` },
    ageDays: { expr: sql<number>`((now() at time zone 'Asia/Kolkata')::date - (${outer(leads.createdAt)} at time zone 'Asia/Kolkata')::date)`.mapWith(Number) },
    createdAt: { expr: istDate(leads.createdAt), select: leads.createdAt },
    updatedAt: { expr: istDate(leads.updatedAt), select: leads.updatedAt },
  },
  options: async (db) => {
    const [owner, convertedCompany] = await Promise.all([loadOwners(db), loadCompanies(db)]);
    return { owner, convertedCompany };
  },
};
