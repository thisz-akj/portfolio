"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { site } from "@/content/site";
import { gsap, markLoaderDone, prefersReducedMotion, uCurve } from "@/lib/motion";

/**
 * Editorial hero: Azad's motion film full-bleed (`public/video/hero-motion*.mp4`, a tall crop on
 * phones). The first frame holds HOLD_MS, the film plays once and stays on its last frame (the
 * original's 0:25 — the file is trimmed there). Name + tagline + rule table bottom-right.
 * Scroll: the film drifts slower than the page and the copy lifts away.
 */

const HOLD_MS = 2500; // first frame stays this long before the film plays
// The film is only 1920×1080 (720×1280 on phones). On big / high-density screens, cover-filling the
// viewport stretches it and it reads soft, so on desktop the sharp film is shown at most this much
// above its real pixel size; the rest of the hero is the same room, blurred (`.hero-ambient`),
// and the film's edges feather into it.
const MAX_UPSCALE = 1.25;
const FILM = { w: 1920, h: 1080 };

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const film = useRef<HTMLVideoElement>(null);
  // Chosen on the client only: rendering a src on the server made phones download the desktop
  // film (2 MB) before switching. Until then the <picture> poster below shows the first frame.
  const [clip, setClip] = useState<string | null>(null);

  // Size the sharp film: full cover when that keeps it crisp, otherwise a feathered window.
  useEffect(() => {
    const hero = root.current;
    if (!hero) return;
    const fit = () => {
      const vw = hero.clientWidth;
      const vh = hero.clientHeight;
      const wide = window.matchMedia("(min-width: 1025px)").matches;
      const max = MAX_UPSCALE / (window.devicePixelRatio || 1); // CSS px per film px we allow
      const cover = Math.max(vw / FILM.w, vh / FILM.h);
      const windowed = wide && cover > max; // full-bleed whenever that keeps the film crisp
      hero.classList.toggle("is-window", windowed);
      hero.style.setProperty("--fw", windowed ? `${Math.min(vw, FILM.w * max)}px` : "100%");
      hero.style.setProperty("--fh", windowed ? `${Math.min(vh, FILM.h * max)}px` : "100%");
    };
    fit();
    window.addEventListener("resize", fit);
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener("change", fit); // moved to a screen with another pixel density
    return () => {
      window.removeEventListener("resize", fit);
      mq.removeEventListener("change", fit);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const pick = () => setClip(mq.matches ? "hero-motion-mobile" : "hero-motion");
    pick();
    mq.addEventListener("change", pick);
    return () => mq.removeEventListener("change", pick);
  }, []);

  // Hold the first frame, then play once; the file ends on the frame we stop at.
  useEffect(() => {
    const v = film.current;
    if (!v || !clip) return;
    if (prefersReducedMotion()) return;
    const t = window.setTimeout(() => v.play().catch(() => {}), HOLD_MS);
    return () => window.clearTimeout(t);
  }, [clip]);

  useEffect(() => {
    // Other parts of the page (assistant launcher) wait for this signal.
    markLoaderDone();
    const el = root.current;
    if (!el || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      // ── Entrance ──
      const letters = gsap.utils.toArray<HTMLElement>(".ht-letter", el);
      const ease = "expo.out";
      gsap.fromTo(".hero-photo", { autoAlpha: 0, scale: 1.08, filter: "blur(14px) brightness(0.5)" },
        { autoAlpha: 1, scale: 1, filter: "blur(0px) brightness(1)", duration: 2.4, ease, clearProps: "filter" });
      // The site's signature: letters start on a U-arc below the baseline (edges deepest) and settle.
      gsap.fromTo(letters, { yPercent: (i) => 30 + 90 * uCurve(i, letters.length) },
        { yPercent: 0, duration: 1.4, ease: "power3.out", stagger: { each: 0.035, from: "center" }, delay: 0.35 });
      gsap.fromTo(".hero-eyebrow", { autoAlpha: 0, letterSpacing: "0.6em", filter: "blur(6px)" },
        { autoAlpha: 1, letterSpacing: "0.25em", filter: "blur(0px)", duration: 1.6, ease, delay: 0.3, clearProps: "letterSpacing,filter" });
      gsap.fromTo(".hero-lede", { autoAlpha: 0, y: 18, filter: "blur(8px)" },
        { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 1.3, ease, delay: 0.7, clearProps: "filter" });
      gsap.fromTo(".hero-facts li", { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 1.1, ease, stagger: 0.1, delay: 0.85 });
      gsap.fromTo(".hero-facts li", { "--rule": 0 }, { "--rule": 1, duration: 1.4, ease, stagger: 0.1, delay: 0.85 });
      gsap.fromTo(".hero-link", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: "power3.out", delay: 1.2 });

      // ── Scroll: the film drifts slower than the page, the copy lifts away ──
      const st = { trigger: el, start: "top top", end: "bottom top", scrub: true };
      gsap.to(".hero-photo", { yPercent: 12, ease: "none", scrollTrigger: st });
      gsap.to(".hero-copy", { yPercent: -30, autoAlpha: 0, ease: "none", scrollTrigger: { ...st, end: "60% top" } });
      gsap.to(".hero-link", { autoAlpha: 0, ease: "none", scrollTrigger: { ...st, end: "25% top" } });
    }, el);
    return () => ctx.revert();
  }, []);

  const [before, after] = site.tagline.split(site.taglineHighlight);

  return (
    <section className="hero" id="intro" ref={root} aria-label="Introduction">
      <div className="hero-photo" aria-hidden="true">
        <div className="hero-ambient" />
        <div className="hero-film">
          {/* First frame as a real image: the browser picks the right size while parsing the HTML
              (it is the page's largest paint), the film loads on top of it once chosen. */}
          <picture>
            <source media="(max-width: 768px)" srcSet="/video/hero-motion-mobile.webp" />
            <img className="hero-video" src="/video/hero-motion.webp" alt="" fetchPriority="high" decoding="async" />
          </picture>
          {clip && (
            <video
              key={clip}
              ref={film}
              className="hero-video"
              src={`/video/${clip}.mp4`}
              muted
              playsInline
              preload="auto"
              aria-hidden="true"
            />
          )}
        </div>
        {/* Fine frost over the whole film: just enough blur to melt the footage's grain. */}
        <div className="hero-degrain" />
        {/* Frosted-glass pane over the film (strength: --frost-blur / --frost-tint in globals.css). */}
        <div className="hero-frost" />
      </div>
      <div className="hero-shade" aria-hidden="true" />

      <div className="hero-copy">
        <p className="eyebrow hero-eyebrow">{site.role}</p>
        <h1 className="hero-title" aria-label={site.name}>
          {Array.from(site.name).map((ch, i) =>
            ch === " " ? (
              <span key={i} className="ht-space" aria-hidden="true" />
            ) : (
              <span key={i} className="ht-letter" aria-hidden="true">
                {ch}
              </span>
            ),
          )}
        </h1>
        <p className="hero-lede">
          {before}
          <em className="q-highlight">{site.taglineHighlight}</em>
          {after}
        </p>
        <ul className="hero-facts">
          <li>
            <span className="k">Focus</span>
            <span className="v">
              {site.roles.map((r, i) => (
                <span key={r}>
                  {i > 0 && <span className="sep">·</span>}
                  {r}
                </span>
              ))}
            </span>
          </li>
          <li>
            <span className="k">Based in</span>
            <span className="v">{site.location.city}</span>
          </li>
          <li>
            <span className="k">Status</span>
            <span className="v live">{site.status}</span>
          </li>
        </ul>
      </div>

      <a className="btn-ghost hero-link" href="#about">
        About me <ArrowDown size={14} strokeWidth={1.5} />
      </a>
    </section>
  );
}
