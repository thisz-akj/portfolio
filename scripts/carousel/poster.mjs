/**
 * Cover poster for the portfolio (1024×768, plus @2x): name + role on the left, the site in a desktop
 * browser and on a phone on the right. Uses presentation/screens/*.png (run capture.mjs first).
 * Output: presentation/poster/portfolio-cover.png (1024×768) and portfolio-cover@2x.png (2048×1536).
 * Run: node scripts/carousel/poster.mjs [desktopShot] [phoneShot]
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "presentation/poster");
mkdirSync(OUT, { recursive: true });
const [desk = "home-work", phone = "phone-hero"] = process.argv.slice(2);
const shot = (n) => pathToFileURL(path.join(ROOT, "presentation/screens", `${n}.png`)).href;
const font = (f) => pathToFileURL(path.join(ROOT, "src/fonts", f)).href;
const SITE = "portfolio-five-liard-xqr2mfbifw.vercel.app";

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=block" rel="stylesheet">
<style>
@font-face { font-family: "Open Sauce One"; src: url("${font("OpenSauceOne-Regular.woff2")}"); font-weight: 400; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1024px; height: 768px; }
body { position: relative; overflow: hidden; background: #0d0d0d; color: #f2f0eb; font-family: "Open Sauce One", sans-serif; }
/* the hero film's teal/amber light, very soft */
.glow { position: absolute; inset: 0;
  background:
    radial-gradient(42% 55% at 74% 46%, rgba(64, 120, 120, 0.30), transparent 70%),
    radial-gradient(30% 40% at 58% 78%, rgba(176, 124, 52, 0.20), transparent 70%),
    radial-gradient(60% 60% at 0% 0%, rgba(242, 240, 235, 0.04), transparent 60%); }
.grid { position: absolute; inset: 0; opacity: 0.35;
  background-image: radial-gradient(rgba(242,240,235,0.08) 1px, transparent 1px); background-size: 22px 22px;
  -webkit-mask-image: radial-gradient(60% 70% at 72% 50%, #000, transparent); mask-image: radial-gradient(60% 70% at 72% 50%, #000, transparent); }

.copy { position: absolute; left: 52px; top: 64px; bottom: 56px; width: 300px; display: flex; flex-direction: column; }
.kicker { font-family: "JetBrains Mono", monospace; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a8884; display: flex; gap: 10px; align-items: center; }
.kicker::before { content: ""; width: 26px; height: 1px; background: #5a5955; }
h1 { margin-top: 30px; font-family: "Instrument Serif", serif; font-style: italic; font-weight: 400; font-size: 68px; line-height: 0.92; letter-spacing: -0.015em; }
.role { margin-top: 22px; font-size: 18px; color: #cfcdc8; }
.focus { margin-top: 26px; list-style: none; border-top: 1px solid #2a2a28; }
.focus li { display: flex; justify-content: space-between; padding: 11px 0 10px; border-bottom: 1px solid #2a2a28;
  font-family: "JetBrains Mono", monospace; font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #f2f0eb; }
.focus li span:first-child { color: #6f6d69; }
.status { margin-top: auto; display: inline-flex; align-items: center; gap: 10px; font-family: "JetBrains Mono", monospace; font-size: 10.5px;
  letter-spacing: 0.16em; text-transform: uppercase; color: #cfcdc8; }
.status i { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 10px #4ade80; }
.url { margin-top: 12px; font-family: "JetBrains Mono", monospace; font-size: 10.5px; letter-spacing: 0.04em; color: #8a8884; }

/* devices */
.browser { position: absolute; left: 436px; top: 150px; width: 560px; border-radius: 12px; overflow: hidden; background: #121212;
  border: 1px solid #2c2c2a; box-shadow: 0 40px 90px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.02); }
.bar { height: 28px; display: flex; align-items: center; gap: 6px; padding: 0 12px; background: #171717; border-bottom: 1px solid #242424; }
.bar i { width: 8px; height: 8px; border-radius: 50%; background: #3a3a3a; }
.bar span { margin-left: 10px; flex: 1; height: 17px; border-radius: 5px; background: #0e0e0e; color: #77756f; font-family: "JetBrains Mono", monospace;
  font-size: 8.5px; display: flex; align-items: center; padding: 0 9px; letter-spacing: 0.03em; }
.browser img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; object-position: top center; }

.phone { position: absolute; left: 392px; top: 318px; width: 182px; aspect-ratio: 390 / 844; border-radius: 34px; padding: 9px; background: #1b1b1b;
  border: 1px solid #353533; box-shadow: 0 40px 80px rgba(0,0,0,0.75), -18px 0 50px rgba(0,0,0,0.45); }
.phone img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; border-radius: 26px; }
.notch { position: absolute; top: 17px; left: 50%; transform: translateX(-50%); width: 62px; height: 18px; border-radius: 12px; background: #050505; }

.facts { position: absolute; left: 600px; top: 566px; width: 396px; display: flex; flex-direction: column; gap: 10px; }
.facts div { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 9px; border-bottom: 1px solid #2a2a28; }
.facts b { font-family: "Instrument Serif", serif; font-style: italic; font-weight: 400; font-size: 30px; line-height: 1; color: #f2f0eb; }
.facts span { font-family: "JetBrains Mono", monospace; font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase; color: #8a8884; }
.tag { position: absolute; font-family: "JetBrains Mono", monospace; font-size: 9.5px; letter-spacing: 0.2em; text-transform: uppercase; color: #6f6d69; }
.tag.web { left: 440px; top: 126px; }
.tag.mob { left: 396px; top: 734px; }
</style></head><body>
<div class="glow"></div><div class="grid"></div>
<section class="copy">
  <p class="kicker">Portfolio · 2026</p>
  <h1>Azad<br>Kumar Jha</h1>
  <p class="role">Applied AI Engineer</p>
  <ul class="focus">
    <li><span>Focus</span><span>AI automation</span></li>
    <li><span></span><span>Computer vision</span></li>
    <li><span></span><span>Robotics</span></li>
    <li><span>Based in</span><span>Bengaluru, India</span></li>
  </ul>
  <p class="status"><i></i>Live demos · case studies</p>
  <p class="url">${SITE}</p>
</section>
<span class="tag web">Desktop</span>
<div class="browser"><div class="bar"><i></i><i></i><i></i><span>${SITE}</span></div><img src="${shot(desk)}"></div>
<div class="phone"><div class="notch"></div><img src="${shot(phone)}"></div>
<span class="tag mob">Mobile</span>
<div class="facts">
  <div><b>5</b><span>Live demos in the browser</span></div>
  <div><b>8</b><span>Case studies, numbers left in</span></div>
  <div><b>2</b><span>AI automation · CV &amp; robotics</span></div>
</div>
</body></html>`;

const file = path.join(OUT, "_poster.html");
writeFileSync(file, html);
const browser = await chromium.launch();
for (const [scale, name] of [[1, "portfolio-cover.png"], [2, "portfolio-cover@2x.png"]]) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: scale });
  await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, name) });
  await page.close();
  console.log("✓", path.relative(ROOT, path.join(OUT, name)));
}
await browser.close();
rmSync(file);
