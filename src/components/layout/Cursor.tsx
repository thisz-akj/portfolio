"use client";

import { useEffect, useRef } from "react";
import { gsap, isFinePointer } from "@/lib/motion";

/**
 * Dot cursor → ring on links → filled "VIEW" disc on [data-cursor="view"].
 * Elements can set data-cursor="view|drag|hover" and data-cursor-label="…".
 */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !isFinePointer()) return;
    document.body.classList.add("has-cursor");

    const xTo = gsap.quickTo(el, "x", { duration: 0.18, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.18, ease: "power3.out" });

    const move = (e: PointerEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
      el.classList.add("visible");
    };
    const leave = () => el.classList.remove("visible");

    const over = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      const special = t?.closest<HTMLElement>("[data-cursor]");
      el.classList.remove("hover", "hover-view", "hover-drag");
      if (special) {
        const kind = special.dataset.cursor;
        el.classList.add(kind === "view" ? "hover-view" : kind === "drag" ? "hover-drag" : "hover");
        el.dataset.label = special.dataset.cursorLabel ?? "View";
        return;
      }
      if (t?.closest("a, button, input, textarea, select, label")) el.classList.add("hover");
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerover", over);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
      document.documentElement.removeEventListener("pointerleave", leave);
      document.body.classList.remove("has-cursor");
    };
  }, []);

  return <div id="cursor" ref={ref} aria-hidden="true" />;
}
