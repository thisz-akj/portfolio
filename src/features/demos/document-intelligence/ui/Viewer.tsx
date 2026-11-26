"use client";

import { useEffect, useRef } from "react";
import { pageSrc } from "../api";
import type { Rect } from "../types";

export interface Highlight {
  rects: Rect[];
  tone?: "cite" | "add" | "del" | "warn";
  /** Changes when the same rects should be scrolled to again */
  nonce?: number;
}

/** Page images with highlight boxes drawn over them (rects are fractions of the page). */
export function Viewer({
  docId,
  title,
  pageSizes,
  highlight,
  compact = false,
}: {
  docId: string;
  title: string;
  pageSizes: { n: number; w: number; h: number }[];
  highlight: Highlight | null;
  compact?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = highlight?.rects[0];
    const el = box.current;
    if (!first || !el) return;
    const page = el.querySelector<HTMLElement>(`[data-page="${first.page}"]`);
    if (!page) return;
    const target = page.offsetTop + first.y * page.offsetHeight - el.clientHeight * 0.3;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: Math.max(0, target), behavior: reduce ? "auto" : "smooth" });
  }, [highlight]);

  return (
    <div className={`dd-viewer${compact ? " is-compact" : ""}`} ref={box} tabIndex={0} aria-label={`${title} — document pages`}>
      {pageSizes.map((p) => (
        <div key={p.n} className="dd-page" data-page={p.n} style={{ aspectRatio: `${p.w} / ${p.h}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic page renders from the service */}
          <img src={pageSrc(docId, p.n)} alt={`Page ${p.n} of ${title}`} loading={p.n <= 2 ? "eager" : "lazy"} draggable={false} />
          {highlight?.rects
            .filter((r) => r.page === p.n)
            .map((r, i) => (
              <span
                key={`${highlight.nonce ?? 0}-${i}`}
                className={`dd-hl is-${highlight.tone ?? "cite"}`}
                style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
                aria-hidden="true"
              />
            ))}
          <span className="dd-page-no">{p.n}</span>
        </div>
      ))}
    </div>
  );
}
