import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * Server-only database access for the Ops Suite demo.
 * - App (dev + prod): DATABASE_URL is required — local Postgres in .env.local, Neon (pooled URL) on Vercel.
 * - Tests only: set OPS_PGLITE_DIR (e.g. "memory://") to use PGlite, an in-process Postgres that
 *   migrates itself on first use. Ignored when DATABASE_URL is set.
 * Never import this from a client component.
 */

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type DbDriver = "postgres" | "pglite";

export const migrationsFolder = path.join(process.cwd(), "drizzle");
export function dbDriver(): DbDriver {
  if (process.env.DATABASE_URL) return "postgres";
  if (process.env.OPS_PGLITE_DIR) return "pglite";
  throw new Error("DATABASE_URL is not set (see docs/demos/ops-suite.md).");
}

interface Handle {
  db: Db;
  driver: DbDriver;
  close: () => Promise<void>;
}

async function connect(): Promise<Handle> {
  if (dbDriver() === "postgres") {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    // prepare: false keeps it compatible with transaction poolers (Supabase/Neon/PgBouncer).
    // max_pipeline: 1 — Supabase's transaction pooler hangs on pipelined queries (parallel queries on one
    // connection sit in ClientRead until the 2 min statement timeout); one in flight per connection fixes it.
    const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 5, max_pipeline: 1 });
    return { db: drizzle({ client: sql, schema }) as unknown as Db, driver: "postgres", close: () => sql.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.OPS_PGLITE_DIR!;
  if (!dir.startsWith("memory://")) mkdirSync(path.resolve(dir), { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder });
  return { db: db as unknown as Db, driver: "pglite", close: () => client.close() };
}

// Cached on globalThis so dev hot-reloads reuse one connection (and one pool per process).
const g = globalThis as unknown as { __opsDb?: Promise<Handle> };

export function getHandle(): Promise<Handle> {
  if (!g.__opsDb) {
    g.__opsDb = connect().catch((err) => {
      g.__opsDb = undefined;
      throw err;
    });
  }
  return g.__opsDb;
}

export const getDb = async () => (await getHandle()).db;

export async function closeDb() {
  const h = g.__opsDb;
  g.__opsDb = undefined;
  if (h) await (await h).close();
}
