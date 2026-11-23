"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/motion";

/**
 * Jorge-style stacked poster title: one solid layer and two outlined ghost
 * layers that drift apart as the title scrolls through the viewport.
 */
export function Poster({
  lines,
  className = "",
  as: Tag = "h2",
}: {
  lines: string[];
  className?: string;
  as?: "h1" | "h2";
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const [g1, g2] = Array.from(el.querySelectorAll<HTMLElement>(".poster-ghost"));
    const tl = gsap.timeline({
      scrollTrigger: { trigger: el, start: "top 95%", end: "bottom 15%", scrub: true },
    });
    tl.fromTo(g1, { yPercent: 0 }, { yPercent: -9, ease: "none" }, 0)
      .fromTo(g2, { yPercent: 0 }, { yPercent: -18, ease: "none" }, 0)
      .fromTo(el.querySelector(".poster-solid"), { yPercent: 6 }, { yPercent: 0, ease: "none" }, 0);
    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  const content = lines.map((l, i) => (
    <span key={i} className="poster-layer">
      {l}
    </span>
  ));

  return (
    <Tag ref={ref} className={`poster ${className}`} aria-label={lines.join(" ")}>
      <span className="poster-ghost g2" aria-hidden="true">{content}</span>
      <span className="poster-ghost g1" aria-hidden="true">{content}</span>
      <span className="poster-solid" aria-hidden="true" style={{ display: "block", position: "relative" }}>
        {content}
      </span>
    </Tag>
  );
}

