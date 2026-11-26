"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import type { Solution } from "@/types/content";
import { solutionIcons } from "@/components/ui/Icons";
import { Poster } from "@/components/shared/Poster";
import { Preview } from "./Preview";
import { LoopVideo } from "@/components/shared/LoopVideo";
import { SolutionDrawer } from "./SolutionDrawer";
import { bentoTracks, gridArea } from "@/lib/bento";

/* Bento on a 6-col grid: [3×2][3×2] / [2][2][2] / [2][2][CTA 2].
   AI automation and computer vision share the first rows; the rest keep the same proportions. */
const LAYOUT = ["w3 h2", "w3 h2", "", "", "", "", ""];
const INITIAL = 6;

function RentCard({
  s,
  size,
  reveal,
  delay,
  onOpen,
  area,
  hovered,
  onHover,
}: {
  s: Solution;
  size: string;
  reveal: boolean;
  delay: number;
  onOpen: () => void;
  area: ReturnType<typeof gridArea>;
  hovered: boolean;
  onHover: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const Icon = solutionIcons[s.icon];

  // Only animate previews that are on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <article
      ref={ref}
      className={`rent-card ${size} ${reveal ? "revealing" : ""} ${hovered ? "is-hover" : ""}`}
      style={
        {
          "--rd": `${delay}s`,
          "--gc": area?.column,
          "--gr": area?.row,
        } as React.CSSProperties
      }
      onMouseEnter={onHover}
      onFocus={onHover}
    >
      <button type="button" className="rent-hit" onClick={onOpen} aria-label={`Open ${s.title}`} data-cursor="view" data-cursor-label="Open" />
      <div className="rent-media">
        <div className="rent-art" style={{ backgroundImage: `url(${s.video ? `/video/${s.video}.webp` : s.art})` }}>
          {s.video && <LoopVideo src={`/video/${s.video}.mp4`} poster={`/video/${s.video}.webp`} className="art-video" paused={paused} />}
        </div>
        <span className="rent-num">{s.index}</span>
        <span className="rent-open" aria-hidden="true">
          <ArrowUpRight size={16} />
        </span>
        <Preview kind={s.preview} paused={paused || !visible} />
      </div>
      <div className="rent-meta">
        <span className="rent-logo" aria-hidden="true">
          <Icon size={18} strokeWidth={1.8} />
        </span>
        <span className="rent-credit">
          <span className="rc-line">
            <strong>{s.title}</strong>
          </span>
          <span className="rc-line">for {s.customers.slice(0, 3).join(" · ")}</span>
        </span>
        <button
          type="button"
          className="rent-ctl"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? `Play ${s.title} preview` : `Pause ${s.title} preview`}
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
      </div>
    </article>
  );
}

/**
 * "Things I keep getting hired for." — Jorge-style bento of the seven solutions.
 * Click a card → side panel with the story and a demo showcase.
 */
export function HiredBento({ solutions, showAll = false, withHeading = true }: { solutions: Solution[]; showAll?: boolean; withHeading?: boolean }) {
  const [expanded, setExpanded] = useState(showAll);
  const [active, setActive] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const noteRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const shown = expanded ? solutions : solutions.slice(0, INITIAL);
  const rows = expanded ? 4 : 3;
  const tracks = bentoTracks(hover, rows);

  // The grow / grayscale effect is a desktop, fine-pointer (or keyboard) interaction only.
  const canHover = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1025px)");
    const sync = () => {
      canHover.current = mq.matches;
      if (!mq.matches) setHover(null);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const hoverAt = (i: number) => {
    if (canHover.current) setHover(i);
  };

  const openAt = (i: number) => {
    setActive(i);
    setOpen(true);
  };
  const close = useCallback(() => setOpen(false), []);
  const step = useCallback(
    (d: 1 | -1) => setActive((i) => (i === null ? 0 : (i + d + solutions.length) % solutions.length)),
    [solutions.length],
  );

  // Hand-drawn note writes itself when the section scrolls in.
  useEffect(() => {
    const el = noteRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.classList.add("drawn");
        io.disconnect();
      }
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {withHeading && (
        <div className="rent-head">
          <p className="eyebrow">03 · Hired for</p>
          <Poster lines={["Things I keep", "getting hired for."]} />
          <p className="rent-intro">
            I&apos;ve read enough AI case studies to know nobody finishes them. So here are bento boxes: the systems people pay me
            to build, at a glance. Less explaining. More showing.
          </p>
          <div className="rent-note" ref={noteRef} aria-hidden="true">
            <span>click one — it opens</span>
            <svg viewBox="0 0 100 60">
              <path pathLength={1} d="M10 6 C 30 30, 50 44, 84 50" />
              <path pathLength={1} d="M70 40 L 86 51 L 70 58" />
            </svg>
          </div>
        </div>
      )}

      <div
        className={`rent-grid placed ${hover !== null ? "hovering" : ""}`}
        style={{ "--tc": tracks.columns, "--tr": tracks.rows, "--rows": rows } as React.CSSProperties}
        onMouseLeave={() => setHover(null)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover(null);
        }}
      >
        {shown.map((s, i) => (
          <RentCard
            key={s.slug}
            s={s}
            size={LAYOUT[i] ?? ""}
            reveal={!showAll && expanded && i >= INITIAL}
            delay={Math.max(0, i - INITIAL) * 0.08}
            onOpen={() => openAt(i)}
            area={gridArea(i)}
            hovered={hover === i}
            onHover={() => hoverAt(i)}
          />
        ))}
        {expanded && (
          <article
            className={`rent-card rent-cta w2 ${!showAll ? "revealing" : ""} ${hover === 7 ? "is-hover" : ""}`}
            style={{ "--rd": "0.16s", "--gc": gridArea(7)?.column, "--gr": gridArea(7)?.row } as React.CSSProperties}
            onMouseEnter={() => hoverAt(7)}
            onFocus={() => hoverAt(7)}
          >
            <div>
              <h3 className="poster" aria-label="Not on the list?">
                <span className="poster-layer">Not on</span>
                <span className="poster-layer">the list?</span>
              </h3>
              <p>If it involves messy data, repetitive work and a model that has to be right, I&apos;ve probably built something like it.</p>
            </div>
            <Link href="/contact" className="btn-pill">
              Tell me about it <ArrowUpRight size={16} />
            </Link>
          </article>
        )}
      </div>

      {!expanded && (
        <div className="bento-more">
          <button type="button" className="btn-pill" aria-expanded={expanded} onClick={() => setExpanded(true)}>
            See more
          </button>
        </div>
      )}

      <SolutionDrawer solution={active === null ? null : solutions[active]} open={open} onClose={close} onStep={step} />
    </>
  );
}
