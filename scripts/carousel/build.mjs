/**
 * Builds vertical carousels (1080×1350, LinkedIn's 4:5) from presentation/screens/*.png
 * (run capture.mjs first). Output per carousel: presentation/carousels/<name>/NN.png (2160×2700)
 * and presentation/carousels/<name>.pdf (one slide per page — LinkedIn posts carousels as PDFs).
 * Run: node scripts/carousel/build.mjs
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.cwd();
const EMBED = path.join(ROOT, "presentation/.embed"); // JPEG copies of the screenshots (tall ones preferred)
const OUT = path.join(ROOT, "presentation/carousels");
const SITE = "portfolio-five-liard-xqr2mfbifw.vercel.app";
const img = (name) => pathToFileURL(path.join(EMBED, `${name}.jpg`)).href;
const font = (f) => pathToFileURL(path.join(ROOT, "src/fonts", f)).href;

/* ── Slide content (facts from the site's content files) ─────────────────────────────── */
const carousels = [
  {
    name: "1-portfolio-tour",
    label: "Portfolio tour",
    slides: [
      { type: "cover", bgPublic: "video/hero-motion.webp", pos: "62% 25%", kicker: "Portfolio tour", title: "Applied AI Engineer", sub: "AI automation · Computer vision · Robotics", note: "Swipe through the site →" },
      { type: "screen", shot: "home-hero", url: "/", title: "Hello, I'm Azad", text: "Applied AI engineer in Bengaluru, building AI automation for businesses and computer vision for robots and vehicles." },
      { type: "screen", shot: "home-about", url: "/#about", title: "About", text: "Two halves, one habit: AI that holds up outside the demo, measured with real numbers." },
      { type: "screen", shot: "home-what-i-build", url: "/#about", title: "What I build", text: "Six areas in two columns: AI automation on the left, computer vision & robotics on the right.", fit: "contain" },
      { type: "screen", shot: "home-work", url: "/#work", title: "Things I keep getting hired for", text: "Seven solution areas. Each card opens into a full story: the problem, what it does and where it's used." },
      { type: "screen", shot: "drawer-automation", url: "/#work", title: "AI Workflow Automation", text: "The client story: the tools it connects to, an end-to-end example, the process and an FAQ." },
      { type: "screen", shot: "drawer-cv", url: "/#work", title: "Computer Vision & Robotics", text: "Five perception projects, each its own article with renders, key figures and where it's used." },
      { type: "screen", shot: "page-demos", url: "/demos", title: "Try it, don't trust it", text: "Five working demos in the browser: Autopilot, Ops Suite, DocDesk, Front Desk Voice and a support assistant." },
      { type: "screen", shot: "page-work-cv", url: "/work?field=cv", title: "Things that shipped", text: "Eight case studies with the numbers left in, filterable by AI automation or computer vision & robotics." },
      { type: "screen", shot: "case-slam-how", url: "/work/visual-slam-to-navigation", title: "Case studies with the method", text: "CV & robotics case studies show how it works: problem, method, tools, results and lessons." },
      { type: "phones", shots: ["phone-hero", "phone-cards"], title: "Made for phones too", text: "The same site, rebuilt for small screens: swipeable cards, shorter sections, every page checked at 390 px." },
      { type: "end", title: "Explore it yourself", text: "Live demos, case studies and both résumés." },
    ],
  },
  {
    name: "2-ai-automation",
    label: "AI automation",
    slides: [
      { type: "cover", bgPublic: "art/laptop-glow.webp", pos: "50% 40%", kicker: "AI automation", title: "AI automation that actually runs", sub: "Five working demos you can try in the browser", note: "Swipe →" },
      { type: "screen", shot: "app-autopilot", url: "/demos/autopilot/app", title: "Autopilot", text: "Four small-business workflows end to end: WhatsApp enquiry to paid order, clinic no-shows, supplier invoices, service jobs. Team decisions stay a \"your call\" approval." },
      { type: "screen", shot: "app-ops-dashboard", url: "/demos/ops-suite/app", title: "Ops Suite", text: "A CRM, ERP and data portal on one database, with automated order-to-cash and procure-to-stock flows." },
      { type: "screen", shot: "app-ops-ask", url: "/demos/ops-suite/app/ask", title: "Ask Ops Suite", text: "Plain-English questions over 16 business metrics, answered with the numbers behind them. Read-only by design." },
      { type: "screen", shot: "app-docdesk-ask", url: "/demos/document-intelligence/app", title: "DocDesk", text: "Ask a contract a question and see the exact clause highlighted. 100% correct on a 42-question test set, 0.9 s typical answer." },
      { type: "screen", shot: "app-docdesk-quality", url: "/demos/document-intelligence/app/quality", title: "Measured, not claimed", text: "Every graded question on show: answers, citations, \"not in the document\" traps and 90/90 extracted fields." },
      { type: "screen", shot: "app-voice", url: "/demos/voice-ai/app", title: "Front Desk Voice", text: "A clinic phone agent that books, rebooks and hands urgent calls to a person. 21/21 test calls handled correctly." },
      { type: "screen", shot: "app-support", url: "/demos/customer-support", title: "Support assistant", text: "Answers from a business's own knowledge, with an \"under the hood\" view of topic, route and sources." },
      { type: "phones", shots: ["phone-autopilot", "phone-docdesk"], title: "Works on a phone", text: "Every demo is usable on a phone, the way customers and teams actually use these tools." },
      { type: "end", title: "Try the demos", text: "AI automation demos and case studies:", path: "/work?field=ai" },
    ],
  },
  {
    name: "3-computer-vision-robotics",
    label: "Computer vision & robotics",
    slides: [
      { type: "cover", bgPublic: "work/cv-slam-map.webp", pos: "50% 45%", kicker: "Computer vision & robotics", title: "Perception for robots and vehicles", sub: "Detection · SLAM · Calibration · Edge AI", note: "Swipe →" },
      { type: "screen", shot: "drawer-cv", url: "/#work", title: "Computer Vision & Robotics", text: "Perception that holds up in the field: on small edge hardware, in changing light, with sensors that drift." },
      { type: "screen", shot: "case-surroundsense", url: "/work/surroundsense", title: "SurroundSense", text: "A 360° bird's-eye view from four fisheye cameras, with blind-spot warnings. Validated on datasets and live camera streams." },
      { type: "screen", shot: "case-visual-slam-to-navigation", url: "/work/visual-slam-to-navigation", title: "Visual SLAM → navigation", text: "A robot maps a room and drives itself: 1.56 cm tracking error, 17.2 vs 76.8 cm worst-case drift over 86 m." },
      { type: "screen", shot: "case-slam-how", url: "/work/visual-slam-to-navigation", title: "How it works", text: "Two SLAM front ends (one learned, written from scratch), a dense 3D map, a digital twin and a robot that plans its own routes." },
      { type: "screen", shot: "case-targetless-camera-lidar-calibration", url: "/work/targetless-camera-lidar-calibration", title: "Targetless camera–LiDAR calibration", text: "More than 95% of LiDAR points land on the person mask across sensor setups, with no calibration board." },
      { type: "screen", shot: "case-edge-pose-estimation", url: "/work/edge-pose-estimation", title: "Pose estimation on an edge accelerator", text: "Trolley keypoints tracked in real time: 2× faster than the unoptimised model, with accuracy held." },
      { type: "screen", shot: "case-edge-ai-quantization", url: "/work/edge-ai-quantization", title: "Edge AI acceleration", text: "FP32, FP16, BF16 or INT8 per job. A 1.94× INT8 speed-up, with the accuracy cost measured on degraded images." },
      { type: "screen", shot: "page-work-cv", url: "/work?field=cv", title: "All five case studies", text: "Problem, method, tools, results and lessons for each, with GitHub links." },
      { type: "end", title: "See the work", text: "Computer vision & robotics case studies:", path: "/work?field=cv" },
    ],
  },
  {
    name: "4-see-it-working",
    label: "See it working",
    slides: [
      { type: "cover", bgPublic: "art/night-desk.webp", pos: "50% 45%", kicker: "Live demos", title: "See it working", sub: "Real questions, real answers: chat, documents and voice", note: "Swipe →" },
      { type: "screen", shot: "chat-panel", url: "/  ·  Ask about Azad", title: "Ask about Azad", text: "The site's own assistant, answering live from the site's content: three questions, three grounded answers with links.", fit: "contain" },
      { type: "screen", shot: "support-1", url: "/demos/customer-support", title: "Support, under the hood", text: "The same assistant as a support console, showing the topic, route, sources and response time for each answer.", fit: "width" },
      { type: "screen", shot: "docdesk-1", url: "/demos/document-intelligence/app", title: "Answers with the clause highlighted", text: "Ask a contract a question: the answer quotes it, and the source lights up on the page.", fit: "width" },
      { type: "screen", shot: "docdesk-3", url: "/demos/document-intelligence/app", title: "Typed questions, answered live", text: "\"Who can terminate the agreement early, and how?\" answered with the supporting clauses quoted.", fit: "width" },
      { type: "screen", shot: "docdesk-4", url: "/demos/document-intelligence/app", title: "Fields, extracted and verified", text: "Key terms pulled from the contract, each checked against the text before it's trusted.", fit: "width" },
      { type: "screen", shot: "docdesk-5", url: "/demos/document-intelligence/app", title: "Checks that flag risk", text: "Auto-renewal notice dates, breach-notice windows and liability caps flagged for a person to review.", fit: "width" },
      { type: "screen", shot: "docdesk-6", url: "/demos/document-intelligence/app/compare", title: "Contract redlines", text: "Two versions compared clause by clause, with the key terms that changed listed side by side.", fit: "width" },
      { type: "screen", shot: "docdesk-7", url: "/demos/document-intelligence/app/compare", title: "Purchase order vs invoice", text: "Line-by-line matching that catches mismatches and holds the payment for review.", fit: "width" },
      { type: "screen", shot: "voice-4", url: "/demos/voice-ai/app", title: "A full call with Front Desk Voice", text: "Books Dr. Rao for 3 pm, confirms by SMS and closes the call. Every reply is filled from the clinic's real calendar.", fit: "width" },
      { type: "end", title: "Try them yourself", text: "All demos run in the browser:", path: "/demos" },
    ],
  },
];


/* ── Template ──────────────────────────────────────────────────────────────────────── */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function slideHtml(c, s, i) {
  const n = `${String(i + 1).padStart(2, "0")} / ${String(c.slides.length).padStart(2, "0")}`;
  const top = `<div class="top"><span>Azad Kumar Jha · ${esc(c.label)}</span><span>${n}</span></div>`;
  if (s.type === "cover")
    return `<section class="slide cover"><img class="bg" src="${s.bgPublic ? pathToFileURL(path.join(ROOT, "public", s.bgPublic)).href : img(s.bg)}" style="object-position:${s.pos ?? "50% 40%"}"><div class="veil"></div>${top}
      <div class="cover-body"><p class="kicker">${esc(s.kicker)}</p><h1>${esc(s.title)}</h1><p class="sub">${esc(s.sub)}</p></div>
      <div class="foot"><span>${SITE}</span><span>${esc(s.note)}</span></div></section>`;
  if (s.type === "end")
    return `<section class="slide end">${top}<div class="end-body"><p class="kicker">Azad Kumar Jha · Applied AI Engineer</p><h1>${esc(s.title)}</h1>
      <p class="sub">${esc(s.text)}</p><p class="link">${SITE}${esc(s.path ?? "")}</p>
      <p class="contact">azadkumarjha09@gmail.com · linkedin.com/in/azad-kumar-jha · github.com/thisz-akj</p></div>
      <div class="foot"><span>Bengaluru, India</span><span>Available for projects</span></div></section>`;
  const head = `<div class="head"><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p></div>`;
  if (s.type === "phones")
    return `<section class="slide">${top}${head}<div class="phones">${s.shots
      .map((p) => `<div class="phone"><div class="notch"></div><img src="${img(p)}"></div>`)
      .join("")}</div></section>`;
  return `<section class="slide">${top}${head}<div class="browser"><div class="bar"><i></i><i></i><i></i><span>${SITE}${esc(s.url)}</span></div>
    <div class="view ${s.fit === "contain" ? "contain" : ""}"><img src="${img(s.shot)}"></div></div></section>`.replace('<div class="browser">', s.fit === "width" ? '<div class="browser fit">' : '<div class="browser">');
}

const CSS = `
@font-face { font-family: "Open Sauce One"; src: url("${font("OpenSauceOne-Regular.woff2")}"); font-weight: 400; }
@font-face { font-family: "Open Sauce One"; src: url("${font("OpenSauceOne-Medium.woff2")}"); font-weight: 500; }
@page { size: 1080px 1350px; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0d0d0d; }
.slide { position: relative; width: 1080px; height: 1350px; overflow: hidden; background: #0d0d0d; color: #f2f0eb;
  font-family: "Open Sauce One", sans-serif; display: flex; flex-direction: column; padding: 56px 60px 60px; break-after: page; }
.slide::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(120% 70% at 85% 0%, rgba(242,240,235,0.05), transparent 60%); }
.top { position: relative; z-index: 2; display: flex; justify-content: space-between; font-family: "JetBrains Mono", monospace;
  font-size: 17px; letter-spacing: 0.18em; text-transform: uppercase; color: #8a8884; }
.head { margin: 44px 0 36px; }
.head h2 { font-family: "Instrument Serif", serif; font-style: italic; font-weight: 400; font-size: 76px; line-height: 1; letter-spacing: -0.01em; }
.head p { margin-top: 20px; font-size: 27px; line-height: 1.45; color: #bdbbb6; max-width: 900px; }
.browser { flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 18px; overflow: hidden; border: 1px solid #2a2a2a;
  background: #121212; box-shadow: 0 40px 90px rgba(0,0,0,0.6); }
.bar { height: 46px; flex: none; display: flex; align-items: center; gap: 9px; padding: 0 18px; background: #161616; border-bottom: 1px solid #242424; }
.bar i { width: 12px; height: 12px; border-radius: 50%; background: #333; }
.bar span { margin-left: 14px; flex: 1; height: 28px; border-radius: 8px; background: #0e0e0e; color: #8a8884; font-family: "JetBrains Mono", monospace;
  font-size: 14px; display: flex; align-items: center; padding: 0 14px; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; }
.view { flex: 1; min-height: 0; overflow: hidden; background: #0d0d0d; }
.view img { width: 100%; height: auto; display: block; } /* full width; any overflow is trimmed at the bottom only */
.browser.fit { flex: none; margin: auto 0; } /* 16:10 stills: frame hugs the image, centred in the space */
.browser.fit .view { flex: none; }
.view.contain img { height: 100%; object-fit: contain; object-position: top center; }
.phones { flex: 1; min-height: 0; display: flex; justify-content: center; align-items: flex-start; gap: 48px; }
.phone { position: relative; height: 100%; aspect-ratio: 390 / 844; max-height: 900px; border-radius: 48px; padding: 14px; background: #1a1a1a;
  border: 1px solid #2f2f2f; box-shadow: 0 40px 90px rgba(0,0,0,0.6); }
.phone img { width: 100%; height: 100%; object-fit: cover; object-position: top; border-radius: 36px; display: block; }
.notch { position: absolute; top: 26px; left: 50%; transform: translateX(-50%); width: 110px; height: 30px; border-radius: 20px; background: #050505; z-index: 2; }
.cover .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 62% 30%; }
.cover .veil { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(13,13,13,0.55) 0%, rgba(13,13,13,0.2) 35%, rgba(13,13,13,0.85) 72%, #0d0d0d 100%); }
.cover-body, .end-body { position: relative; z-index: 2; margin-top: auto; }
.kicker { font-family: "JetBrains Mono", monospace; font-size: 19px; letter-spacing: 0.2em; text-transform: uppercase; color: #4ade80; }
.cover h1, .end h1 { margin-top: 22px; font-family: "Instrument Serif", serif; font-style: italic; font-weight: 400; font-size: 118px; line-height: 0.95; letter-spacing: -0.015em; }
.sub { margin-top: 26px; font-size: 32px; line-height: 1.4; color: #cfcdc8; }
.foot { position: relative; z-index: 2; margin-top: 44px; padding-top: 22px; border-top: 1px solid #2c2c2a; display: flex; justify-content: space-between;
  font-family: "JetBrains Mono", monospace; font-size: 17px; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8884; }
.end .end-body { margin-top: auto; margin-bottom: auto; }
.end .link { margin-top: 40px; display: inline-block; padding: 20px 30px; border-radius: 999px; background: #f2f0eb; color: #0a0a0a; font-size: 27px; font-weight: 500; }
.end .contact { margin-top: 34px; font-family: "JetBrains Mono", monospace; font-size: 18px; letter-spacing: 0.04em; color: #8a8884; line-height: 1.7; }
`;

const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
for (const c of carousels) {
  const html = `<!doctype html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=block" rel="stylesheet">
  <style>${CSS}</style></head><body>${c.slides.map((s, i) => slideHtml(c, s, i)).join("\n")}</body></html>`;
  const file = path.join(OUT, `${c.name}.html`);
  writeFileSync(file, html);
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const dir = path.join(OUT, c.name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const slides = page.locator(".slide");
  for (let i = 0; i < (await slides.count()); i++) await slides.nth(i).screenshot({ path: path.join(dir, `${String(i + 1).padStart(2, "0")}.png`) });
  await page.pdf({ path: path.join(OUT, `${c.name}.pdf`), width: "1080px", height: "1350px", printBackground: true });
  console.log("  frame sizes:", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(".view")].slice(0, 4).map((v) => `${v.clientWidth}x${v.clientHeight}`))));
  await page.close();
  rmSync(file);
  console.log(`✓ ${c.name}: ${c.slides.length} slides → ${path.relative(ROOT, dir)}/ + ${c.name}.pdf`);
}
await browser.close();
