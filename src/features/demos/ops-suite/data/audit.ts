import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { auditLog, users } from "../db/schema";

/** Shared write helpers: transaction type, acting user, audit rows. Server-only. */

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Actor = { id: number; name: string } | null;

/** Entity key (URL slug) → audit_log.entity (table name). */
export const AUDIT_NAME: Record<string, string> = {
  "sales-orders": "sales_orders",
  "purchase-orders": "purchase_orders",
};
export const auditName = (entity: string) => AUDIT_NAME[entity] ?? entity;

/** The acting user: the persona picked in the top bar (admin outside a request). */
export async function currentActor(db: Db | Tx): Promise<Actor> {
  // look up through the caller's connection/transaction (PGlite has a single connection)
  const { personaCookieId, PERSONA_EMAILS } = await import("../auth/persona.server");
  const id = await personaCookieId();
  if (id) {
    const [p] = await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.id, id), inArray(users.email, PERSONA_EMAILS)));
    if (p) return p;
  }
  const [u] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, "admin")).orderBy(users.id).limit(1);
  return u ?? null;
}

export async function writeAudit(tx: Tx, actor: Actor, entity: string, id: number, action: string, summary: string, before: Record<string, unknown> | null = null, after: Record<string, unknown> | null = null) {
  await tx.insert(auditLog).values({ actorId: actor?.id ?? null, action, entity: auditName(entity), entityId: String(id), summary, before, after });
}

/** Thrown inside a transaction to abort it with a user-facing message. */
export class FlowError extends Error {}
