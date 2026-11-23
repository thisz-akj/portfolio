"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };

export { uCurve, splitGraphemes } from "./curve";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const isFinePointer = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Fires once the home loader has finished (or immediately if there is none). */
export const LOADER_EVENT = "site:loaded";

export function onLoaderDone(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const w = window as Window & { __siteLoaded?: boolean };
  if (w.__siteLoaded) {
    cb();
    return () => {};
  }
  window.addEventListener(LOADER_EVENT, cb, { once: true });
  return () => window.removeEventListener(LOADER_EVENT, cb);
}

export function markLoaderDone() {
  const w = window as Window & { __siteLoaded?: boolean };
  w.__siteLoaded = true;
  window.dispatchEvent(new Event(LOADER_EVENT));
}
