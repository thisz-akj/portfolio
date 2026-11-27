"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/motion";

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

/** Lenis smooth scroll driven by the GSAP ticker so ScrollTrigger stays in sync. */
export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    window.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      window.__lenis = undefined;
    };
  }, []);

  // On route change: jump to top (or hash) and recompute triggers.
  useEffect(() => {
    const hash = window.location.hash;
    const target = hash ? document.querySelector(hash) : null;
    if (target) {
      window.__lenis?.scrollTo(target as HTMLElement, { immediate: true });
    } else {
      window.__lenis?.scrollTo(0, { immediate: true });
    }
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => window.clearTimeout(id);
  }, [pathname]);

  // Re-measure every scroll animation when the page's height settles after a change (web fonts, the hero
  // film sizing itself, images, "Read more"). Measuring once at load left the About bio's fade ending
  // ~2 lines early, so its last line stayed dark. Debounced; only reacts to real height changes.
  useEffect(() => {
    let last = document.documentElement.scrollHeight;
    let t = 0;
    const ro = new ResizeObserver(() => {
      const h = document.documentElement.scrollHeight;
      if (Math.abs(h - last) < 2) return;
      last = h;
      window.clearTimeout(t);
      t = window.setTimeout(() => ScrollTrigger.refresh(), 200);
    });
    ro.observe(document.body);
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, []);

  return null;
}
