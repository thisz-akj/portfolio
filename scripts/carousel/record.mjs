/**
 * Screen recordings of the live demos (for presenting): the site chat, DocDesk and the voice agent.
 * Needs the site on :3000 plus the assistant (:8001), DocDesk (:8002) and voice (:8003) services for live
 * answers. Videos have no sound (browser recording). Output: presentation/videos/*.mp4 + stills in
 * presentation/screens/<scene>-*.png. Run: node scripts/carousel/record.mjs [scene]
 */
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const B = process.env.BASE_URL ?? "http://localhost:3000";
const RAW = "presentation/.video-raw";
const OUT = "presentation/videos";
const SHOTS = "presentation/screens";
for (const d of [RAW, OUT, SHOTS]) mkdirSync(d, { recursive: true });
const only = process.argv[2];

// A visible pointer (recordings don't draw the system cursor). The site's own cursor dot is kept on site
// pages; this one is added only where the page has none (demo apps).
const POINTER = `(() => {
  if (document.getElementById("cursor") || document.getElementById("rec-pointer")) return;
  const d = document.createElement("div"); d.id = "rec-pointer";
  Object.assign(d.style, { position: "fixed", left: "0", top: "0", width: "18px", height: "18px", borderRadius: "50%", zIndex: 2147483647,
    background: "rgba(242,240,235,0.95)", boxShadow: "0 0 0 6px rgba(242,240,235,0.18), 0 2px 10px rgba(0,0,0,0.5)", pointerEvents: "none",
    transform: "translate(-200px,-200px)", transition: "width .15s, height .15s, margin .15s" });
  document.documentElement.appendChild(d);
  addEventListener("mousemove", (e) => { d.style.transform = "translate(" + (e.clientX - 9) + "px," + (e.clientY - 9) + "px)"; }, true);
  addEventListener("mousedown", () => { d.style.width = d.style.height = "14px"; d.style.margin = "2px"; }, true);
  addEventListener("mouseup", () => { d.style.width = d.style.height = "18px"; d.style.margin = "0"; }, true);
})()`;

const browser = await chromium.launch();
const wait = (p, ms) => p.waitForTimeout(ms);

async function scene(name, fn, init) {
  if (only && !name.includes(only)) return;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, recordVideo: { dir: RAW, size: { width: 1440, height: 900 } } });
  await ctx.addInitScript(`addEventListener("DOMContentLoaded", ${POINTER.replace(/^\(/, "() => (").replace(/\)\(\)$/, ")()")})`);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on("load", () => page.evaluate(POINTER).catch(() => {}));
  let n = 0;
  const still = async () => { n++; await page.screenshot({ path: `${SHOTS}/${name}-${n}.png` }); };
  try {
    await fn(page, still);
  } catch (e) {
    console.log("✗", name, String(e).split("\n")[0]);
  }
  const video = page.video();
  await ctx.close();
  const raw = await video.path();
  const webm = `${RAW}/${name}.webm`;
  renameSync(raw, webm);
  // H.264 MP4 for LinkedIn / slides; high quality, web-optimised.
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${OUT}/${name}.mp4`]);
  console.log(`✓ ${name}: ${OUT}/${name}.mp4 + ${n} stills`);
}

/** Glide the pointer to an element and click it. */
async function glideClick(page, locator, pause = 350) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 28 });
  await wait(page, pause);
  await page.mouse.down(); await wait(page, 90); await page.mouse.up();
}
async function type(page, locator, text) {
  await glideClick(page, locator, 200);
  await locator.pressSequentially(text, { delay: 45 });
  await wait(page, 400);
  await page.keyboard.press("Enter");
}
/** Wait for the chat to finish streaming its reply. */
async function chatDone(page, timeout = 45000) {
  await page.waitForSelector(".asst-send.is-stop", { timeout: 8000 }).catch(() => {});
  await page.waitForSelector(".asst-send.is-stop", { state: "detached", timeout }).catch(() => {});
  await wait(page, 1200);
}

// ── 1. Site chat: three real questions ─────────────────────────────────────────────
await scene("chat", async (page, still) => {
  await page.goto(B + "/work", { waitUntil: "networkidle" });
  await wait(page, 1800);
  await glideClick(page, page.locator(".asst-launcher"));
  await wait(page, 1400);
  const box = page.getByLabel("Your question").first();
  for (const q of ["What does Azad build?", "Tell me about the computer vision and robotics work", "How can I get in touch?"]) {
    await type(page, box, q);
    await chatDone(page);
    await still();
    await wait(page, 1500);
  }
  await wait(page, 1500);
});

// ── 2. Support assistant demo: a scenario with the "under the hood" inspector ──────
await scene("support", async (page, still) => {
  await page.goto(B + "/demos/customer-support", { waitUntil: "networkidle" });
  await wait(page, 1800);
  const box = page.getByLabel("Your question").first();
  await type(page, box, "Do you build voice agents for clinics?");
  await chatDone(page);
  await still();
  await page.mouse.move(1000, 600, { steps: 20 });
  await wait(page, 2500);
});

// ── 3. DocDesk: open a contract, ask, see the clause, fields, checks, then compare ──
await scene("docdesk", async (page, still) => {
  await page.goto(B + "/demos/document-intelligence/app", { waitUntil: "networkidle" });
  await wait(page, 2000);
  await glideClick(page, page.locator(".dd-doc").first());
  await page.waitForURL(/\/d\//); await wait(page, 2500);
  const ex = page.locator(".dd-suggest button");
  await glideClick(page, ex.nth(0)); await wait(page, 4500); await still();
  await glideClick(page, ex.nth(1)); await wait(page, 4500); await still();
  // a typed question → live answer with the source quoted
  const ask = page.locator("textarea").first();
  await type(page, ask, "Who can terminate the agreement early, and how?");
  await wait(page, 9000); await still();
  await glideClick(page, page.getByRole("tab", { name: /Fields/ }).first()); await wait(page, 3000); await still();
  await glideClick(page, page.getByRole("tab", { name: /Checks/ }).first()); await wait(page, 3000); await still();
  await page.goto(B + "/demos/document-intelligence/app/compare", { waitUntil: "networkidle" });
  await wait(page, 1800);
  await glideClick(page, page.getByRole("button", { name: /Contract v1/ }).first()); await wait(page, 4000); await still();
  await page.mouse.wheel(0, 500); await wait(page, 1500);
  await glideClick(page, page.getByRole("button", { name: /Purchase order/ }).first()); await wait(page, 4000); await still();
  await wait(page, 1500);
});

// ── 4. Front Desk Voice: a sample call playing with its live transcript ─────────────
// Headless Chromium has no speech voices, so each line would "finish" instantly and the whole call would
// appear at once. For the recording only, a stand-in speech engine takes as long as real speech (~58 ms
// per character), so the call plays at a natural pace. (The video has no sound either way.)
const PACED_SPEECH = `(() => {
  const ss = window.speechSynthesis; if (!ss) return;
  let timers = [];
  ss.speak = (u) => {
    timers.push(setTimeout(() => u.onstart && u.onstart(new Event("start")), 80));
    timers.push(setTimeout(() => u.onend && u.onend(new Event("end")), 600 + (u.text || "").length * 58));
  };
  ss.cancel = () => { timers.forEach(clearTimeout); timers = []; };
})()`;
await scene("voice", async (page, still) => {
  await page.goto(B + "/demos/voice-ai/app", { waitUntil: "networkidle" });
  await wait(page, 2000);
  await glideClick(page, page.locator(".vx-samples button").first());
  // stills along the way, until the call ends (the button goes back from "Stop sample")
  for (let t = 0; t < 120; t += 6) {
    await wait(page, 6000);
    if (t % 12 === 0) await still();
    if (!(await page.getByRole("button", { name: /Stop sample/i }).count())) break;
  }
  await still();
  await wait(page, 2500);
}, PACED_SPEECH);

await browser.close();
rmSync(RAW, { recursive: true, force: true });
