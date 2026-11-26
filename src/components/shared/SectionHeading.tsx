"use client";

import { useEffect, useRef } from "react";
import { arcOffsets } from "@/lib/curve";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/motion";

/**
 * Heading whose letters sit on a U-shaped arc and settle to the baseline as you scroll.
 *   startY(i)   = min + (amp − min) × |cos(t × π)|
 *   currentY(i) = startY(i) × (1 − p)
 * Edges land first · middle follows · pure math.
 */
export function SectionHeading({
  children,
  as: Tag = "h2",
  className = "",
  amp = -40,
  min = -12,
}: {
  children: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
  amp?: number;
  min?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const letters = Array.from(el.querySelectorAll<HTMLElement>(".sh-letter"));
    const startY = arcOffsets(letters.length, amp, min);
    letters.forEach((l, i) => gsap.set(l, { y: startY[i] }));
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top 90%",
      end: "top 30%",
      scrub: true,
      onUpdate(self) {
        const p = self.progress;
        letters.forEach((l, i) => gsap.set(l, { y: startY[i] * (1 - p) }));
      },
      onLeave() {
        letters.forEach((l) => gsap.set(l, { y: 0 }));
      },
    });
    return () => {
      st.kill();
      gsap.set(letters, { clearProps: "transform" });
    };
  }, [amp, min]);

  return (
    <Tag ref={ref} className={`section-heading ${className}`} aria-label={children}>
      {/* Letters are grouped per word so long headings wrap between words, never inside one. */}
      {children.split(" ").map((word, w) => (
        <span key={w} className="sh-word" aria-hidden="true">
          {w > 0 && <span className="sh-space" />}
          {Array.from(word).map((ch, i) => (
            <span key={i} className="sh-letter">
              {ch}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}
