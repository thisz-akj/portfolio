import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import type { Role } from "./permissions";

/**
 * The demo has no passwords: visitors pick a persona (cookie), which decides permissions and who audit rows
 * are attributed to. Outside a request (tests, scripts, cron) the persona is the admin. Server-only.
 */

export const PERSONA_COOKIE = "ops_persona";
export const PERSONA_EMAILS = ["admin@ops-suite.example", "riya.mehta@ops-suite.example", "kavya.iyer@ops-suite.example"];

export interface Persona {
  id: number;
  name: string;
  role: Role;
}

export async function listPersonas(): Promise<Persona[]> {
  const db = await getDb();
  const rows = await db.select({ id: users.id, name: users.name, role: users.role, email: users.email }).from(users).where(inArray(users.email, PERSONA_EMAILS)).orderBy(asc(users.id));
  return rows.map(({ id, name, role }) => ({ id, name, role }));
}

export async function personaCookieId(): Promise<number | null> {
  try {
    const { cookies } = await import("next/headers");
    const raw = (await cookies()).get(PERSONA_COOKIE)?.value;
    return raw && /^\d{1,9}$/.test(raw) ? Number(raw) : null;
  } catch {
    return null; // not inside a request
  }
}

/** The persona for this request; falls back to the first admin if the cookie is missing or stale. */
export async function getPersona(): Promise<Persona | null> {
  const db = await getDb();
  const id = await personaCookieId();
  if (id) {
    const [u] = await db.select({ id: users.id, name: users.name, role: users.role, email: users.email }).from(users).where(eq(users.id, id));
    if (u && PERSONA_EMAILS.includes(u.email)) return { id: u.id, name: u.name, role: u.role };
  }
  const [admin] = await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.role, "admin")).orderBy(asc(users.id)).limit(1);
  return admin ?? null;
}
