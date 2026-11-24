/**
 * CLI for the Ops Suite database: `tsx src/features/demos/ops-suite/db/scripts.ts <migrate|seed|reset>`.
 * Wired up as `npm run db:migrate`, `db:seed`, `db:reset`. Reads DATABASE_URL from .env.local.
 */
import { sql } from "drizzle-orm";
import { closeDb, getHandle, migrationsFolder } from "./client";
import { seed } from "./seed";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local: DATABASE_URL must come from the environment */
}

async function migrate() {
  const { db, driver } = await getHandle();
  if (driver === "postgres") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder });
  } // PGlite migrates itself in getHandle()
  console.log(`✓ migrated (${driver})`);
}

async function reset() {
  const { db } = await getHandle();
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await closeDb();
  await migrate();
  await seed(await (await getHandle()).db);
}

const commands: Record<string, () => Promise<void>> = {
  migrate,
  seed: async () => {
    await migrate();
    await seed((await getHandle()).db);
  },
  reset,
};

const cmd = process.argv[2] ?? "";
if (!commands[cmd]) {
  console.error(`usage: scripts.ts <${Object.keys(commands).join("|")}>`);
  process.exit(1);
}
commands[cmd]()
  .then(closeDb)
  .catch(async (err) => {
    console.error(err);
    await closeDb().catch(() => {});
    process.exit(1);
  });
