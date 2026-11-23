"use client";

import { useEffect, useRef } from "react";
import { site } from "@/content/site";
import { heroImages } from "@/content/hero";
import { LoopVideo } from "@/components/shared/LoopVideo";
import { HeroMesh } from "./HeroMesh";
import { uCurve } from "@/lib/curve";
import { gsap, onLoaderDone, prefersReducedMotion } from "@/lib/motion";
import { glintsToward, imageSampler, type GlintTarget } from "./starAssembly";

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = prefersReducedMotion();
    const imgs = Array.from(el.querySelectorAll<HTMLElement>(".pimg"));
    const letters = Array.from(el.querySelectorAll<HTMLElement>(".hn-letter"));

    if (reduced) {
      gsap.set(imgs, { opacity: 1 });
      return;
    }

    const bg = el.querySelector<HTMLElement>(".hero-bg");
    const eyebrow = el.querySelector<HTMLElement>(".hero-eyebrow");
    const roles = el.querySelector<HTMLElement>(".hero-roles");
    const sub = el.querySelector<HTMLElement>(".hero-sub");
    const scrollCue = el.querySelector<HTMLElement>(".hero-scroll");
    const header = document.querySelector<HTMLElement>(".site-header");
    const intro = !(window as Window & { __siteLoaded?: boolean }).__siteLoaded; // the typed intro will run

    const ctx = gsap.context(() => {
      // Letters start on a U-arc below the baseline: edges deepest, centre shallowest.
      const n = letters.length;
      letters.forEach((l, i) => gsap.set(l, { yPercent: 20 + 95 * uCurve(i, n) }));
      gsap.set(imgs, { autoAlpha: 0 });
      gsap.set([eyebrow, roles, sub, scrollCue], { autoAlpha: 0 });
      if (bg) gsap.set(bg, { opacity: 0 });
      if (intro && header) gsap.set(header, { autoAlpha: 0, y: -14 });
    }, el);

    let stopGlints: (() => void) | null = null;
    let cancelled = false;

    const run = () =>
      ctx.add(() => {
        const w = window as Window & { __heroHandoff?: boolean; __heroOrigin?: { x: number; y: number } };
        const handoff = !!w.__heroHandoff;
        const tr = el.querySelector(".hero-name")?.getBoundingClientRect();
        const origin = w.__heroOrigin ?? (tr ? { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 });

        if (handoff) {
          // The typed intro landed exactly where the title lives — it's already in place.
          gsap.set(letters, { yPercent: 0 });
        } else {
          gsap.to(letters, { yPercent: 0, duration: 0.9, ease: "power3.out", stagger: { each: 0.04, from: "center" }, delay: 0.05 });
        }

        // ── Ripple: everything arrives in order of distance from the name ──
        const far = Math.hypot(innerWidth, innerHeight) / 2;
        const wave = handoff ? 1.15 : 0.8; // seconds for the ripple to reach the corners
        const lead = handoff ? 0.25 : 0.1;
        const delayOf = (node: Element) => {
          const r = node.getBoundingClientRect();
          const d = Math.hypot(r.left + r.width / 2 - origin.x, r.top + r.height / 2 - origin.y);
          return lead + Math.min(1, d / far) * wave;
        };

        // Tiles develop like photographs: from a sliver of light, over-exposed and
        // soft, drifting in from depth along the ripple's direction.
        const tileDelays = imgs.map((node) => delayOf(node));
        imgs.forEach((node, i) => {
          const r = node.getBoundingClientRect();
          const dx = r.left + r.width / 2 - origin.x;
          const dy = r.top + r.height / 2 - origin.y;
          const len = Math.hypot(dx, dy) || 1;
          gsap.fromTo(
            node,
            {
              autoAlpha: 0,
              scale: 0.86,
              xPercent: (dx / len) * 9,
              yPercent: (dy / len) * 9,
              clipPath: "inset(48% 48% 48% 48% round 2px)",
              filter: "blur(16px) brightness(2.1) saturate(0.3)",
            },
            {
              autoAlpha: 1,
              scale: 1,
              xPercent: 0,
              yPercent: 0,
              clipPath: "inset(0% 0% 0% 0% round 2px)",
              filter: "blur(0px) brightness(1) saturate(1)",
              duration: 1.6,
              ease: "expo.out",
              delay: tileDelays[i],
              clearProps: "clipPath,filter",
            },
          );
        });

        // Soft colour-matched glints converge on each tile just before it develops.
        Promise.all(
          imgs.map(async (node, i): Promise<GlintTarget> => {
            const art = node.querySelector<HTMLElement>(".tile-art")?.style.backgroundImage.match(/url\("?([^")]+)"?\)/)?.[1];
            const r = node.getBoundingClientRect();
            return { el: node, delay: tileDelays[i], color: art ? await imageSampler(art, r.width, r.height) : undefined };
          }),
        ).then((targets) => {
          if (!cancelled) stopGlints = glintsToward(targets, origin);
        });

        // Words: the eyebrow condenses from wide tracking; lines rise out of a blur.
        if (eyebrow) {
          const ls = getComputedStyle(eyebrow).letterSpacing;
          // stays on one line while condensing, so nothing below it shifts
          gsap.set(eyebrow, { whiteSpace: "nowrap" });
          gsap.fromTo(eyebrow, { autoAlpha: 0, letterSpacing: innerWidth < 768 ? "0.5em" : "0.9em", filter: "blur(6px)" },
            { autoAlpha: 1, letterSpacing: ls, filter: "blur(0px)", duration: 1.6, ease: "expo.out", delay: lead + 0.15, clearProps: "letterSpacing,filter" });
        }
        gsap.fromTo([roles, sub], { autoAlpha: 0, y: 22, filter: "blur(10px)" },
          { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 1.3, ease: "expo.out", stagger: 0.14, delay: lead + 0.3, clearProps: "filter" });
        if (scrollCue) gsap.fromTo(scrollCue, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 1, ease: "power3.out", delay: lead + wave + 0.4 });
        if (bg) gsap.to(bg, { opacity: 1, duration: 2.2, ease: "power2.out", delay: lead * 0.5 });
        if (header) gsap.to(header, { autoAlpha: 1, y: 0, duration: 1.1, ease: "power3.out", delay: handoff ? lead + wave * 0.8 : 0, clearProps: "transform,opacity,visibility" });
      });
    const offLoader = onLoaderDone(() => run());

    // Mouse parallax — each image lags toward its target via quickTo.
    const setters = imgs.map((img) => {
      const depth = Number(img.dataset.depth ?? 1);
      return {
        depth,
        x: gsap.quickTo(img, "x", { duration: 1.2 + (1 - depth) * 0.6, ease: "power3.out" }),
        y: gsap.quickTo(img, "y", { duration: 1.2 + (1 - depth) * 0.6, ease: "power3.out" }),
      };
    });
    const AMP = 60;
    const push = (nx: number, ny: number) =>
      setters.forEach((s) => {
        s.x(-nx * AMP * s.depth);
        s.y(-ny * AMP * s.depth);
      });
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      push((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
    };
    // Tilt parallax on devices that expose orientation without a permission prompt.
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      push(Math.max(-0.5, Math.min(0.5, e.gamma / 60)), Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 60)));
    };
    el.addEventListener("pointermove", onMove);
    const needsPermission =
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function";
    if (!needsPermission) window.addEventListener("deviceorientation", onTilt);

    // Scroll: images drift at their own depth, the name sinks and fades.
    ctx.add(() => {
      imgs.forEach((img) => {
        const depth = Number(img.dataset.depth ?? 1);
        gsap.to(img.querySelector(".tile-art"), {
          yPercent: -18 * depth,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true },
        });
      });
      gsap.to(el.querySelector(".hero-bg"), {
        yPercent: 8,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(el.querySelector(".hero-text"), {
        yPercent: 18,
        opacity: 0.2,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true },
      });
    });

    return () => {
      cancelled = true;
      stopGlints?.();
      offLoader();
      el.removeEventListener("pointermove", onMove);
      window.removeEventListener("deviceorientation", onTilt);
      ctx.revert();
    };
  }, []);

  const [first, ...rest] = site.name.split(" ");

  return (
    <section className="hero" id="hero" ref={root} aria-label="Introduction">
      <div className="hero-bg" aria-hidden="true">
        <HeroMesh />
        <div className="hero-grain" />
      </div>
      <div className="parallax-field" aria-hidden="true">
        {heroImages.map((im) => {
          const [l, t, w, h] = im.box;
          const m = im.mobile;
          return (
            <div
              key={im.id}
              className={`pimg ${im.size} ${m === null ? "no-mobile" : ""}`}
              data-depth={im.depth}
              style={
                {
                  "--l": `${l}%`, "--t": `${t}%`, "--w": `${w}%`, "--h": `${h}%`,
                  "--ml": `${(m ?? im.box)[0]}%`, "--mt": `${(m ?? im.box)[1]}%`, "--mw": `${(m ?? im.box)[2]}%`, "--mh": `${(m ?? im.box)[3]}%`,
                } as React.CSSProperties
              }
            >
              <div className="tile-art" style={{ backgroundImage: `url(${im.art})` }}>
                {im.video && <LoopVideo src={`/video/${im.video}.mp4`} poster={im.art} className="tile-video" />}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hero-text">
        <p className="hero-eyebrow">{site.role}</p>
        <div className="hero-name-clip">
          <h1 className="hero-name" aria-label={site.name}>
            {Array.from(`${first} ${rest.join(" ")}`).map((ch, i) =>
              ch === " " ? (
                <span key={i} className="hn-space" aria-hidden="true" />
              ) : (
                <span key={i} className="hn-letter" aria-hidden="true">
                  {ch}
                </span>
              ),
            )}
          </h1>
        </div>
        <p className="hero-roles">
          {site.roles.map((r, i) => (
            <span key={r} style={{ display: "contents" }}>
              {i > 0 && <span className="hero-roles-sep">·</span>}
              <span>{r}</span>
            </span>
          ))}
        </p>
        <p className="hero-sub">
          I build AI systems that <em>survive contact</em> with real users.
        </p>
      </div>

      <div className="hero-scroll" aria-hidden="true">
        <span className="hero-scroll-line" />
        Scroll
      </div>
    </section>
  );
}
