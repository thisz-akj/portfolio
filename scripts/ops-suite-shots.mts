/**
 * `npm run shots` — captures Ops Suite screenshots for the portfolio (public/work/ops-suite-*.webp).
 * Needs the app running (BASE, default http://localhost:3000) on a seeded database, and Playwright's Chromium
 * (`npx playwright install chromium`). Re-run after UI changes; images are the owner's own work (docs/credits.md).
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import sharp from "sharp";
import { and, desc, eq, sql } from "drizzle-orm";

try {
  process.loadEnvFile(".env.local");
} catch {}
const { getDb, closeDb } = await import("../src/features/demos/ops-suite/db/client");
const s = await import("../src/features/demos/ops-suite/db/schema");

const BASE = (process.env.BASE ?? "http://localhost:3000") + "/demos/ops-suite/app";
const OUT = "public/work";
const db = await getDb();

const [order] = await db
  .select({ id: s.salesOrders.id })
  .from(s.salesOrders)
  .where(and(eq(s.salesOrders.status, "draft"), sql`(select count(*) from sales_order_lines l where l.sales_order_id = ${s.salesOrders.id}) >= 3`))
  .orderBy(desc(s.salesOrders.total))
  .limit(1);
const [orderAny] = order ? [order] : await db.select({ id: s.salesOrders.id }).from(s.salesOrders).where(eq(s.salesOrders.status, "confirmed")).orderBy(desc(s.salesOrders.total)).limit(1);
const [stockDs] = await db.select({ id: s.datasets.id, slug: s.datasets.slug }).from(s.datasets).where(eq(s.datasets.slug, "stock-count"));
await closeDb();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, colorScheme: "dark", reducedMotion: "reduce" });
const page = await ctx.newPage();

async function shot(name: string, go: (p: Page) => Promise<void>) {
  await go(page);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  const png = await page.screenshot({ type: "png" });
  const file = join(OUT, `ops-suite-${name}.webp`);
  await sharp(png).webp({ quality: 82 }).toFile(file);
  console.log(`✓ ${file}`);
}

await shot("dashboard", async (p) => {
  await p.goto(BASE);
  await p.waitForSelector(".ops-kpis");
});
await shot("board", async (p) => {
  await p.goto(`${BASE}/deals/board`);
  await p.waitForSelector(".ops-board");
});
await shot("order", async (p) => {
  await p.goto(`${BASE}/sales-orders/${orderAny.id}`);
  await p.waitForSelector(".ops-lines");
});
await shot("collections", async (p) => {
  await p.goto(`${BASE}/companies?f=${encodeURIComponent('[["outstanding","gt",1000000]]')}&sort=-outstanding`);
  await p.waitForSelector(".ops-table");
});
await shot("import", async (p) => {
  const sample = await (await fetch(`${BASE.replace("/demos/ops-suite/app", "")}/api/demos/ops-suite/datasets/${stockDs.slug}/sample`)).text();
  const dir = mkdtempSync(join(tmpdir(), "ops-shots-"));
  const file = join(dir, "cycle-count-november.csv");
  writeFileSync(file, sample);
  await p.goto(`${BASE}/datasets/${stockDs.id}`);
  await p.getByRole("button", { name: "Import CSV" }).click();
  await p.setInputFiles('input[type="file"]', file);
  await p.getByRole("button", { name: "Preview" }).click();
  await p.waitForSelector(".ops-preview");
  await p.locator(".ops-mapping").scrollIntoViewIfNeeded();
});
await shot("ask", async (p) => {
  await p.goto(`${BASE}/ask`);
  await p.locator(".ai-chip", { hasText: "dropped the most" }).click();
  await p.waitForSelector(".ai-answer");
});

await browser.close();
