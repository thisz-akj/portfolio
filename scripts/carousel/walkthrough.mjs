/**
 * A guided video tour of the portfolio (silent, with on-screen captions) for presenting.
 * Needs the production site on :3000 (`npx next start -p 3000`). Demos run in their offline / sample
 * modes, so no Python services are needed. Output: presentation/videos/portfolio-walkthrough.mp4
 * Run: node scripts/carousel/walkthrough.mjs
 */
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const B = process.env.BASE_URL ?? "http://localhost:3000";
const SITE = "portfolio-five-liard-xqr2mfbifw.vercel.app";
const RAW = "presentation/.video-raw";
const OUT = "presentation/videos";
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });

// Lower-third captions in the site's style + a visible pointer on pages without the site's cursor dot.
const OVERLAY = `(() => {
  const css = document.createElement("style");
  css.textContent = \`
    #wt-cap { position: fixed; left: 40px; bottom: 40px; z-index: 2147483646; max-width: 640px; padding: 18px 24px 20px;
      border-radius: 16px; background: rgba(10,10,10,0.86); border: 1px solid #2c2c2a; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      backdrop-filter: blur(10px); color: #f2f0eb; opacity: 0; transform: translateY(12px); transition: opacity .5s ease, transform .6s cubic-bezier(.16,1,.3,1); pointer-events: none; }
    #wt-cap.on { opacity: 1; transform: none; }
    #wt-cap .k { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: #4ade80; }
    #wt-cap .t { margin-top: 6px; font-family: "Instrument Serif", Georgia, serif; font-style: italic; font-size: 30px; line-height: 1.1; }
    #wt-cap .s { margin-top: 6px; font-family: system-ui, sans-serif; font-size: 15px; line-height: 1.45; color: #bdbbb6; }
    #wt-ptr { position: fixed; left: 0; top: 0; width: 18px; height: 18px; border-radius: 50%; z-index: 2147483647; pointer-events: none;
      background: rgba(242,240,235,.95); box-shadow: 0 0 0 6px rgba(242,240,235,.18), 0 2px 10px rgba(0,0,0,.5); transform: translate(-200px,-200px); }
    .asst-launcher { display: none !important; }\`;
  document.documentElement.appendChild(css);
  const cap = document.createElement("div"); cap.id = "wt-cap"; cap.innerHTML = '<div class="k"></div><div class="t"></div><div class="s"></div>';
  document.documentElement.appendChild(cap);
  window.__cap = (k, t, s) => {
    if (!t) { cap.classList.remove("on"); return; }
    cap.classList.remove("on");
    setTimeout(() => { cap.querySelector(".k").textContent = k || ""; cap.querySelector(".t").textContent = t; cap.querySelector(".s").textContent = s || ""; cap.classList.add("on"); }, 250);
  };
  if (!document.getElementById("cursor")) {
    const p = document.createElement("div"); p.id = "wt-ptr"; document.documentElement.appendChild(p);
    addEventListener("mousemove", (e) => { p.style.transform = "translate(" + (e.clientX - 9) + "px," + (e.clientY - 9) + "px)"; }, true);
  }
})()`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, recordVideo: { dir: RAW, size: { width: 1440, height: 900 } } });
const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);
const overlay = async () => { await page.evaluate(OVERLAY).catch(() => {}); };
page.on("load", overlay);
const cap = (k, t, s) => page.evaluate(([a, b, c]) => window.__cap && window.__cap(a, b, c), [k, t, s]).catch(() => {});

/** Wheel-scroll like a person (the site's smooth scroller eases it). */
async function scroll(px, { step = 70, every = 45 } = {}) {
  const n = Math.max(1, Math.round(Math.abs(px) / step));
  for (let i = 0; i < n; i++) { await page.mouse.wheel(0, Math.sign(px) * step); await wait(every); }
  await wait(600);
}
/** Scroll until an element's top reaches `frac` of the viewport. */
async function scrollTo(selector, frac = 0.12, opts) {
  for (let i = 0; i < 200; i++) {
    const b = await page.locator(selector).first().boundingBox();
    if (!b) break;
    const target = 900 * frac;
    if (Math.abs(b.y - target) < 40) break;
    await page.mouse.wheel(0, b.y > target ? Math.min(90, b.y - target) : -Math.min(90, target - b.y));
    await wait(opts?.every ?? 45);
  }
  await wait(700);
}
async function glide(x, y, steps = 30) { await page.mouse.move(x, y, { steps }); }
async function glideClick(locator, pause = 400) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  await glide(b.x + b.width / 2, b.y + b.height / 2);
  await wait(pause);
  await page.mouse.down(); await wait(90); await page.mouse.up();
}

try {
  // 1. Hero
  await page.goto(B + "/", { waitUntil: "networkidle" });
  await overlay();
  await glide(1100, 520, 10);
  await wait(1200);
  await cap("Portfolio walkthrough", "Azad Kumar Jha", "Applied AI engineer · AI automation · computer vision · robotics");
  await wait(7800); // film holds, plays once, settles on its last frame

  // 2. About
  await cap("01 · About", "Two halves, one habit", "AI automation for businesses and perception for robots, both measured with real numbers.");
  await scrollTo("#about", 0.0);
  await scroll(1500, { step: 50, every: 60 }); // the bio lights up word by word
  await wait(1500);

  // 3. What I build
  await cap("02 · What I build", "Six areas, two columns", "AI automation on the left, computer vision & robotics on the right.");
  await scrollTo(".about-v2 .expertise-list", 0.2);
  const cards = page.locator(".about-v2 .expertise-card");
  for (const i of [0, 1, 3, 5]) { const b = await cards.nth(i).boundingBox(); if (b) { await glide(b.x + b.width / 2, b.y + b.height / 2, 22); await wait(900); } }

  // 4. Experience, achievements, résumés
  await cap("03 · Experience", "Experience, achievements, résumés", "Virya, Fuvii and IIT Madras; GATE, Amazon ML Challenge, Rover Challenge; two résumés to download.");
  await scrollTo(".about-v2 .about-block:nth-of-type(2)", 0.08);
  await scroll(900, { step: 50, every: 55 });
  await wait(1200);

  // 5. Tech I use
  await cap("04 · Tech I use", "The tools behind the work", "Hover any logo for its name.");
  await scrollTo(".tech-stack", 0.15);
  const icons = page.locator(".tech-stack .tech-icon");
  for (const i of [0, 3, 12, 20]) { const b = await icons.nth(i).boundingBox(); if (b) { await glide(b.x + b.width / 2, b.y + b.height / 2, 18); await wait(800); } }
  await scroll(700);

  // 6. Things I keep getting hired for + solution stories
  await cap("05 · Work", "Things I keep getting hired for", "Seven solution areas. Each card opens a full story.");
  await scrollTo("#work", 0.0);
  await wait(1500);
  await scroll(500);
  await glideClick(page.locator("button[aria-label='Open AI Workflow Automation']"));
  await cap("05 · Work", "AI Workflow Automation", "The tools it connects, an end-to-end example, the process and an FAQ.");
  await wait(2200);
  await glide(720, 520, 12);
  await scroll(2600, { step: 60, every: 55 });
  await wait(800);
  await page.keyboard.press("Escape");
  await wait(1400);
  await glideClick(page.locator("button[aria-label='Open Computer Vision & Robotics']"));
  await cap("05 · Work", "Computer Vision & Robotics", "Five perception projects, each its own article with key figures.");
  await wait(2200);
  await glide(720, 520, 12);
  await scroll(2600, { step: 60, every: 55 });
  await wait(800);
  await page.keyboard.press("Escape");
  await wait(1400);

  // 7. Clients + contact
  await cap("06 · Clients & contact", "Who I've worked with", "IIT Madras, IIITDM Kancheepuram, EDLAR, Virya, Fuvii.");
  await scrollTo("#clients", 0.1);
  await wait(2000);
  await scrollTo("#contact", 0.1);
  await wait(2500);

  // 8. Work page → CV tab → a case study
  await page.goto(B + "/work", { waitUntil: "networkidle" });
  await overlay();
  await cap("07 · Case studies", "Things that shipped", "Every project with its problem, contribution, results and lessons.");
  await wait(2200);
  await glideClick(page.locator(".work-tab").nth(2));
  await cap("07 · Case studies", "Filter by field", "AI automation, or computer vision & robotics.");
  await wait(1800);
  await scroll(500);
  await wait(800);
  await glideClick(page.locator("a[href='/work/visual-slam-to-navigation']").first());
  await page.waitForURL(/visual-slam/);
  await overlay();
  await cap("07 · Case studies", "Visual SLAM → navigation", "CV & robotics case studies show how it works, with the numbers.");
  await wait(2000);
  await scrollTo(".detail-grid", 0.08);
  await scroll(1300, { step: 50, every: 60 });
  await wait(1500);

  // 9. Demos page
  await page.goto(B + "/demos", { waitUntil: "networkidle" });
  await overlay();
  await cap("08 · Demos", "Try it, don't trust it", "Five working demos that run in the browser.");
  await wait(2200);
  await scroll(1400, { step: 55, every: 55 });
  await wait(1000);

  // 10. Autopilot in action
  await page.goto(B + "/demos/autopilot/app", { waitUntil: "networkidle" });
  await overlay();
  await cap("08 · Demos", "Autopilot", "A WhatsApp enquiry becomes a quote, a payment and a booked dispatch, with one approval.");
  await wait(1800);
  for (let i = 0; i < 4; i++) { const o = page.locator(".ap-option").first(); if (await o.count()) { await glideClick(o, 500); await wait(1800); } }
  await wait(1200);

  // 11. DocDesk answering a question
  await page.goto(B + "/demos/document-intelligence/app/d/msa-kestrel-v1", { waitUntil: "networkidle" });
  await overlay();
  await cap("08 · Demos", "DocDesk", "Ask a contract a question and see the exact clause highlighted.");
  await wait(2000);
  await glideClick(page.locator(".dd-suggest button").first());
  await wait(5500);
  await glideClick(page.locator(".dd-suggest button").nth(1));
  await wait(5500);

  // 12. Close
  await page.goto(B + "/#contact", { waitUntil: "networkidle" }); // jumps straight to the contact section
  await overlay();
  await wait(1500);
  await cap("Thanks for watching", SITE, "Live demos, case studies and both résumés.");
  await wait(5000);
} catch (e) {
  console.log("✗", String(e).split("\n")[0]);
}

const video = page.video();
await ctx.close();
await browser.close();
const webm = `${RAW}/portfolio-walkthrough.webm`;
renameSync(await video.path(), webm);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${OUT}/portfolio-walkthrough.mp4`]);
rmSync(RAW, { recursive: true, force: true });
console.log(`✓ ${OUT}/portfolio-walkthrough.mp4`);
