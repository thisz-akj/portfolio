import { and, eq, getTableName, inArray, ne } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getDb } from "../db/client";
import { companies, contacts, deals, entityTags, inventory, leads, products, purchaseOrders, salesOrders, tags, users, warehouses } from "../db/schema";
import { CITIES } from "../db/seed/reference";
import { addDaysISO, todayIST } from "../filters/dates";
import { entityMetas } from "../entities";
import { forms, validateForm, type FormField } from "../entities/forms";
import { STAGE_PROBABILITY } from "../entities/crm-options";
import { formatINR } from "../lib/format";
import { currentActor, writeAudit, type Actor, type Tx } from "./audit";
import { createOrderFromDeal, newPurchaseOrder, newSalesOrder } from "./erp";

/**
 * All CRM writes go through here: validation (shared form rules), entity rules, one transaction per request,
 * and an audit_log row per changed record with a before/after diff of the changed fields only.
 */

type Values = Record<string, unknown>;
export type MutationResult = { ok: true; id: number; ids?: number[] } | { ok: false; errors?: Record<string, string>; message?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TABLES: Record<string, PgTable & { id: any }> = { companies, contacts, leads, deals, products, "sales-orders": salesOrders, "purchase-orders": purchaseOrders };
const MAX_BULK = 500;

const titleOf = (entity: string, r: Values) =>
  entity === "contacts" ? `${r.firstName} ${r.lastName}` : entity === "deals" ? String(r.title) : entity === "sales-orders" || entity === "purchase-orders" ? String(r.number) : String(r.name);

// ── diff + audit ────────────────────────────────────────────────────────────
const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v === undefined ? null : v);

function diff(before: Values | null, after: Values, keys: string[]) {
  const b: Values = {};
  const a: Values = {};
  for (const k of keys) {
    if (before && JSON.stringify(norm(before[k])) === JSON.stringify(norm(after[k]))) continue;
    if (before) b[k] = norm(before[k]);
    a[k] = norm(after[k]);
  }
  return { before: b, after: a, changed: Object.keys(a) };
}

async function describeChange(tx: Tx, entity: string, changed: string[], before: Values, after: Values) {
  const fields = forms[entity].fields;
  const ownerIds = [before.ownerId, after.ownerId].filter((x): x is number => typeof x === "number");
  const names = ownerIds.length ? new Map((await tx.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ownerIds))).map((u) => [u.id, u.name])) : new Map();
  const fmt = (f: FormField | undefined, v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (!f) return String(v);
    if (f.input === "money") return formatINR(Number(v), { compact: true });
    if (f.input === "select") return f.options?.find((o) => o.value === v)?.label ?? String(v);
    if (f.key === "ownerId") return names.get(v as number) ?? `#${v}`;
    if (f.input === "checkbox") return v ? "yes" : "no";
    return String(v);
  };
  return changed
    .filter((k) => fields.some((f) => f.key === k))
    .slice(0, 3)
    .map((k) => {
      const f = fields.find((x) => x.key === k);
      const label = (f?.label ?? k).replace(/ \(.*\)$/, "").toLowerCase();
      return f?.input === "relation" && k !== "ownerId" ? `${label} changed` : `${label} ${fmt(f, before[k])} → ${fmt(f, after[k])}`;
    })
    .join(", ");
}

// ── entity rules ────────────────────────────────────────────────────────────
async function applyRules(tx: Tx, entity: string, values: Values, before: Values | null): Promise<Record<string, string>> {
  if ((entity === "sales-orders" || entity === "purchase-orders") && before && before.status !== "draft") return { _: "Only draft orders can be edited" };
  if (entity === "deals") {
    const stage = (values.stage ?? before?.stage) as string;
    const stageChanged = !before || (values.stage !== undefined && values.stage !== before.stage);
    const closed = stage === "won" || stage === "lost";
    if (stage === "won") values.probability = 100;
    else if (stage === "lost") values.probability = 0;
    else if ((stageChanged && (values.probability === undefined || values.probability === null)) || values.probability === null) values.probability = STAGE_PROBABILITY[stage];
    if (stageChanged) values.closedAt = closed ? new Date() : null;
    if (stage === "lost" && !(values.lostReason ?? before?.lostReason)) return { lostReason: "Required when a deal is lost" };
    if (stage !== "lost" && (stageChanged || "lostReason" in values)) values.lostReason = null;

    const companyId = (values.companyId ?? before?.companyId) as number;
    const contactId = "contactId" in values ? (values.contactId as number | null) : (before?.contactId as number | null);
    if (contactId) {
      const [c] = await tx.select({ companyId: contacts.companyId }).from(contacts).where(eq(contacts.id, contactId));
      if (!c) return { contactId: "Contact not found" };
      if (c.companyId !== companyId) {
        if ("contactId" in values) return { contactId: "This contact works at a different company" };
        values.contactId = null; // company changed: drop the stale contact
      }
    }
  }
  return {};
}

/** Side effects after a write, in the same transaction. `before` is null for creates. */
async function afterWrite(tx: Tx, entity: string, row: Values, before: Values | null, actor: Actor) {
  if (entity === "deals" && row.stage === "won" && before?.stage !== "won") await createOrderFromDeal(tx, row.id as number, actor);
  if (entity === "products" && !before) {
    const whs = await tx.select({ id: warehouses.id }).from(warehouses);
    if (whs.length) await tx.insert(inventory).values(whs.map((w) => ({ productId: row.id as number, warehouseId: w.id, qtyOnHand: 0, qtyReserved: 0, reorderLevel: 10 }))).onConflictDoNothing();
  }
  if (entity === "contacts" && row.isPrimary) {
    await tx
      .update(contacts)
      .set({ isPrimary: false })
      .where(and(eq(contacts.companyId, row.companyId as number), ne(contacts.id, row.id as number), eq(contacts.isPrimary, true)));
  }
}

function uniqueViolation(err: unknown): string | null {
  const e = err as { code?: string; constraint_name?: string; constraint?: string; cause?: unknown };
  const c = (e?.cause ?? e) as { code?: string; constraint_name?: string; constraint?: string; message?: string };
  if (c?.code !== "23505") return null;
  return c.constraint_name ?? c.constraint ?? c.message ?? "unique";
}

// ── create / update ─────────────────────────────────────────────────────────
export async function saveRecord(entity: string, id: number | null, raw: Values): Promise<MutationResult> {
  const form = forms[entity];
  const table = TABLES[entity];
  if (!form || !table) return { ok: false, message: "Unknown entity" };
  const v = validateForm(form, raw);
  if (!v.ok) return { ok: false, errors: v.errors };
  const db = await getDb();
  try {
    return await db.transaction(async (tx) => {
      const actor = await currentActor(tx);
      let before: Values | null = null;
      if (id !== null) {
        [before] = (await tx.select().from(table).where(eq(table.id, id))) as Values[];
        if (!before) return { ok: false, message: "This record no longer exists" };
      }
      const values = { ...v.values };
      const ruleErrors = await applyRules(tx, entity, values, before);
      if (ruleErrors._) return { ok: false, message: ruleErrors._ };
      if (Object.keys(ruleErrors).length) return { ok: false, errors: ruleErrors };

      let row: Values;
      if (!before && entity === "sales-orders") row = await newSalesOrder(tx, values as { companyId: number; warehouseId: number; ownerId: number | null });
      else if (!before && entity === "purchase-orders") row = await newPurchaseOrder(tx, { ...(values as { supplierId: number; warehouseId: number; expectedDate: string | null }), createdBy: actor?.id ?? null });
      else [row] = (before ? await tx.update(table).set(values).where(eq(table.id, id!)).returning() : await tx.insert(table).values(values).returning()) as Values[];
      await afterWrite(tx, entity, row, before, actor);
      const d = diff(before, row, Object.keys(values));
      const singular = entityMetas[entity].singular;
      if (!before) {
        await writeAudit(tx, actor, entity, row.id as number, "create", `${actor?.name ?? "Someone"} created ${singular} “${titleOf(entity, row)}”`, null, d.after);
      } else if (d.changed.length) {
        const what = await describeChange(tx, entity, d.changed, before, row);
        await writeAudit(tx, actor, entity, row.id as number, actionFor(entity, d), `${actor?.name ?? "Someone"} updated ${singular} “${titleOf(entity, row)}”${what ? `: ${what}` : ""}`, d.before, d.after);
      }
      return { ok: true, id: row.id as number };
    });
  } catch (err) {
    const u = uniqueViolation(err);
    if (u?.includes("gstin")) return { ok: false, errors: { gstin: "Another company already has this GSTIN" } };
    if (u?.includes("sku")) return { ok: false, errors: { sku: "Another product already has this SKU" } };
    throw err;
  }
}

const actionFor = (entity: string, d: { changed: string[]; after: Values }) =>
  entity === "deals" && d.changed.includes("stage") && (d.after.stage === "won" || d.after.stage === "lost") ? `deal.${d.after.stage}` : "update";

// ── bulk / partial updates ──────────────────────────────────────────────────
export type BulkAction =
  | { kind: "owner"; ownerId: number | null }
  | { kind: "enum"; field: string; value: string; lostReason?: string }
  | { kind: "tag"; tag: string; mode: "add" | "remove" };

export async function bulkUpdate(entity: string, rawIds: unknown, action: BulkAction): Promise<MutationResult> {
  const meta = entityMetas[entity];
  const form = forms[entity];
  const table = TABLES[entity];
  const ids = Array.isArray(rawIds) ? [...new Set(rawIds.filter((n): n is number => Number.isInteger(n) && n > 0))].slice(0, MAX_BULK) : [];
  if (!meta || !form || !table || !ids.length) return { ok: false, message: "Nothing to update" };

  if (action.kind === "tag") {
    if (!meta.bulk?.tags) return { ok: false, message: "Tags are not supported here" };
    return tagRecords(entity, ids, action.tag, action.mode);
  }

  let patch: Values;
  if (action.kind === "owner" && meta.bulk?.owner) patch = { ownerId: action.ownerId };
  else if (action.kind === "enum" && meta.bulk?.enums?.includes(action.field)) patch = { [action.field]: action.value, ...(action.lostReason ? { lostReason: action.lostReason } : {}) };
  else return { ok: false, message: "This action is not available" };

  const v = validateForm(form, patch, { partial: true });
  if (!v.ok) return { ok: false, errors: v.errors, message: Object.values(v.errors)[0] };

  const db = await getDb();
  return db.transaction(async (tx) => {
    const actor = await currentActor(tx);
    const befores = (await tx.select().from(table).where(inArray(table.id, ids))) as Values[];
    let changedCount = 0;
    for (const before of befores) {
      const values = { ...v.values };
      const errs = await applyRules(tx, entity, values, before);
      if (Object.keys(errs).length) throw new BulkError(Object.values(errs)[0]);
      const [row] = (await tx.update(table).set(values).where(eq(table.id, before.id as number)).returning()) as Values[];
      await afterWrite(tx, entity, row, before, actor);
      const d = diff(before, row, Object.keys(values));
      if (!d.changed.length) continue;
      changedCount++;
      const what = await describeChange(tx, entity, d.changed, before, row);
      await writeAudit(tx, actor, entity, row.id as number, actionFor(entity, d), `${actor?.name ?? "Someone"} updated ${meta.singular} “${titleOf(entity, row)}”${what ? `: ${what}` : ""} (bulk)`, d.before, d.after);
    }
    return { ok: true, id: changedCount, ids: befores.map((b) => b.id as number) };
  }).catch((err) => {
    if (err instanceof BulkError) return { ok: false as const, message: err.message };
    throw err;
  });
}

class BulkError extends Error {}

async function tagRecords(entity: string, ids: number[], tagName: string, mode: "add" | "remove"): Promise<MutationResult> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [tag] = await tx.select().from(tags).where(eq(tags.name, tagName));
    if (!tag) return { ok: false, message: "Unknown tag" };
    const table = TABLES[entity];
    const existing = (await tx.select({ id: table.id }).from(table).where(inArray(table.id, ids))) as { id: number }[];
    const valid = existing.map((r) => r.id);
    if (!valid.length) return { ok: false, message: "Nothing to update" };
    const changed =
      mode === "add"
        ? await tx.insert(entityTags).values(valid.map((entityId) => ({ tagId: tag.id, entity, entityId }))).onConflictDoNothing().returning({ id: entityTags.entityId })
        : await tx.delete(entityTags).where(and(eq(entityTags.tagId, tag.id), eq(entityTags.entity, entity), inArray(entityTags.entityId, valid))).returning({ id: entityTags.entityId });
    const actor = await currentActor(tx);
    for (const { id } of changed) {
      await writeAudit(tx, actor, entity, id, mode === "add" ? "tag.add" : "tag.remove", `${actor?.name ?? "Someone"} ${mode === "add" ? "tagged" : "untagged"} ${entityMetas[entity].singular} #${id} ${mode === "add" ? "with" : "from"} “${tag.name}”`, null, { tag: tag.name });
    }
    return { ok: true, id: changed.length, ids: changed.map((c) => c.id) };
  });
}

// ── lead conversion ─────────────────────────────────────────────────────────
export interface ConvertLeadInput {
  industry: string;
  size: string;
  createDeal: boolean;
  dealTitle?: string;
  dealValue?: string | number;
}

/** Lead → company (prospect) + primary contact (+ optional deal); the lead is marked converted and linked. */
export async function convertLead(id: number, input: ConvertLeadInput): Promise<MutationResult & { companyId?: number; dealId?: number }> {
  const companyForm = forms.companies;
  const pick = (k: string) => companyForm.fields.find((f) => f.key === k)!;
  const check = validateForm({ fields: [pick("industry"), pick("size")] }, { industry: input.industry, size: input.size });
  if (!check.ok) return { ok: false, errors: check.errors };
  let dealValues: Values | null = null;
  if (input.createDeal) {
    const dealForm = forms.deals;
    const d = validateForm({ fields: dealForm.fields.filter((f) => f.key === "title" || f.key === "value") }, { title: input.dealTitle, value: input.dealValue });
    if (!d.ok) return { ok: false, errors: { dealTitle: d.errors.title, dealValue: d.errors.value } as Record<string, string> };
    dealValues = d.values;
  }

  const db = await getDb();
  return db.transaction(async (tx) => {
    const actor = await currentActor(tx);
    const [lead] = await tx.select().from(leads).where(eq(leads.id, id));
    if (!lead) return { ok: false, message: "This lead no longer exists" };
    if (lead.status === "converted") return { ok: false, message: "This lead is already converted" };
    const region = CITIES.find((c) => c.state === lead.state)?.region ?? "central";
    const ownerId = lead.ownerId ?? actor?.id ?? null;

    const [company] = await tx
      .insert(companies)
      .values({ name: lead.companyName, industry: input.industry as "manufacturing", size: input.size as "small", lifecycle: "prospect", city: lead.city, state: lead.state, region, phone: lead.phone, ownerId })
      .returning();
    const [first, ...rest] = lead.name.split(" ");
    const [contact] = await tx
      .insert(contacts)
      .values({ companyId: company.id, firstName: first, lastName: rest.join(" ") || "—", email: lead.email, phone: lead.phone, isPrimary: true, ownerId })
      .returning();
    let dealId: number | undefined;
    if (dealValues) {
      const [deal] = await tx
        .insert(deals)
        .values({
          title: dealValues.title as string,
          value: dealValues.value as number,
          companyId: company.id,
          contactId: contact.id,
          ownerId,
          stage: "qualified",
          probability: STAGE_PROBABILITY.qualified,
          source: lead.source,
          expectedClose: addDaysISO(todayIST(), 30),
        })
        .returning();
      dealId = deal.id;
      await writeAudit(tx, actor, "deals", deal.id, "create", `${actor?.name ?? "Someone"} created deal “${deal.title}” from lead ${lead.name} (${formatINR(deal.value, { compact: true })})`, null, { stage: "qualified" });
    }
    await tx.update(leads).set({ status: "converted", convertedCompanyId: company.id, score: Math.max(lead.score, 70) }).where(eq(leads.id, id));
    await writeAudit(tx, actor, "companies", company.id, "create", `${actor?.name ?? "Someone"} created company “${company.name}” from lead ${lead.name}`, null, { lifecycle: "prospect" });
    await writeAudit(tx, actor, "leads", id, "lead.converted", `${actor?.name ?? "Someone"} converted lead ${lead.name} → ${company.name}`, { status: lead.status }, { status: "converted", convertedCompanyId: company.id });
    return { ok: true, id, companyId: company.id, dealId };
  });
}

export const auditEntityName = (entity: string) => (TABLES[entity] ? getTableName(TABLES[entity]) : entity);
