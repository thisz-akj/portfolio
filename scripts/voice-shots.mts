/**
 * `npm run shots:voice` — captures Front Desk Voice screenshots for the portfolio (public/work/voice-*.webp).
 * Needs the site (BASE, default http://localhost:3000), the voice service and the assistant running.
 * Sample calls cost nothing; the live clinic turn is rule-based; the "about" shot asks the assistant once.
 * In headless Chromium the device voice is removed (samples advance on reading time) and the microphone is a
 * silent stream. Images are the owner's own work (docs/credits.md).
 */
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import sharp from "sharp";

const APP = (process.env.BASE ?? "http://localhost:3000") + "/demos/voice-ai/app";
const OUT = "public/work";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "reduce",
    extraHTTPHeaders: { "x-forwarded-for": "10.0.0.251" },
  });
  await ctx.addInitScript(() => {
    for (const o of [window, Object.getPrototypeOf(window), Window.prototype]) {
      try {
        delete (o as unknown as Record<string, unknown>).speechSynthesis;
      } catch {
        /* not configurable here */
      }
    }
    navigator.mediaDevices.getUserMedia = async () => {
      const ac = new AudioContext();
      const dest = ac.createMediaStreamDestination();
      return dest.stream; // silence
    };
  });
  await ctx.addInitScript(() => {
    // hide the dev-mode badge if the shots run against `npm run dev`
    const style = () => document.head?.insertAdjacentHTML("beforeend", "<style>nextjs-portal{display:none!important}</style>");
    if (document.head) style();
    else document.addEventListener("DOMContentLoaded", style);
  });
  const page = await ctx.newPage();

  async function shot(name: string, go: (p: Page) => Promise<void>) {
    await go(page);
    await page.waitForTimeout(900);
    const png = await page.screenshot({ type: "png" });
    const file = join(OUT, `voice-${name}.webp`);
    await sharp(png).webp({ quality: 82 }).toFile(file);
    console.log(`✓ ${file}`);
  }

  const sample = (title: string) => async (p: Page) => {
    await p.goto(APP);
    await p.getByRole("button", { name: new RegExp(title) }).first().click();
    await p.waitForSelector(".vx-card--note", { timeout: 180_000 });
  };

  await shot("booking", sample("Follow-up booking"));
  await shot("change", sample("Changes their mind"));
  await shot("urgent", sample("Urgent call"));
  await shot("call", async (p) => {
    await p.goto(APP);
    await p.getByRole("button", { name: "Call the clinic" }).click();
    await p.waitForSelector(".vx-orb[data-phase='listening']", { timeout: 20_000 });
    await p.getByLabel("Type a message").fill("My son has a fever, can he see someone on Thursday morning?");
    await p.keyboard.press("Enter");
    await p.waitForSelector(".vx-offered button", { timeout: 20_000 });
  });
  await shot("about", async (p) => {
    await p.goto(`${APP}?line=about`);
    await p.getByRole("button", { name: "Start talking" }).click();
    await p.waitForSelector(".vx-orb[data-phase='listening']", { timeout: 20_000 });
    await p.getByLabel("Type a message").fill("What does Azad build?");
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => document.querySelectorAll(".vx-msg--agent").length >= 2, null, { timeout: 30_000 });
    await p.waitForSelector(".vx-orb[data-phase='listening']", { timeout: 30_000 });
  });
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
