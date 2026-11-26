/**
 * Phone audit: loads every page at 390×844 (site on :3000) and reports anything cut off past the
 * screen edge, page-level sideways scroll, text under 11px and tap targets under 30px.
 * Screenshots of the first screen go to .logs/mobile-audit/. Run: npm run audit:mobile
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const OUT = ".logs/mobile-audit";
mkdirSync(OUT, { recursive: true });
const B = process.env.BASE_URL ?? "http://localhost:3000";
const O = "/demos/ops-suite/app";
const D = "/demos/document-intelligence/app";
let urls = ["/", "/solutions", "/demos", "/work", "/contact", "/nope-404",
  ...["autopilot", "ops-suite", "document-intelligence", "computer-vision", "customer-support", "voice-ai"].map((s) => `/demos/${s}`),
  ...["ops-suite", "docdesk", "front-desk-voice", "surroundsense", "edge-pose-estimation", "targetless-camera-lidar-calibration", "visual-slam-to-navigation", "edge-ai-quantization"].map((s) => `/work/${s}`),
  "/demos/autopilot/app", "/demos/voice-ai/app",
  D, `${D}/d/msa-kestrel-v1`, `${D}/compare`, `${D}/review`, `${D}/quality`,
  O, `${O}/ask`, `${O}/ai-quality`, ...["companies", "contacts", "leads", "deals", "products", "inventory", "sales-orders", "purchase-orders", "invoices", "payments", "datasets", "imports", "audit-log"].map((e) => `${O}/${e}`), `${O}/deals/board`];
const AUDIT = `(() => {
  const W = innerWidth;
  const scrollParent = (el) => { for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox !== "visible") return true; } return false; };
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0"; };
  const desc = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "");
  const off = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!vis(el)) continue; const r = el.getBoundingClientRect();
    if ((r.right > W + 2 || r.left < -2) && !scrollParent(el) && getComputedStyle(el).position !== "fixed") off.push(desc(el) + "[" + Math.round(r.left) + "→" + Math.round(r.right) + "]");
  }
  let small = 0, smallEx = "";
  for (const el of document.querySelectorAll("body *")) {
    if (!vis(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 11) { small++; if (!smallEx) smallEx = desc(el) + " " + fs + "px"; }
  }
  let tiny = 0, tinyEx = "";
  for (const el of document.querySelectorAll("a, button, input, select, [role=button], [role=tab]")) {
    if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.height < 30 && r.width < 200) { tiny++; if (!tinyEx) tinyEx = desc(el) + " " + Math.round(r.width) + "x" + Math.round(r.height); }
  }
  // dedupe offenders by keeping the outermost few
  return { overflow: document.documentElement.scrollWidth - W, screens: +(document.documentElement.scrollHeight / innerHeight).toFixed(1), off: [...new Set(off)].slice(0, 4), small, smallEx, tiny, tinyEx };
})()`;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const rows = [];
for (const u of urls) {
  const p = await ctx.newPage();
  try {
    await p.goto(B + u, { waitUntil: "networkidle", timeout: 45000 }); await p.waitForTimeout(900);
    const a = await p.evaluate(AUDIT);
    await p.screenshot({ path: `${OUT}/${u.replace(/[\/]/g, "_") || "_home"}.png` });
    rows.push({ u, ...a });
    console.log(`${a.overflow > 0 ? "✗ OVERFLOW " + a.overflow + "px" : "✓"}  ${u}  | ${a.screens} screens | small text: ${a.small}${a.smallEx ? " (" + a.smallEx + ")" : ""} | small taps: ${a.tiny}${a.tinyEx ? " (" + a.tinyEx + ")" : ""}${a.off.length ? "\n      off-screen: " + a.off.join(", ") : ""}`);
  } catch (e) { console.log("ERR", u, String(e).split("\n")[0]); }
  await p.close();
}
await b.close();
