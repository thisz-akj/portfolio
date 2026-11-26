"use client";

import { useEffect, useRef } from "react";
import { site } from "@/content/site";
import { gsap, prefersReducedMotion } from "@/lib/motion";

/**
 * About portrait, editorial and quiet: three close frames of Azad (z07 → z08 → z09) inside a tall
 * arch. Behind it a large italic name drifts; a handwritten "hello" writes itself across the arch;
 * a small circular text badge turns slowly; a soft band of warm light passes over the photo.
 *  - entrance: the arch rises from its base while the photo settles from 1.2×, then "hello" is drawn;
 *  - while reading: the frames melt into each other (like a held breath), the name and the photo drift
 *    at different depths, and the light band sweeps once across.
 * Desktop: sticky beside the text (`.about-visual`); ≤1024px it sits above it.
 */

const FRAMES = ["07", "08", "09"] as const;
const RING = "Applied AI · Automation · Computer Vision · ";

export function AboutFrames() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const imgs = gsap.utils.toArray<HTMLElement>(".af-img", el);
    if (prefersReducedMotion()) {
      gsap.set(imgs.slice(0, -1), { autoAlpha: 0 });
      el.classList.add("in");
      return;
    }
    const section = el.closest("section") ?? el;

    const ctx = gsap.context(() => {
      gsap.set(imgs.slice(1), { autoAlpha: 0 });

      // ── Entrance ──
      gsap
        .timeline({ scrollTrigger: { trigger: el, start: "top 80%", once: true }, onStart: () => el.classList.add("in") })
        .fromTo(".af-arch", { clipPath: "inset(100% 0% 0% 0% round 999px 999px 0 0)" },
          { clipPath: "inset(0% 0% 0% 0% round 999px 999px 0 0)", duration: 1.7, ease: "expo.inOut" }, 0)
        .fromTo(".af-media", { scale: 1.2 }, { scale: 1, duration: 2.4, ease: "expo.out" }, 0.3)
        .fromTo(".af-name", { autoAlpha: 0, yPercent: 30 }, { autoAlpha: 1, yPercent: 0, duration: 1.8, ease: "expo.out" }, 0.2)
        .fromTo(".af-ring", { autoAlpha: 0, scale: 0.6, rotate: -60 }, { autoAlpha: 1, scale: 1, rotate: 0, duration: 1.6, ease: "expo.out" }, 1.0)
        .fromTo(".af-cap", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 1, ease: "power3.out" }, 1.4);

      // ── While reading ──
      const mm = gsap.matchMedia();
      mm.add({ wide: "(min-width: 1025px)", narrow: "(max-width: 1024px)" }, (c) => {
        const st = c.conditions?.wide
          ? { trigger: section, start: "top 20%", end: "bottom bottom", scrub: 1 }
          : { trigger: el, start: "top 70%", end: "bottom 10%", scrub: 1 };
        gsap
          .timeline({ defaults: { ease: "none" }, scrollTrigger: st })
          // frames melt into each other — long, overlapping dissolves
          .to(imgs[1], { autoAlpha: 1, duration: 0.3, ease: "sine.inOut" }, 0.12)
          .to(imgs[2], { autoAlpha: 1, duration: 0.3, ease: "sine.inOut" }, 0.48)
          // depth: photo, name and badge move at different speeds
          .fromTo(".af-img", { yPercent: -4 }, { yPercent: 4, duration: 1 }, 0)
          .fromTo(".af-name", { yPercent: 18 }, { yPercent: -28, duration: 1, immediateRender: false }, 0)
          .fromTo(".af-ring", { rotate: 0 }, { rotate: 160, duration: 1, immediateRender: false }, 0)
          // a band of warm light crosses the portrait once
          .fromTo(".af-light", { xPercent: -120 }, { xPercent: 120, duration: 0.7, ease: "sine.inOut" }, 0.15);
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <figure className="af" ref={root} aria-label={`Portrait of ${site.name}`}>
      <span className="af-name" aria-hidden="true">
        {site.shortName}
      </span>

      <div className="af-arch">
        <div className="af-media">
          {FRAMES.map((f) => (
            // eslint-disable-next-line @next/next/no-img-element -- stacked frames dissolved by GSAP
            <img key={f} className="af-img" src={`/art/hero/z${f}.webp`} alt={f === "09" ? site.name : ""} loading="lazy" decoding="async" />
          ))}
        </div>
        <div className="af-light" aria-hidden="true" />
        <div className="af-shade" aria-hidden="true" />
      </div>

      <span className="af-hello" aria-hidden="true">
        <span className="af-hello-ink">hello</span>
      </span>

      <svg className="af-ring" viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <path id="af-ring-path" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
        </defs>
        <text>
          <textPath href="#af-ring-path" textLength="289">
            {RING}
          </textPath>
        </text>
        <circle cx="60" cy="60" r="3" />
      </svg>

      <figcaption className="af-cap">
        <em>{site.name}</em>
        <span>{site.role}</span>
      </figcaption>
    </figure>
  );
}
