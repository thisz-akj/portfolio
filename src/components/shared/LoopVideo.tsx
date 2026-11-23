"use client";

import { useEffect, useRef } from "react";

/**
 * Muted, looping background clip. Loads lazily, plays only while on screen,
 * respects an external `paused` flag and prefers-reduced-motion (poster only).
 */
export function LoopVideo({ src, poster, className = "", paused = false }: { src: string; poster: string; className?: string; paused?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const inView = useRef(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const sync = () => {
      if (inView.current && !paused) {
        if (v.preload === "none") v.preload = "auto";
        v.play().catch(() => {});
      } else v.pause();
    };
    const io = new IntersectionObserver(
      ([e]) => {
        inView.current = e.isIntersecting;
        sync();
      },
      { rootMargin: "120px" },
    );
    io.observe(v);
    sync();
    return () => io.disconnect();
  }, [paused]);

  return <video ref={ref} className={className} src={src} poster={poster} muted loop playsInline preload="none" aria-hidden="true" />;
}
