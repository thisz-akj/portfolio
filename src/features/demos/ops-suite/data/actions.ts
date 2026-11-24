"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "../db/client";
import { forms } from "../entities/forms";
import { loadCompanies, loadContacts, loadOwners } from "../entities/options.server";
import type { Option } from "../filters/types";
import { PORTAL_BASE } from "../nav";
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

export async function fetchDetailAction(entity: unknown, id: unknown): Promise<RecordDetail | null> {
  if (!isEntity(entity) || !isId(id)) return null;
  return getDetail(entity, id);
}

export async function fetchFormOptionsAction(entity: unknown): Promise<Record<string, Option[]>> {
  if (!isEntity(entity)) return {};
  const keys = new Set(forms[entity].fields.map((f) => f.optionsKey).filter(Boolean));
  const db = await getDb();
  const [owner, company, contact] = await Promise.all([
    keys.has("owner") ? loadOwners(db) : [],
    keys.has("company") ? loadCompanies(db) : [],
    keys.has("contact") ? loadContacts(db) : [],
  ]);
  return { owner, company, contact };
}

export async function saveRecordAction(entity: unknown, id: unknown, values: unknown): Promise<MutationResult> {
  if (!isEntity(entity) || !(id === null || isId(id)) || !isPlain(values)) return { ok: false, message: "Invalid request" };
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
  try {
    const res = await convertLead(id, { industry: String(i.industry ?? ""), size: String(i.size ?? ""), createDeal: i.createDeal === true, dealTitle: typeof i.dealTitle === "string" ? i.dealTitle : undefined, dealValue: typeof i.dealValue === "string" || typeof i.dealValue === "number" ? i.dealValue : undefined });
    if (res.ok) refresh();
    return res;
  } catch (err) {
    return failed(err);
  }
}
