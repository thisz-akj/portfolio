"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/motion";

/** "[ LABEL ]" link whose letters roll like a drum, left → right, on hover. */
export function BarrelLink({ href, label, external }: { href: string; label: string; external?: boolean }) {
  const wrap = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const w = wrap.current;
    if (!root || !w) return;
    const drums = Array.from(w.querySelectorAll<HTMLElement>(".barrel-drum")).map((d) => ({
      f0: d.children[0] as HTMLElement,
      f1: d.children[1] as HTMLElement,
    }));
    drums.forEach(({ f0, f1 }) => {
      gsap.set(f0, { yPercent: 0, opacity: 1 });
      gsap.set(f1, { yPercent: -100, opacity: 0 });
    });
    let tl: gsap.core.Timeline | null = null;
    const enter = () => {
      tl?.kill();
      tl = gsap.timeline();
      drums.forEach(({ f0, f1 }, i) => {
        const d = i * 0.035;
        tl!.to(f0, { yPercent: 100, opacity: 0, duration: 0.3, ease: "power3.in" }, d)
          .to(f1, { yPercent: 0, opacity: 1, duration: 0.3, ease: "power3.out" }, d + 0.08);
      });
    };
    const leave = () => {
      tl?.kill();
      tl = gsap.timeline();
      drums.forEach(({ f0, f1 }, i) => {
        const d = i * 0.035;
        tl!.to(f1, { yPercent: -100, opacity: 0, duration: 0.3, ease: "power3.in" }, d)
          .to(f0, { yPercent: 0, opacity: 1, duration: 0.3, ease: "power3.out" }, d + 0.08);
      });
    };
    root.addEventListener("mouseenter", enter);
    root.addEventListener("mouseleave", leave);
    root.addEventListener("focus", enter);
    root.addEventListener("blur", leave);
    return () => {
      tl?.kill();
      root.removeEventListener("mouseenter", enter);
      root.removeEventListener("mouseleave", leave);
      root.removeEventListener("focus", enter);
      root.removeEventListener("blur", leave);
    };
  }, []);

  const inner = (
    <>
      <span className="barrel-bracket bl-l" aria-hidden="true">[</span>
      <span className="barrel-wrap" ref={wrap} aria-hidden="true">
        {Array.from(label).map((ch, i) => (
          <span className="barrel-drum" key={i}>
            <span className="barrel-face barrel-face-0">{ch}</span>
            <span className="barrel-face barrel-face-1">{ch}</span>
          </span>
        ))}
      </span>
      <span className="sr-only">{label}</span>
      <span className="barrel-bracket bl-r" aria-hidden="true">]</span>
    </>
  );

  return external ? (
    <a ref={rootRef} href={href} className="barrel-link" target="_blank" rel="noreferrer">
      {inner}
    </a>
  ) : (
    <Link ref={rootRef} href={href} className="barrel-link">
      {inner}
    </Link>
  );
}
