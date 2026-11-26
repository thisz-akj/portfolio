"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/motion";

/**
 * Footer sign-off: the name as a pen signature. When the footer comes into view the signature
 * writes itself on left → right (soft-edged mask, like the About "hello"), then one warm light
 * sweeps across it; while scrolling in, it rises gently into place. Calm and editorial, no effects
 * on hover.
 */
export function FooterSignature({ name }: { name: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.classList.add("signed");
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.classList.add("signed");
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".fs-ink",
        { yPercent: 14 },
        { yPercent: 0, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom bottom", scrub: true } },
      );
    }, el);
    return () => {
      io.disconnect();
      ctx.revert();
    };
  }, []);

  return (
    <div className="footer-signature" ref={root}>
      <span className="fs-lead">— Signed,</span>
      <p className="fs-ink" aria-label={name}>
        <span className="fs-write" aria-hidden="true">
          {name}
        </span>
      </p>
    </div>
  );
}
