"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { datasets } from "../db/schema";
import { forms } from "../entities/forms";
import { loadCompanies, loadContacts, loadOwners, loadSuppliers, loadWarehouses } from "../entities/options.server";
import type { Option } from "../filters/types";
import { PORTAL_BASE } from "../nav";
import { FlowError } from "./audit";
import { canAction, canImport, canWrite, ROLE_LABEL, type Role } from "../auth/permissions";
import { getPersona, PERSONA_COOKIE, listPersonas } from "../auth/persona.server";
import { allow, LIMITS } from "../lib/rateLimit";
import { getDetail } from "./detail";
import type { RecordDetail } from "./detail-types";
import { bulkUpdate, convertLead, saveRecord, type BulkAction, type ConvertLeadInput, type MutationResult } from "./mutate";

/**
 * Server actions for the portal UI. These are public POST endpoints, so every argument is re-checked here
 * (types, sizes) before reaching data/mutate.ts, which does the real validation.
 */

const isEntity = (e: unknown): e is string => typeof e === "string" && Object.hasOwn(forms, e);
const isId = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;
const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length <= 40;
const failed = (err: unknown): MutationResult => {
  console.error("[ops-suite] action failed:", err);
  return { ok: false, message: "Something went wrong — the demo database may be unavailable." };
};
const refresh = () => revalidatePath(PORTAL_BASE, "layout");

async function clientKey() {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
  } catch {
    return "local";
  }
}

/** Permission check for the current persona, then a per-client rate limit. Returns an error message or null. */
async function guard(allowed: (role: Role) => boolean, bucket: keyof typeof LIMITS): Promise<string | null> {
  const p = await getPersona();
  if (!p || !allowed(p.role)) return `${p ? ROLE_LABEL[p.role] : "This persona"} can't do that — switch persona in the top bar.`;
  if (!allow(`${bucket}:${await clientKey()}`, LIMITS[bucket])) return "That's a lot of changes in a short time — please wait a minute and try again.";
  return null;
}

/** Switch the demo persona (cookie). */
export async function setPersonaAction(id: unknown): Promise<{ ok: boolean }> {
  if (!isId(id)) return { ok: false };
  const personas = await listPersonas();
  if (!personas.some((p) => p.id === id)) return { ok: false };
  const { cookies } = await import("next/headers");
  (await cookies()).set(PERSONA_COOKIE, String(id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === "production" });
  refresh();
  return { ok: true };
}

export async function fetchDetailAction(entity: unknown, id: unknown): Promise<RecordDetail | null> {
  if (!isEntity(entity) || !isId(id)) return null;
  return getDetail(entity, id);
}

export async function fetchFormOptionsAction(entity: unknown): Promise<Record<string, Option[]>> {
  if (!isEntity(entity)) return {};
  const keys = new Set(forms[entity].fields.map((f) => f.optionsKey).filter(Boolean));
  const db = await getDb();
  const [owner, company, contact, warehouse, supplier] = await Promise.all([
    keys.has("owner") ? loadOwners(db) : [],
    keys.has("company") ? loadCompanies(db) : [],
    keys.has("contact") ? loadContacts(db) : [],
    keys.has("warehouse") ? loadWarehouses(db) : [],
    keys.has("supplier") ? loadSuppliers(db) : [],
  ]);
  return { owner, company, contact, warehouse, supplier };
}

export async function saveRecordAction(entity: unknown, id: unknown, values: unknown): Promise<MutationResult> {
  if (!isEntity(entity) || !(id === null || isId(id)) || !isPlain(values)) return { ok: false, message: "Invalid request" };
  const denied = await guard((r) => canWrite(r, entity), "write");
  if (denied) return { ok: false, message: denied };
  try {
    const res = await saveRecord(entity, id, values);
    if (res.ok) refresh();
    return res;
  } catch (err) {
    return failed(err);
  }
}

export async function bulkAction(entity: unknown, ids: unknown, action: unknown): Promise<MutationResult> {
  if (!isEntity(entity) || !Array.isArray(ids) || ids.length > 500 || !isPlain(action)) return { ok: false, message: "Invalid request" };
  const a = action as BulkAction;
  const valid =
    (a.kind === "owner" && (a.ownerId === null || isId(a.ownerId))) ||
    (a.kind === "enum" && typeof a.field === "string" && typeof a.value === "string" && (a.lostReason === undefined || typeof a.lostReason === "string")) ||
    (a.kind === "tag" && typeof a.tag === "string" && (a.mode === "add" || a.mode === "remove"));
  if (!valid) return { ok: false, message: "Invalid request" };
  const denied = await guard((r) => canWrite(r, entity), "write");
  if (denied) return { ok: false, message: denied };
  try {
    const res = await bulkUpdate(entity, ids, a);
    if (res.ok) refresh();
    return res;
  } catch (err) {
    return failed(err);
  }
}

export async function convertLeadAction(id: unknown, input: unknown) {
  if (!isId(id) || !isPlain(input)) return { ok: false as const, message: "Invalid request" };
  const i = input as unknown as ConvertLeadInput;
  const denied = await guard((r) => canAction(r, "leads", "convert"), "write");
  if (denied) return { ok: false as const, message: denied };
  try {
    const res = await convertLead(id, { industry: String(i.industry ?? ""), size: String(i.size ?? ""), createDeal: i.createDeal === true, dealTitle: typeof i.dealTitle === "string" ? i.dealTitle : undefined, dealValue: typeof i.dealValue === "string" || typeof i.dealValue === "number" ? i.dealValue : undefined });
    if (res.ok) refresh();
    return res;
  } catch (err) {
    return failed(err);
  }
}

// ── ERP workflow actions ────────────────────────────────────────────────────
export type ActionResult = { ok: true; message: string; goto?: { entity: string; id: number } } | { ok: false; message: string };

/** Runs a state-changing record action (confirm, fulfil, send, receive, payment, adjust, …). */
export async function runRecordAction(entity: unknown, id: unknown, key: unknown, input: unknown = {}): Promise<ActionResult> {
  if (typeof entity !== "string" || !isId(id) || typeof key !== "string" || !isPlain(input ?? {})) return { ok: false, message: "Invalid request" };
  const i = (input ?? {}) as Record<string, unknown>;
  const denied = await guard((r) => canAction(r, entity, key), "write");
  if (denied) return { ok: false, message: denied };
  const flows = await import("./erp");
  try {
    const res = await flows.runFlow(async (tx, actor): Promise<{ message: string; goto?: { entity: string; id: number } }> => {
      switch (`${entity}:${key}`) {
        case "deals:create-order": {
          const so = await flows.createOrderFromDeal(tx, id, actor);
          if (!so) throw new FlowError("This deal already has a sales order");
          return { message: `Draft ${so.number} created — review the lines and confirm`, goto: { entity: "sales-orders", id: so.id } };
        }
        case "sales-orders:confirm":
          await flows.confirmSalesOrder(tx, id, actor);
          return { message: "Order confirmed — stock reserved" };
        case "sales-orders:fulfil": {
          const r = await flows.fulfilSalesOrder(tx, id, actor);
          return { message: `Fulfilled — ${r.invoiceNumber} issued${r.reorders.length ? `; auto-reorder updated ${r.reorders.join(", ")}` : ""}`, goto: undefined };
        }
        case "sales-orders:cancel":
          await flows.cancelSalesOrder(tx, id, actor);
          return { message: "Order cancelled" };
        case "purchase-orders:send":
          await flows.sendPurchaseOrder(tx, id, actor);
          return { message: "Purchase order sent" };
        case "purchase-orders:receive": {
          const lines = Array.isArray(i.lines) ? i.lines.slice(0, 200) : [];
          const receipt = lines.filter(isPlain).map((l) => ({ lineId: Number(l.lineId), qty: Number(l.qty) }));
          const r = await flows.receivePurchaseOrder(tx, id, receipt, actor);
          return { message: r.status === "received" ? "Fully received — stock updated" : "Partially received — stock updated" };
        }
        case "purchase-orders:cancel":
          await flows.cancelPurchaseOrder(tx, id, actor);
          return { message: "Purchase order cancelled" };
        case "invoices:send":
          await flows.sendInvoice(tx, id, actor);
          return { message: "Invoice sent" };
        case "invoices:payment": {
          const r = await flows.recordPayment(tx, id, { amount: Number(i.amount), method: String(i.method ?? ""), reference: String(i.reference ?? ""), paidOn: String(i.paidOn ?? "") }, actor);
          return { message: r.status === "paid" ? "Payment recorded — invoice paid in full" : "Part payment recorded" };
        }
        case "inventory:adjust": {
          const r = await flows.adjustStock(tx, id, Number(i.counted), String(i.reason ?? ""), actor);
          return { message: `Stock adjusted${r.reorders.length ? ` — auto-reorder updated ${r.reorders.join(", ")}` : ""}` };
        }
        default:
          throw new FlowError("This action isn't available");
      }
    });
    if (!res.ok) return res;
    refresh();
    return { ok: true, ...res.value };
  } catch (err) {
    const r = failed(err);
    return { ok: false, message: r.ok ? "" : (r.message ?? "Something went wrong") };
  }
}

/** Add / change / remove a line on a draft sales or purchase order. */
export async function editLinesAction(entity: unknown, id: unknown, op: unknown): Promise<ActionResult> {
  if ((entity !== "sales-orders" && entity !== "purchase-orders") || !isId(id) || !isPlain(op)) return { ok: false, message: "Invalid request" };
  const o = op as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" ? v : Number(v));
  const lineOp =
    o.op === "add"
      ? { op: "add" as const, productId: n(o.productId), qty: n(o.qty), discountPct: o.discountPct === undefined ? 0 : n(o.discountPct) }
      : o.op === "update"
        ? { op: "update" as const, lineId: n(o.lineId), qty: n(o.qty), discountPct: o.discountPct === undefined ? 0 : n(o.discountPct) }
        : o.op === "remove"
          ? { op: "remove" as const, lineId: n(o.lineId) }
          : null;
  if (!lineOp || Object.values(lineOp).some((v) => typeof v === "number" && !Number.isFinite(v))) return { ok: false, message: "Invalid request" };
  const denied = await guard((r) => canWrite(r, entity), "write");
  if (denied) return { ok: false, message: denied };
  const flows = await import("./erp");
  try {
    const res = await flows.runFlow((tx, actor) => flows.editLines(tx, entity === "sales-orders" ? "so" : "po", id, lineOp, actor));
    if (!res.ok) return res;
    refresh();
    return { ok: true, message: lineOp.op === "add" ? "Line added" : lineOp.op === "remove" ? "Line removed" : "Line updated" };
  } catch (err) {
    console.error("[ops-suite] line edit failed:", err);
    return { ok: false, message: "Something went wrong — the demo database may be unavailable." };
  }
}


// ── data portal imports ─────────────────────────────────────────────────────
export type ImportActionResult =
  | { ok: true; total: number; imported: number; rejected: number; sample: { row: number; ok: boolean; errors: string[]; values: Record<string, string> }[]; jobId?: number }
  | { ok: false; message: string };

const isMapping = (m: unknown): m is Record<string, string> => isPlain(m) && Object.values(m).every((v) => typeof v === "string" && v.length <= 200);

/** Validates a CSV against a dataset without saving anything (the import runs and is rolled back). */
export async function previewImportAction(datasetId: unknown, csv: unknown, mapping: unknown): Promise<ImportActionResult> {
  return importAction(datasetId, csv, mapping, true);
}

/** Imports a CSV: good rows are applied, bad rows are stored with reasons on the import job. */
export async function runImportAction(datasetId: unknown, csv: unknown, mapping: unknown, fileName: unknown): Promise<ImportActionResult> {
  return importAction(datasetId, csv, mapping, false, typeof fileName === "string" ? fileName.replace(/[^\w.\- ]/g, "_") : undefined);
}

async function importAction(datasetId: unknown, csv: unknown, mapping: unknown, dryRun: boolean, fileName?: string): Promise<ImportActionResult> {
  if (!isId(datasetId) || typeof csv !== "string" || !isMapping(mapping)) return { ok: false, message: "Invalid request" };
  const { CSV_LIMITS } = await import("../lib/csv");
  if (csv.length > CSV_LIMITS.bytes) return { ok: false, message: "File is larger than 1 MB" };
  const db = await getDb();
  const [ds] = await db.select({ target: datasets.targetEntity }).from(datasets).where(eq(datasets.id, datasetId));
  if (!ds) return { ok: false, message: "Dataset not found" };
  const denied = await guard((r) => canImport(r, ds.target), "import");
  if (denied) return { ok: false, message: denied };
  try {
    const { runImport } = await import("./importer");
    const res = await runImport(datasetId, csv, mapping, { dryRun, fileName });
    if (!res.ok) return res;
    if (!dryRun) refresh();
    const o = res.outcome;
    return { ok: true, total: o.total, imported: o.ok, rejected: o.failed, sample: o.sample, jobId: o.jobId };
  } catch (err) {
    console.error("[ops-suite] import failed:", err);
    return { ok: false, message: "Something went wrong — the demo database may be unavailable." };
  }
}
