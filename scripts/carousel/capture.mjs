/**
 * Screenshots of every page and section for presenting (LinkedIn carousels etc.).
 * Needs the production site on :3000 (`npm run build && npx next start -p 3000` — no dev badge).
 * Desktop 1440×900 @2x, phone 390×844 @3x → presentation/screens/*.png
 * Run: node scripts/carousel/capture.mjs [name-filter]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const B = process.env.BASE_URL ?? "http://localhost:3000";
// --tall: a taller desktop window (1440×1368 = the carousel frame's shape) for build.mjs, so slides show
// the page's full width without cropping. Default: normal 16:10 screenshots for general use.
const TALL = process.argv.includes("--tall");
const OUT = TALL ? "presentation/.tall" : "presentation/screens";
mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2).find((a) => !a.startsWith("--"));

// Clean frame: no custom cursor dot, no chat launcher, no focus rings from programmatic clicks.
const CLEAN = `#cursor, .asst-launcher, .asst-panel { display: none !important; } *:focus { outline: none !important; }`;

const browser = await chromium.launch();
const VP = { width: 1440, height: TALL ? 1368 : 900 }; // 1440×1368 = the slide frame (958×910)
const desktop = await browser.newContext({ viewport: VP, deviceScaleFactor: 2, reducedMotion: "reduce" });
const desktopMotion = await browser.newContext({ viewport: VP, deviceScaleFactor: 2 });
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const phoneMotion = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

const wait = (p, ms) => p.waitForTimeout(ms);
async function open(ctx, path, settle = 1200) {
  const p = await ctx.newPage();
  await p.goto(B + path, { waitUntil: "networkidle", timeout: 60000 });
  await p.addStyleTag({ content: CLEAN });
  await wait(p, settle);
  return p;
}
/** Scroll an element to the top of the screen through the smooth scroller, then shoot the viewport. */
async function viewportAt(p, selector, offset = 0) {
  await p.evaluate(([sel, off]) => {
    const el = document.querySelector(sel);
    const y = el.getBoundingClientRect().top + window.scrollY - off;
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true });
    else window.scrollTo(0, y);
  }, [selector, offset]);
  await wait(p, 900);
}
async function shot(p, name, opts = {}) {
  await p.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  console.log("✓", name);
}

const jobs = [
  // ── Home ──────────────────────────────────────────────
  ["home-hero", async () => { const p = await open(desktopMotion, "/", 9500); await shot(p, "home-hero"); }],
  ["home-about", async () => { const p = await open(desktop, "/"); await viewportAt(p, "#about", -10); await shot(p, "home-about"); }],
  ["home-what-i-build", async () => { const p = await open(desktop, "/"); await shot(p, "home-what-i-build", { clip: undefined }); const el = p.locator(".about-v2 .about-block").nth(0); await el.scrollIntoViewIfNeeded(); await wait(p, 700); await el.screenshot({ path: `${OUT}/home-what-i-build.png` }); }],
  ["home-experience", async () => { const p = await open(desktop, "/"); const el = p.locator(".about-v2 .about-block").nth(1); await el.scrollIntoViewIfNeeded(); await wait(p, 700); await el.screenshot({ path: `${OUT}/home-experience.png` }); console.log("✓ home-experience"); }],
  ["home-tech", async () => { const p = await open(desktop, "/"); const el = p.locator(".about-v2 .about-block").nth(2); await el.scrollIntoViewIfNeeded(); await wait(p, 700); await el.screenshot({ path: `${OUT}/home-tech.png` }); console.log("✓ home-tech"); }],
  ["home-work", async () => { const p = await open(desktop, "/"); await viewportAt(p, "#work"); await shot(p, "home-work"); const el = p.locator(".rent-section"); await el.screenshot({ path: `${OUT}/home-work-full.png` }); console.log("✓ home-work-full"); }],
  ["home-clients", async () => { const p = await open(desktop, "/"); await viewportAt(p, "#clients", 40); await shot(p, "home-clients"); }],
  ["home-contact", async () => { const p = await open(desktop, "/"); await viewportAt(p, "#contact", 20); await shot(p, "home-contact"); }],
  ["drawer-automation", async () => {
    const p = await open(desktop, "/"); await viewportAt(p, "#work");
    await p.locator("button[aria-label='Open AI Workflow Automation']").click(); await wait(p, 2200);
    await p.addStyleTag({ content: CLEAN }); await shot(p, "drawer-automation");
  }],
  ["drawer-cv", async () => {
    const p = await open(desktop, "/"); await viewportAt(p, "#work");
    await p.locator("button[aria-label='Open Computer Vision & Robotics']").click(); await wait(p, 2200);
    await p.addStyleTag({ content: CLEAN }); await shot(p, "drawer-cv");
  }],
  // ── Pages ─────────────────────────────────────────────
  ["page-solutions", async () => { const p = await open(desktop, "/solutions"); await shot(p, "page-solutions"); }],
  ["page-demos", async () => { const p = await open(desktop, "/demos"); await shot(p, "page-demos"); }],
  ["page-work-ai", async () => { const p = await open(desktop, "/work?field=ai"); await viewportAt(p, ".inner-head", 90); await shot(p, "page-work-ai"); }],
  ["page-work-cv", async () => { const p = await open(desktop, "/work?field=cv"); await viewportAt(p, ".inner-head", 90); await shot(p, "page-work-cv"); }],
  ["page-contact", async () => { const p = await open(desktop, "/contact"); await shot(p, "page-contact"); }],
  ...["docdesk", "front-desk-voice", "ops-suite", "surroundsense", "visual-slam-to-navigation", "targetless-camera-lidar-calibration", "edge-pose-estimation", "edge-ai-quantization"].map((slug) => [
    `case-${slug}`,
    async () => { const p = await open(desktop, `/work/${slug}`); await shot(p, `case-${slug}`); },
  ]),
  ["case-slam-how", async () => { const p = await open(desktop, "/work/visual-slam-to-navigation"); await viewportAt(p, ".detail-grid", 40); await shot(p, "case-slam-how"); }],
  ["case-calibration-how", async () => { const p = await open(desktop, "/work/targetless-camera-lidar-calibration"); await viewportAt(p, ".detail-grid", 40); await shot(p, "case-calibration-how"); }],
  // ── Demo apps ─────────────────────────────────────────
  ["app-autopilot", async () => {
    const p = await open(desktop, "/demos/autopilot/app", 1500);
    for (let i = 0; i < 3; i++) { const b = p.locator(".ap-option").first(); if (await b.count()) { await b.click(); await wait(p, 1400); } }
    await shot(p, "app-autopilot");
  }],
  ["app-ops-dashboard", async () => { const p = await open(desktop, "/demos/ops-suite/app", 1800); await shot(p, "app-ops-dashboard"); }],
  ["app-ops-companies", async () => { const p = await open(desktop, "/demos/ops-suite/app/companies", 1500); await shot(p, "app-ops-companies"); }],
  ["app-ops-board", async () => { const p = await open(desktop, "/demos/ops-suite/app/deals/board", 1500); await shot(p, "app-ops-board"); }],
  ["app-ops-ask", async () => {
    const p = await open(desktop, "/demos/ops-suite/app/ask", 1500);
    await p.locator(".ai-chip").first().click(); await wait(p, 3500); await shot(p, "app-ops-ask");
  }],
  ["app-docdesk-library", async () => { const p = await open(desktop, "/demos/document-intelligence/app", 1500); await shot(p, "app-docdesk-library"); }],
  ["app-docdesk-ask", async () => {
    const p = await open(desktop, "/demos/document-intelligence/app/d/msa-kestrel-v1", 2000);
    await p.locator(".dd-suggest button").first().click(); await wait(p, 3500); await shot(p, "app-docdesk-ask");
  }],
  ["app-docdesk-quality", async () => { const p = await open(desktop, "/demos/document-intelligence/app/quality", 1500); await shot(p, "app-docdesk-quality"); }],
  ["app-docdesk-compare", async () => { const p = await open(desktop, "/demos/document-intelligence/app/compare", 1500); await shot(p, "app-docdesk-compare"); }],
  ["app-voice", async () => { const p = await open(desktop, "/demos/voice-ai/app", 1800); await shot(p, "app-voice"); }],
  ["app-support", async () => { const p = await open(desktop, "/demos/customer-support", 1800); await shot(p, "app-support"); }],
  // ── Phone ─────────────────────────────────────────────
  ["phone-hero", async () => { const p = await open(phoneMotion, "/", 9500); await shot(p, "phone-hero"); }],
  ["phone-about", async () => { const p = await open(phone, "/"); await viewportAt(p, ".about-body", 10); await shot(p, "phone-about"); }],
  ["phone-cards", async () => { const p = await open(phone, "/"); await viewportAt(p, ".about-v2 .about-block", 10); await shot(p, "phone-cards"); }],
  ["phone-work", async () => { const p = await open(phone, "/work?field=cv"); await viewportAt(p, ".work-tabs", 120); await shot(p, "phone-work"); }],
  ["phone-autopilot", async () => {
    const p = await open(phone, "/demos/autopilot/app", 1500);
    for (let i = 0; i < 2; i++) { const b = p.locator(".ap-option").first(); if (await b.count()) { await b.click(); await wait(p, 1400); } }
    await shot(p, "phone-autopilot");
  }],
  ["phone-docdesk", async () => { const p = await open(phone, "/demos/document-intelligence/app/d/msa-kestrel-v1", 2000); await shot(p, "phone-docdesk"); }],
  ["phone-voice", async () => { const p = await open(phone, "/demos/voice-ai/app", 1800); await shot(p, "phone-voice"); }],
];

for (const [name, run] of jobs) {
  if (only && !name.includes(only)) continue;
  try { await run(); } catch (e) { console.log("✗", name, String(e).split("\n")[0]); }
}
await browser.close();
