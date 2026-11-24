import { sql } from "drizzle-orm";
import { companies } from "../db/schema";
import { istDate, outer, tagsSelect, type EntityServer } from "../filters/toSql";
import { companiesMeta } from "./companies";
import { loadOwners, loadTags } from "./options.server";

/** Companies: base columns plus live aggregates from CRM (deals) and ERP (orders, invoices). Server-only. */

const today = sql`(now() at time zone 'Asia/Kolkata')::date`;
const id = outer(companies.id);

export const companiesServer: EntityServer = {
  meta: companiesMeta,
  table: companies,
  id: companies.id,
  tagEntity: "companies",
  fields: {
    name: { expr: companies.name, searchable: true },
    lifecycle: { expr: companies.lifecycle },
    industry: { expr: companies.industry },
    size: { expr: companies.size },
    owner: { expr: companies.ownerId, label: sql<string>`(select u.name from users u where u.id = ${outer(companies.ownerId)})` },
    city: { expr: companies.city, searchable: true },
    state: { expr: companies.state },
    region: { expr: companies.region },
    tags: { expr: tagsSelect("companies", companies.id) },
    revenue12m: {
      expr: sql<number>`(select coalesce(sum(so.total), 0) from sales_orders so where so.company_id = ${id} and so.status <> 'cancelled' and so.order_date > ${today} - 365)`.mapWith(Number),
    },
    outstanding: {
      expr: sql<number>`(select coalesce(sum(i.total - i.amount_paid), 0) from invoices i where i.company_id = ${id} and i.status in ('sent', 'partially_paid'))`.mapWith(Number),
    },
    openDeals: {
      expr: sql<number>`(select count(*) from deals d where d.company_id = ${id} and d.stage not in ('won', 'lost'))`.mapWith(Number),
    },
    pipeline: {
      expr: sql<number>`(select coalesce(sum(d.value), 0) from deals d where d.company_id = ${id} and d.stage not in ('won', 'lost'))`.mapWith(Number),
    },
    lastOrder: {
      expr: sql`(select max(so.order_date) from sales_orders so where so.company_id = ${id} and so.status <> 'cancelled')`,
      select: sql<string | null>`(select to_char(max(so.order_date), 'YYYY-MM-DD') from sales_orders so where so.company_id = ${id} and so.status <> 'cancelled')`,
    },
    annualRevenue: { expr: companies.annualRevenue },
    paymentTermsDays: { expr: companies.paymentTermsDays },
    gstin: { expr: companies.gstin, searchable: true },
    phone: { expr: companies.phone, searchable: true },
    website: { expr: companies.website },
    createdAt: { expr: istDate(companies.createdAt), select: companies.createdAt },
    updatedAt: { expr: istDate(companies.updatedAt), select: companies.updatedAt },
  },
  options: async (db) => {
    const [owner, tags] = await Promise.all([loadOwners(db), loadTags(db)]);
    return { owner, tags };
  },
};
