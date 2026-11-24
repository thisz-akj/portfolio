import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type Db } from "../db/client";
import { activities, auditLog, companies, contacts, deals, invoices, leads, salesOrders, users } from "../db/schema";
import { getEntityServer } from "../entities/server";
import { entityMetas } from "../entities";
import { forms } from "../entities/forms";
import { DEAL_STAGE } from "../entities/crm-options";
import { LIFECYCLE } from "../entities/companies";
import { serializeFilter } from "../filters/parse";
import { selectionFor } from "../filters/toSql";
import { formatDate, formatINR } from "../lib/format";
import { PORTAL_BASE } from "../nav";
import type { DetailItem, DetailSection, RecordDetail, TimelineItem } from "./detail-types";

/** Loads one record with related records and a merged activity + audit timeline. Server-only. */

const href = (entity: string, id: number) => (entityMetas[entity] ? `${PORTAL_BASE}/${entity}/${id}` : undefined);
const listHref = (entity: string, field: string, id: number) =>
  `${PORTAL_BASE}/${entity}?f=${encodeURIComponent(serializeFilter({ combinator: "and", conditions: [{ field, op: "in", value: [id] }] })!)}`;
const badge = (opts: { value: string; label: string; color?: string }[], v: string) => {
  const o = opts.find((x) => x.value === v);
  return o ? { label: o.label, color: o.color } : { label: v };
};
const SO_STATUS: Record<string, string> = { draft: "#6b6b6b", confirmed: "#fbbf24", fulfilled: "#4ade80", cancelled: "#f87171" };

const dealItem = (d: { id: number; title: string; stage: string; value: number; expectedClose: string; company?: string | null }): DetailItem => ({
  id: d.id,
  title: d.title,
  subtitle: d.company ?? undefined,
  meta: `${formatINR(d.value, { compact: true })} · close ${formatDate(d.expectedClose)}`,
  badge: badge(DEAL_STAGE, d.stage),
  href: href("deals", d.id),
});

async function sections(db: Db, entity: string, id: number, row: Record<string, unknown>): Promise<DetailSection[]> {
  const dealCols = { id: deals.id, title: deals.title, stage: deals.stage, value: deals.value, expectedClose: deals.expectedClose };
  const count = (n: { n: number }[]) => Number(n[0]?.n ?? 0);
  switch (entity) {
    case "companies": {
      const [cts, ctN, dls, dlN, sos, invs] = await Promise.all([
        db.select().from(contacts).where(eq(contacts.companyId, id)).orderBy(desc(contacts.isPrimary), contacts.firstName).limit(6),
        db.select({ n: sql<number>`count(*)` }).from(contacts).where(eq(contacts.companyId, id)),
        db.select(dealCols).from(deals).where(and(eq(deals.companyId, id), sql`${deals.stage} not in ('won','lost')`)).orderBy(desc(deals.value)).limit(6),
        db.select({ n: sql<number>`count(*)` }).from(deals).where(eq(deals.companyId, id)),
        db.select().from(salesOrders).where(eq(salesOrders.companyId, id)).orderBy(desc(salesOrders.orderDate), desc(salesOrders.id)).limit(5),
        db.select().from(invoices).where(and(eq(invoices.companyId, id), inArray(invoices.status, ["sent", "partially_paid"]))).orderBy(invoices.dueDate).limit(6),
      ]);
      return [
        {
          key: "contacts",
          title: "Contacts",
          total: count(ctN),
          viewAll: listHref("contacts", "company", id),
          items: cts.map((c) => ({ id: c.id, title: `${c.firstName} ${c.lastName}`, subtitle: c.title ?? undefined, meta: c.email, badge: c.isPrimary ? { label: "Primary", color: "#4ade80" } : undefined, href: href("contacts", c.id) })),
        },
        { key: "deals", title: "Open deals", total: count(dlN), viewAll: listHref("deals", "company", id), items: dls.map(dealItem), empty: "No open deals" },
        {
          key: "orders",
          title: "Recent sales orders",
          total: sos.length,
          items: sos.map((o) => ({ id: o.id, title: o.number, meta: `${formatDate(o.orderDate)} · ${formatINR(o.total, { compact: true })}`, badge: { label: o.status, color: SO_STATUS[o.status] } })),
          empty: "No orders yet",
        },
        {
          key: "invoices",
          title: "Unpaid invoices",
          total: invs.length,
          items: invs.map((i) => {
            const overdue = i.dueDate < new Date().toISOString().slice(0, 10);
            return {
              id: i.id,
              title: i.number,
              meta: `${formatINR(i.total - i.amountPaid, { compact: true })} due ${formatDate(i.dueDate)}`,
              badge: overdue ? { label: "Overdue", color: "#f87171" } : { label: i.status === "partially_paid" ? "Part paid" : "Sent", color: "#fbbf24" },
            };
          }),
          empty: "Nothing outstanding",
        },
      ];
    }
    case "contacts": {
      const companyId = row.company as number;
      const [[co], dls] = await Promise.all([
        db.select().from(companies).where(eq(companies.id, companyId)),
        db.select({ ...dealCols }).from(deals).where(eq(deals.contactId, id)).orderBy(desc(deals.createdAt)).limit(6),
      ]);
      return [
        { key: "company", title: "Company", total: co ? 1 : 0, items: co ? [{ id: co.id, title: co.name, subtitle: `${co.city}, ${co.state}`, badge: badge(LIFECYCLE, co.lifecycle), href: href("companies", co.id) }] : [] },
        { key: "deals", title: "Deals", total: dls.length, items: dls.map(dealItem), empty: "Not on any deal" },
      ];
    }
    case "leads": {
      const cid = row.convertedCompany as number | null;
      if (!cid) return [];
      const [co] = await db.select().from(companies).where(eq(companies.id, cid));
      return co ? [{ key: "company", title: "Converted to", total: 1, items: [{ id: co.id, title: co.name, subtitle: `${co.city}, ${co.state}`, badge: badge(LIFECYCLE, co.lifecycle), href: href("companies", co.id) }] }] : [];
    }
    case "deals": {
      const [[d]] = await Promise.all([db.select().from(deals).where(eq(deals.id, id))]);
      const [[co], [ct], sos] = await Promise.all([
        db.select().from(companies).where(eq(companies.id, d.companyId)),
        d.contactId ? db.select().from(contacts).where(eq(contacts.id, d.contactId)) : Promise.resolve([]),
        db.select().from(salesOrders).where(eq(salesOrders.dealId, id)).orderBy(desc(salesOrders.orderDate)),
      ]);
      return [
        {
          key: "parties",
          title: "Company & contact",
          total: 2,
          items: [
            ...(co ? [{ id: co.id, title: co.name, subtitle: `${co.city}, ${co.state}`, badge: badge(LIFECYCLE, co.lifecycle), href: href("companies", co.id) }] : []),
            ...(ct ? [{ id: ct.id, title: `${ct.firstName} ${ct.lastName}`, subtitle: ct.title ?? undefined, meta: ct.email, href: href("contacts", ct.id) }] : []),
          ],
        },
        {
          key: "orders",
          title: "Sales orders",
          total: sos.length,
          items: sos.map((o) => ({ id: o.id, title: o.number, meta: `${formatDate(o.orderDate)} · ${formatINR(o.total, { compact: true })}`, badge: { label: o.status, color: SO_STATUS[o.status] } })),
          empty: d.stage === "won" ? "No order yet" : "Orders appear once the deal is won",
        },
      ];
    }
  }
  return [];
}

async function timeline(db: Db, entity: string, id: number): Promise<TimelineItem[]> {
  const actCol = entity === "companies" ? activities.companyId : entity === "contacts" ? activities.contactId : entity === "deals" ? activities.dealId : null;
  const [acts, audits] = await Promise.all([
    actCol
      ? db
          .select({ a: activities, owner: users.name })
          .from(activities)
          .leftJoin(users, eq(users.id, activities.ownerId))
          .where(eq(actCol, id))
          .orderBy(desc(activities.createdAt))
          .limit(25)
      : Promise.resolve([]),
    db
      .select({ l: auditLog, actor: users.name })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorId))
      .where(and(eq(auditLog.entity, entity), eq(auditLog.entityId, String(id))))
      .orderBy(desc(auditLog.at))
      .limit(25),
  ]);
  const items: TimelineItem[] = [
    ...acts.map(({ a, owner }) => ({
      id: `a${a.id}`,
      at: (a.completedAt ?? a.createdAt).toISOString(),
      kind: a.type,
      title: a.subject,
      actor: owner ?? undefined,
      pending: a.type === "task" && !a.completedAt,
      due: a.dueAt?.toISOString(),
    })),
    ...audits.map(({ l, actor }) => ({ id: `l${l.id}`, at: l.at.toISOString(), kind: "audit" as const, title: l.summary ?? l.action, actor: actor ?? undefined })),
  ];
  return items.sort((x, y) => (x.pending === y.pending ? y.at.localeCompare(x.at) : x.pending ? -1 : 1)).slice(0, 40);
}

const TABLE_FOR: Record<string, typeof companies | typeof contacts | typeof leads | typeof deals> = { companies, contacts, leads, deals };

export async function getDetail(entity: string, id: number): Promise<RecordDetail | null> {
  const ent = getEntityServer(entity);
  const table = TABLE_FOR[entity];
  if (!ent || !table || !Number.isInteger(id) || id <= 0) return null;
  const db = await getDb();
  const keys = ent.meta.fields.map((f) => f.key);
  const [[row], [raw], options] = await Promise.all([
    db.select(selectionFor(ent, keys)).from(ent.table).where(eq(ent.id, id)) as unknown as Promise<(Record<string, unknown> & { id: number })[]>,
    db.select().from(table).where(eq(table.id, id)) as Promise<Record<string, unknown>[]>,
    ent.options ? ent.options(db) : Promise.resolve({}),
  ]);
  if (!row) return null;
  const [secs, tl] = await Promise.all([sections(db, entity, id, row), timeline(db, entity, id)]);
  const primary = ent.meta.fields.find((f) => f.primary)!;
  const formValues = Object.fromEntries(forms[entity].fields.map((f) => [f.key, raw[f.key] ?? null]));
  return { entity, id, title: String(row[primary.key]), row, options, sections: secs, timeline: tl, formValues };
}
