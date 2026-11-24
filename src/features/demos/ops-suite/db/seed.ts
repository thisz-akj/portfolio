import type { Db } from "./client";
import { users } from "./schema";

/**
 * Deterministic synthetic seed. Phase 0: the demo personas behind the role switcher.
 * Phase 1 adds generic Indian B2B data (companies, deals, products, orders, invoices) via a seeded faker.
 * Idempotent: safe to run repeatedly.
 */
export const personas = [
  { name: "Demo Admin", email: "admin@ops-suite.demo", role: "admin" },
  { name: "Riya Mehta", email: "riya.sales@ops-suite.demo", role: "sales" },
  { name: "Arjun Nair", email: "arjun.sales@ops-suite.demo", role: "sales" },
  { name: "Kavya Iyer", email: "kavya.warehouse@ops-suite.demo", role: "warehouse" },
] as const;

export async function seed(db: Db) {
  await db.insert(users).values([...personas]).onConflictDoNothing({ target: users.email });
  console.log(`✓ seeded ${personas.length} personas`);
}
