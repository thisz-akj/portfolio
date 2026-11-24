import { defineConfig } from "drizzle-kit";

// `npm run db:generate` diffs the schema against /drizzle and writes a new SQL migration (no DB connection needed).
// `npm run db:studio` opens Drizzle Studio against DATABASE_URL (loaded from .env.local).
try {
  process.loadEnvFile(".env.local");
} catch {}
const url = process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/features/demos/ops-suite/db/schema/index.ts",
  out: "./drizzle",
  ...(url ? { dbCredentials: { url } } : {}),
  strict: true,
});
