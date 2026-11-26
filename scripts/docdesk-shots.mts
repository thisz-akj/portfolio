/**
 * `npm run shots:docdesk` — captures DocDesk screenshots for the portfolio (public/work/docdesk-*.webp).
 * Needs the site (BASE, default http://localhost:3000) and the DocDesk service running. Uses only pre-written
 * examples and rule-based screens, so it makes no AI calls. Images are the owner's own work (docs/credits.md).
 */
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import sharp from "sharp";

const BASE = (process.env.BASE ?? "http://localhost:3000") + "/demos/document-intelligence/app";
const OUT = "public/work";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
  reducedMotion: "reduce",
  extraHTTPHeaders: { "x-forwarded-for": "10.0.0.250" },
});
const page = await ctx.newPage();

async function shot(name: string, go: (p: Page) => Promise<void>) {
  await go(page);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => [...document.querySelectorAll("img")].filter((i) => i.getBoundingClientRect().top < innerHeight).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 });
  await page.waitForTimeout(900);
  const png = await page.screenshot({ type: "png" });
  const file = join(OUT, `docdesk-${name}.webp`);
  await sharp(png).webp({ quality: 82 }).toFile(file);
  console.log(`✓ ${file}`);
}

await shot("ask", async (p) => {
  await p.goto(`${BASE}/d/msa-kestrel-v1`);
  await p.getByRole("button", { name: /termination notice period/ }).first().click();
  await p.waitForSelector(".dd-hl");
});
await shot("checks", async (p) => {
  await p.goto(`${BASE}/d/invoice-kaveri-1187?tab=checks`);
  await p.waitForSelector(".dd-check");
  await p.locator("button.dd-check").first().click();
  await p.waitForSelector(".dd-hl");
});
await shot("fields", async (p) => {
  await p.goto(`${BASE}/d/lease-indigo-park?tab=fields`);
  await p.waitForSelector(".dd-fields tbody tr");
  await p.locator(".dd-link-btn").nth(7).click();
  await p.waitForSelector(".dd-hl");
});
await shot("match", async (p) => {
  await p.goto(`${BASE}/compare?a=po-saffron-0932&b=invoice-kaveri-1187`);
  await p.waitForSelector(".dd-verdict");
  await p.locator(".dd-change").nth(1).click();
  await p.waitForSelector(".dd-hl");
});
await shot("redline", async (p) => {
  await p.goto(`${BASE}/compare?a=msa-kestrel-v1&b=msa-kestrel-v2`);
  await p.waitForSelector(".dd-change");
  await p.locator(".dd-change").nth(7).click();
  await p.waitForSelector(".dd-hl");
});
await shot("library", async (p) => {
  await p.goto(BASE);
  await p.waitForSelector(".dd-doc img");
});
await shot("quality", async (p) => {
  await p.goto(`${BASE}/quality`);
  await p.waitForSelector(".dd-kpi");
});
await browser.close();
