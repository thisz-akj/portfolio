/**
 * `npm run shots:autopilot` — captures Autopilot screenshots for the portfolio (public/work/autopilot-*.webp).
 * Needs the site running (BASE, default http://localhost:3000). Uses tapped replies only: 0 tokens.
 * Images are the owner's own work (docs/credits.md).
 */
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import sharp from "sharp";

const APP = (process.env.BASE ?? "http://localhost:3000") + "/demos/autopilot/app";
const OUT = "public/work";

async function tap(p: Page, label: string | RegExp) {
  const done = p.waitForResponse((r) => r.url().includes("/api/demos/autopilot/run"));
  await p.locator(".ap-option", { hasText: label }).first().click();
  await done;
  await p.waitForTimeout(400);
}

async function open(p: Page, scenario: string) {
  const done = p.waitForResponse((r) => r.url().includes("/api/demos/autopilot/run"));
  await p.goto(`${APP}?s=${scenario}`);
  await done;
  await p.waitForSelector(".ap-option");
  await p.waitForTimeout(300);
}

async function focus(p: Page, text: string) {
  await p.locator(".ap-step-title", { hasText: text }).first().evaluate((el) => el.scrollIntoView({ block: "center" }));
}

async function main() {
  const browser = await browser_();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, colorScheme: "dark", reducedMotion: "reduce", extraHTTPHeaders: { "x-forwarded-for": "10.0.0.252" } });
  await ctx.addInitScript(() => {
    const style = () => document.head?.insertAdjacentHTML("beforeend", "<style>nextjs-portal{display:none!important}</style>");
    if (document.head) style();
    else document.addEventListener("DOMContentLoaded", style);
  });
  const page = await ctx.newPage();

  async function shot(name: string, go: (p: Page) => Promise<void>) {
    await go(page);
    await page.waitForTimeout(700);
    const png = await page.screenshot({ type: "png" });
    const file = join(OUT, `autopilot-${name}.webp`);
    await sharp(png).webp({ quality: 82 }).toFile(file);
    console.log(`✓ ${file}`);
  }

  await shot("lead", async (p) => {
    await open(p, "lead-to-cash");
    await tap(p, "Ravi, Sri Sai Foods");
    await p.locator(".ap-team").evaluate((el) => el.scrollIntoView({ block: "end" }));
  });
  await shot("clinic", async (p) => {
    await open(p, "no-show");
    await tap(p, "can't make it");
    await focus(p, "Slot offered to Rahul");
  });
  await shot("invoice", async (p) => {
    await open(p, "invoice");
    await tap(p, "only 1,950 kg");
    await p.locator(".ap-team").evaluate((el) => el.scrollIntoView({ block: "end" }));
  });
  await shot("service", async (p) => {
    await open(p, "service-job");
    await tap(p, "Indiranagar");
    await focus(p, "Nearest free technician");
  });
  await shot("report", async (p) => {
    await open(p, "lead-to-cash");
    await tap(p, "Ravi, Sri Sai Foods");
    await tap(p, /^Approve$/);
    await tap(p, "Pay now");
    await p.locator(".ap-report").evaluate((el) => el.scrollIntoView({ block: "end" }));
  });

  await browser.close();
}

const browser_ = () => chromium.launch();

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
