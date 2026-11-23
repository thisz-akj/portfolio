"use client";

import { useEffect } from "react";
import { sound } from "@/lib/sound";

/** Things worth a hover tick, with a pitch per kind so the UI has a gentle "voice". */
const TARGETS: [string, number][] = [
  [".rent-card, .client-tile, .card, .featured-item, .project-row", 1],
  [".nav-link, .logo, .nav-icon, .nav-status, .menu-btn", 1.26],
  [".btn-pill, .btn-ghost, .barrel-link, .drawer-btn, .rent-ctl, .case-control, .hired-link", 1.12],
];
const SELECTOR = TARGETS.map(([s]) => s).join(", ");

/**
 * Wires the sound engine to the page: unlocks audio on the first gesture,
 * plays soft ticks on useful hover targets and a pop on clicks, and fades
 * everything out while the tab is hidden.
 */
export function SoundProvider() {
  useEffect(() => {
    const s = sound();
    const unlock = () => s.unlock();
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });

    let last: Element | null = null;
    const over = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = (e.target as Element | null)?.closest(SELECTOR) ?? null;
      if (el === last) return;
      last = el;
      if (!el) return;
      const pitch = TARGETS.find(([sel]) => el.matches(sel))?.[1] ?? 1;
      s.hover(pitch);
    };
    const click = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest("a, button, .rent-card")) s.tap();
    };
    const vis = () => s.setVisible(!document.hidden);

    document.addEventListener("pointerover", over);
    document.addEventListener("click", click);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
      document.removeEventListener("pointerover", over);
      document.removeEventListener("click", click);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
  return null;
}
