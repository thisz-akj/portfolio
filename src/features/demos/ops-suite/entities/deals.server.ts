import { sql } from "drizzle-orm";
import { deals } from "../db/schema";
import { istDate, outer, tagsSelect, type EntityServer } from "../filters/toSql";
import { dealsMeta } from "./deals";
import { loadCompanies, loadOwners, loadTags } from "./options.server";

const today = sql`(now() at time zone 'Asia/Kolkata')::date`;

export const dealsServer: EntityServer = {
  meta: dealsMeta,
  table: deals,
  id: deals.id,
  tagEntity: "deals",
  fields: {
    title: { expr: deals.title, searchable: true },
    company: { expr: deals.companyId, label: sql<string>`(select c.name from companies c where c.id = ${outer(deals.companyId)})` },
    stage: { expr: deals.stage },
    value: { expr: deals.value },
    probability: { expr: deals.probability },
    weighted: { expr: sql<number>`round(${outer(deals.value)} * ${outer(deals.probability)} / 100.0, 2)`.mapWith(Number) },
    owner: { expr: deals.ownerId, label: sql<string>`(select u.name from users u where u.id = ${outer(deals.ownerId)})` },
    expectedClose: { expr: deals.expectedClose },
    slipped: { expr: sql<boolean>`(${outer(deals.stage)} not in ('won', 'lost') and ${outer(deals.expectedClose)} < ${today})` },
    closedAt: { expr: istDate(deals.closedAt), select: deals.closedAt },
    source: { expr: deals.source },
    contactName: { expr: sql<string>`(select ct.first_name || ' ' || ct.last_name from contacts ct where ct.id = ${outer(deals.contactId)})`, searchable: true },
    tags: { expr: tagsSelect("deals", deals.id) },
    lostReason: { expr: deals.lostReason },
    ageDays: { expr: sql<number>`(${today} - (${outer(deals.createdAt)} at time zone 'Asia/Kolkata')::date)`.mapWith(Number) },
    createdAt: { expr: istDate(deals.createdAt), select: deals.createdAt },
  },
  options: async (db) => {
    const [company, owner, tags] = await Promise.all([loadCompanies(db), loadOwners(db), loadTags(db)]);
    return { company, owner, tags };
  },
};
