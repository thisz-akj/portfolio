"use client";

import { useEffect, useRef, useState } from "react";
import { markLoaderDone, prefersReducedMotion } from "@/lib/motion";
import { site } from "@/content/site";

const IRIS = 1.7; // seconds for the aperture to open

/**
 * Intro, in three movements:
 *  1. Typing — the name is typed in the hero title's own typeface, exactly over the
 *     title, with a human rhythm: each letter settles in from a soft blur with a brief
 *     glow, and a fine caret glides along, blinking before and after.
 *  2. Iris — the black page opens as a soft aperture from the centre of the name.
 *  3. Hand-off — the typed name *is* the hero title; Hero gathers everything else.
 */
export function Loader({ assets }: { assets: string[] }) {
  // Already loaded once in this tab (client-side navigation back home) → skip.
  const [gone, setGone] = useState(
    () => typeof window !== "undefined" && !!(window as Window & { __siteLoaded?: boolean }).__siteLoaded,
  );
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const caret = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (gone) return;
    if (prefersReducedMotion()) {
      markLoaderDone();
      setGone(true);
      return;
    }
    document.documentElement.style.overflow = "hidden";
    window.__lenis?.stop();
    window.scrollTo(0, 0);

    let loaded = 0;
    const total = Math.max(assets.length, 1);
    assets.forEach((src) => {
      const img = new Image();
      img.onload = img.onerror = () => (loaded += 1);
      img.src = src;
    });
    if (!assets.length) loaded = total;

    let alive = true;
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    let raf = 0;
    let center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    /** Copy the hero title's exact box + font metrics onto the typing line. */
    const place = () => {
      const title = document.querySelector<HTMLElement>(".hero-name");
      const b = box.current;
      if (!title || !b) return;
      const r = title.getBoundingClientRect();
      const cs = getComputedStyle(title);
      Object.assign(b.style, {
        left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
        fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontStyle: cs.fontStyle, fontWeight: cs.fontWeight,
        letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight,
      });
      center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    const moveCaret = (afterEl: HTMLElement | null) => {
      const c = caret.current;
      const l = line.current;
      if (!c || !l) return;
      const lr = l.getBoundingClientRect();
      const x = afterEl ? afterEl.getBoundingClientRect().right - lr.left + 2 : 0;
      c.style.transform = `translateX(${x}px)`;
    };

    const openIris = () => {
      const el = root.current;
      if (!el) return;
      const w = window as Window & { __heroHandoff?: boolean; __heroOrigin?: { x: number; y: number } };
      w.__heroHandoff = true;
      w.__heroOrigin = center;
      document.documentElement.style.overflow = "";
      window.__lenis?.start();
      // Only one copy of the name may ever be visible: hide the real title until we leave.
      const realTitle = document.querySelector<HTMLElement>(".hero-name");
      if (realTitle) realTitle.style.visibility = "hidden";
      markLoaderDone(); // Hero gathers its content in step with the iris
      el.classList.add("opening");
      const far = Math.hypot(Math.max(center.x, window.innerWidth - center.x), Math.max(center.y, window.innerHeight - center.y));
      const feather = Math.max(window.innerWidth, window.innerHeight) * 0.22;
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / (IRIS * 1000));
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        const rad = e * (far + feather);
        const m = `radial-gradient(circle at ${center.x}px ${center.y}px, transparent ${Math.max(0, rad - feather)}px, #000 ${rad}px)`;
        el.style.setProperty("-webkit-mask-image", m);
        el.style.setProperty("mask-image", m);
        if (k < 1) raf = requestAnimationFrame(step);
        else {
          if (realTitle) realTitle.style.visibility = ""; // swap in the same frame — invisible
          setGone(true);
        }
      };
      raf = requestAnimationFrame(step);
    };

    const type = () => {
      if (!alive) return;
      place();
      const b = box.current;
      const letters = Array.from(b?.querySelectorAll<HTMLElement>(".tl, .ts") ?? []);
      b?.classList.add("ready");
      moveCaret(null);

      // human rhythm: slightly irregular keystrokes, a breath between words
      let t = 650; // caret blinks a moment first
      let lastLetter: HTMLElement | null = null;
      letters.forEach((el) => {
        const isSpace = el.classList.contains("ts");
        t += isSpace ? 70 : 78 + Math.random() * 70;
        const at = t;
        later(at, () => {
          caret.current?.classList.add("typing");
          el.classList.add("on");
          if (!isSpace) lastLetter = el;
          moveCaret(el);
        });
        if (isSpace) t += 190 + Math.random() * 90;
      });
      const doneAt = t + 120;
      later(doneAt, () => {
        caret.current?.classList.remove("typing"); // resume blinking
        moveCaret(lastLetter);
      });
      // once every glow has faded, drop the effect layers so the text renders crisply
      later(doneAt + 950, () => b?.classList.add("settled"));
      // blink twice, then fade the caret and open — once the imagery is ready (never wait > 4s extra)
      later(doneAt + 1050, () => caret.current?.classList.add("gone"));
      const start = performance.now();
      const ready = () => {
        if (!alive) return;
        if (loaded >= total || performance.now() - start > 4000) openIris();
        else later(120, ready);
      };
      later(doneAt + 1300, ready);
    };
    // Wait for webfonts so the measured metrics are final (but never stall).
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(type);
    window.addEventListener("resize", place);

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      document.documentElement.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  if (gone) return null;
  return (
    <>
      {/* the black page — this is what the iris opens */}
      <div id="loader" ref={root} role="status" aria-label={`Loading — ${site.name}`} />
      {/* the typed name lives above it, untouched by the iris mask */}
      <div className="loader-name" ref={box} aria-hidden="true">
        <span className="type-line" ref={line}>
          {Array.from(site.name).map((ch, i) =>
            ch === " " ? <span key={i} className="ts" /> : <span key={i} className="tl">{ch}</span>,
          )}
          <span className="caret" ref={caret} />
        </span>
      </div>
    </>
  );
}
