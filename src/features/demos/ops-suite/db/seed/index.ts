import { getTableName, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Db } from "../client";
import * as s from "../schema";
import { generate, type GenerateOptions, type SeedData } from "./generate";

/**
 * Replaces all Ops Suite data with a fresh deterministic dataset, in one transaction
 * (readers never see a half-seeded database). Safe to re-run; used by `npm run db:seed` and the nightly reset.
 */

/** Insert order respects foreign keys. */
const plan: [keyof SeedData, PgTable][] = [
  ["users", s.users],
  ["tags", s.tags],
  ["companies", s.companies],
  ["contacts", s.contacts],
  ["leads", s.leads],
  ["deals", s.deals],
  ["activities", s.activities],
  ["products", s.products],
  ["warehouses", s.warehouses],
  ["inventory", s.inventory],
  ["suppliers", s.suppliers],
  ["purchaseOrders", s.purchaseOrders],
  ["purchaseOrderLines", s.purchaseOrderLines],
  ["salesOrders", s.salesOrders],
  ["salesOrderLines", s.salesOrderLines],
  ["invoices", s.invoices],
  ["payments", s.payments],
  ["datasets", s.datasets],
  ["importJobs", s.importJobs],
  ["importRejectedRows", s.importRejectedRows],
  ["entityTags", s.entityTags],
  ["auditLog", s.auditLog],
];

/** Tables whose `id` comes from a sequence that must continue after the explicit seed ids. */
const serialTables = plan.map(([, t]) => t).filter((t) => t !== s.inventory && t !== s.entityTags);

const CHUNK = 1000;

export async function seed(db: Db, opts: GenerateOptions = {}) {
  const data = generate(opts);
  await db.transaction(async (tx) => {
    const names = plan.map(([, t]) => `"${getTableName(t)}"`).join(", ");
    await tx.execute(sql.raw(`truncate ${names} restart identity cascade`));
    for (const [key, table] of plan) {
      const rows = data[key] as Record<string, unknown>[];
      for (let i = 0; i < rows.length; i += CHUNK) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await tx.insert(table).values(rows.slice(i, i + CHUNK) as any);
      }
    }
    for (const t of serialTables) {
      const name = getTableName(t);
      await tx.execute(sql.raw(`select setval(pg_get_serial_sequence('"${name}"', 'id'), coalesce(max(id), 0) + 1, false) from "${name}"`));
    }
  });
  const counts = Object.fromEntries(plan.map(([k]) => [k, data[k].length]));
  console.log(`✓ seeded ${Object.values(counts).reduce((a, b) => a + b, 0)} rows`, counts);
  return counts;
}
