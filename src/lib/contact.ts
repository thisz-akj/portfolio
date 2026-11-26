export const PROJECT_TYPES = [
  "AI feature for my product",
  "Make our AI reliable (evaluation)",
  "Computer vision / robotics",
  "Part-time engineering collaboration",
  "Something else",
] as const;

/** Sent by the "let's run it live" pop-up (LiveDemoDialog); not offered in the contact page's dropdown. */
export const LIVE_DEMO_TYPE = "Live demo request";

export interface ContactInput {
  name: string;
  email: string;
  company?: string;
  type: string;
  message: string;
  /** honeypot — must be empty */
  website?: string;
}

export type ContactErrors = Partial<Record<keyof ContactInput, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LIMITS = { name: 100, email: 200, company: 120, message: 5000 };

/** Shared by the client form and the API route — the server is the source of truth. */
export function validateContact(raw: unknown): { ok: true; data: ContactInput } | { ok: false; errors: ContactErrors } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const data: ContactInput = {
    name: str(r.name),
    email: str(r.email),
    company: str(r.company),
    type: str(r.type),
    message: str(r.message),
    website: str(r.website),
  };
  const errors: ContactErrors = {};
  if (!data.name) errors.name = "Please tell me your name.";
  else if (data.name.length > LIMITS.name) errors.name = "That name is a bit long.";
  if (!EMAIL_RE.test(data.email) || data.email.length > LIMITS.email) errors.email = "Please enter a valid email address.";
  if ((data.company ?? "").length > LIMITS.company) errors.company = "Company name is too long.";
  if (!PROJECT_TYPES.includes(data.type as (typeof PROJECT_TYPES)[number]) && data.type !== LIVE_DEMO_TYPE) errors.type = "Please pick a project type.";
  if (data.message.length < 20) errors.message = "A couple of sentences (20+ characters) helps me reply usefully.";
  else if (data.message.length > LIMITS.message) errors.message = "Please keep it under 5,000 characters.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}
