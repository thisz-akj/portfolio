import { z } from "zod";
import { parseAmount } from "../lib/format";
import type { Option } from "../filters/types";
import { INDUSTRY, LIFECYCLE, REGION, SIZE, STATES } from "./companies";
import { DEAL_STAGE, LEAD_SOURCE, LEAD_STATUS, LOST_REASONS } from "./crm-options";

/**
 * Create/edit forms, shared by the client (instant feedback) and the server (authoritative validation).
 * Field keys are the Drizzle table property names, so validated values can be written directly.
 */

export type InputKind = "text" | "email" | "tel" | "url" | "textarea" | "number" | "money" | "date" | "select" | "relation" | "checkbox";

export interface FormField {
  key: string;
  label: string;
  input: InputKind;
  required?: boolean;
  options?: Option[]; // select
  optionsKey?: "owner" | "company" | "contact"; // relation (loaded by the server)
  /** relation: only show options whose `group` equals this field's value (e.g. contacts of the chosen company) */
  dependsOn?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: { re: RegExp; message: string };
  placeholder?: string;
  help?: string;
  /** half-width in the form grid */
  half?: boolean;
  /** only shown (and submitted) when another field has this value */
  showWhen?: { field: string; equals: string };
}

export interface EntityForm {
  fields: FormField[];
  /** cross-field rules; return field → message */
  check?: (v: Record<string, unknown>) => Record<string, string>;
}

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PHONE = /^[+\d][\d\s-]{7,16}$/;
const opt = (values: string[]): Option[] => values.map((v) => ({ value: v, label: v }));

export const forms: Record<string, EntityForm> = {
  companies: {
    fields: [
      { key: "name", label: "Company name", input: "text", required: true, maxLength: 120 },
      { key: "industry", label: "Industry", input: "select", options: INDUSTRY, required: true, half: true },
      { key: "size", label: "Size", input: "select", options: SIZE, required: true, half: true },
      { key: "lifecycle", label: "Lifecycle", input: "select", options: LIFECYCLE, required: true, half: true },
      { key: "ownerId", label: "Owner", input: "relation", optionsKey: "owner", half: true },
      { key: "city", label: "City", input: "text", required: true, maxLength: 60, half: true },
      { key: "state", label: "State", input: "select", options: STATES, required: true, half: true },
      { key: "region", label: "Region", input: "select", options: REGION, required: true, half: true },
      { key: "paymentTermsDays", label: "Payment terms (days)", input: "number", min: 0, max: 180, required: true, half: true },
      { key: "gstin", label: "GSTIN", input: "text", maxLength: 15, pattern: { re: GSTIN, message: "15 characters, e.g. 27ABCDE1234F1Z5" }, half: true },
      { key: "annualRevenue", label: "Annual turnover (₹)", input: "money", min: 0, placeholder: "e.g. 25Cr", half: true },
      { key: "phone", label: "Phone", input: "tel", pattern: { re: PHONE, message: "Enter a valid phone number" }, half: true },
      { key: "website", label: "Website", input: "url", maxLength: 200, half: true },
    ],
  },
  contacts: {
    fields: [
      { key: "firstName", label: "First name", input: "text", required: true, maxLength: 60, half: true },
      { key: "lastName", label: "Last name", input: "text", required: true, maxLength: 60, half: true },
      { key: "companyId", label: "Company", input: "relation", optionsKey: "company", required: true },
      { key: "title", label: "Job title", input: "text", maxLength: 80, half: true },
      { key: "ownerId", label: "Owner", input: "relation", optionsKey: "owner", half: true },
      { key: "email", label: "Email", input: "email", required: true, maxLength: 120, half: true },
      { key: "phone", label: "Phone", input: "tel", pattern: { re: PHONE, message: "Enter a valid phone number" }, half: true },
      { key: "isPrimary", label: "Primary contact for this company", input: "checkbox" },
    ],
  },
  leads: {
    fields: [
      { key: "name", label: "Name", input: "text", required: true, maxLength: 120, half: true },
      { key: "companyName", label: "Company", input: "text", required: true, maxLength: 120, half: true },
      { key: "email", label: "Email", input: "email", required: true, maxLength: 120, half: true },
      { key: "phone", label: "Phone", input: "tel", pattern: { re: PHONE, message: "Enter a valid phone number" }, half: true },
      { key: "source", label: "Source", input: "select", options: LEAD_SOURCE, required: true, half: true },
      { key: "status", label: "Status", input: "select", options: LEAD_STATUS.filter((o) => o.value !== "converted"), required: true, half: true, help: "Use “Convert” to turn a lead into a company." },
      { key: "score", label: "Score (0–100)", input: "number", min: 0, max: 100, required: true, half: true },
      { key: "ownerId", label: "Owner", input: "relation", optionsKey: "owner", half: true },
      { key: "city", label: "City", input: "text", required: true, maxLength: 60, half: true },
      { key: "state", label: "State", input: "select", options: STATES, required: true, half: true },
    ],
  },
  deals: {
    fields: [
      { key: "title", label: "Deal title", input: "text", required: true, maxLength: 140 },
      { key: "companyId", label: "Company", input: "relation", optionsKey: "company", required: true },
      { key: "contactId", label: "Contact", input: "relation", optionsKey: "contact", dependsOn: "companyId", half: true },
      { key: "ownerId", label: "Owner", input: "relation", optionsKey: "owner", half: true },
      { key: "stage", label: "Stage", input: "select", options: DEAL_STAGE, required: true, half: true },
      { key: "value", label: "Value (₹, incl. GST)", input: "money", min: 1, required: true, placeholder: "e.g. 12.5L", half: true },
      { key: "probability", label: "Probability (%)", input: "number", min: 0, max: 100, half: true, help: "Leave empty to use the stage default." },
      { key: "expectedClose", label: "Expected close", input: "date", required: true, half: true },
      { key: "source", label: "Source", input: "select", options: LEAD_SOURCE, half: true },
      { key: "lostReason", label: "Lost reason", input: "select", options: opt(LOST_REASONS), half: true, showWhen: { field: "stage", equals: "lost" } },
    ],
    check: (v): Record<string, string> => (v.stage === "lost" && !v.lostReason ? { lostReason: "Required when a deal is lost" } : {}),
  },
};

const email = z.email();
const url = z.url({ protocol: /^https?$/ });

/** Coerces and validates one raw value (string from a form, or a typed value from code). */
function parseField(f: FormField, raw: unknown): { value: unknown } | { error: string } {
  const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
  if (f.input === "checkbox") return { value: raw === true || raw === "on" || raw === "true" };
  if (empty) return f.required ? { error: "Required" } : { value: null };
  const s = typeof raw === "string" ? raw.trim() : raw;
  switch (f.input) {
    case "text":
    case "textarea":
    case "tel": {
      const str = String(s);
      if (f.maxLength && str.length > f.maxLength) return { error: `At most ${f.maxLength} characters` };
      if (f.pattern && !f.pattern.re.test(f.key === "gstin" ? str.toUpperCase() : str)) return { error: f.pattern.message };
      return { value: f.key === "gstin" ? str.toUpperCase() : str };
    }
    case "email":
      return email.safeParse(String(s).toLowerCase()).success ? { value: String(s).toLowerCase() } : { error: "Enter a valid email" };
    case "url": {
      const withScheme = /^https?:\/\//i.test(String(s)) ? String(s) : `https://${s}`;
      return url.safeParse(withScheme).success && (!f.maxLength || withScheme.length <= f.maxLength) ? { value: withScheme } : { error: "Enter a valid web address" };
    }
    case "number": {
      const n = typeof s === "number" ? s : Number(s);
      if (!Number.isInteger(n)) return { error: "Enter a whole number" };
      if (f.min !== undefined && n < f.min) return { error: `Must be at least ${f.min}` };
      if (f.max !== undefined && n > f.max) return { error: `Must be at most ${f.max}` };
      return { value: n };
    }
    case "money": {
      const n = typeof s === "number" ? s : parseAmount(String(s));
      if (n === null || !Number.isFinite(n)) return { error: "Enter an amount, e.g. 12.5L or 1250000" };
      if (f.min !== undefined && n < f.min) return { error: `Must be at least ₹${f.min}` };
      if (n > 1e12) return { error: "Amount too large" };
      return { value: n };
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !Number.isNaN(Date.parse(String(s))) ? { value: String(s) } : { error: "Enter a date" };
    case "select":
      return f.options?.some((o) => o.value === String(s)) ? { value: String(s) } : { error: "Choose an option" };
    case "relation": {
      const n = typeof s === "number" ? s : Number(s);
      return Number.isInteger(n) && n > 0 ? { value: n } : { error: "Choose an option" };
    }
  }
}

/**
 * Validates a whole form (or, with `partial`, only the keys present). Unknown keys are ignored.
 * Returns typed values keyed by column, or per-field errors.
 */
export function validateForm(form: EntityForm, raw: Record<string, unknown>, opts: { partial?: boolean } = {}) {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const f of form.fields) {
    if (opts.partial && !(f.key in raw)) continue;
    const r = parseField(f, raw[f.key]);
    if ("error" in r) errors[f.key] = r.error;
    else values[f.key] = r.value;
  }
  if (!opts.partial && !Object.keys(errors).length && form.check) Object.assign(errors, form.check(values));
  return Object.keys(errors).length ? { ok: false as const, errors } : { ok: true as const, values };
}
