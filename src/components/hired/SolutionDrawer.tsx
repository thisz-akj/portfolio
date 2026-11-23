"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Solution } from "@/types/content";
import { getDemo, statusLabel } from "@/content/demos";
import { solutionIcons } from "@/components/ui/Icons";
import { Preview } from "./Preview";
import { Showcase } from "./Showcase";
import { LoopVideo } from "@/components/shared/LoopVideo";

/**
 * Panel that slides in from the right and covers half the screen:
 * a note from me about the solution, how I build it, then a demo showcase.
 */
export function SolutionDrawer({
  solution,
  open,
  onClose,
  onStep,
}: {
  solution: Solution | null;
  open: boolean;
  onClose: () => void;
  onStep: (dir: 1 | -1) => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const scroller = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  // Lock page scroll, manage focus, keyboard shortcuts.
  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement;
    window.__lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    const t = window.setTimeout(() => panel.current?.querySelector<HTMLElement>(".drawer-btn.close")?.focus(), 80);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && !(e.target as HTMLElement).closest("input, textarea")) onStep(1);
      if (e.key === "ArrowLeft" && !(e.target as HTMLElement).closest("input, textarea")) onStep(-1);
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      window.__lenis?.start();
      lastFocus.current?.focus?.();
    };
  }, [open, onClose, onStep]);

  // New solution → back to top of the panel.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [solution?.slug]);

  const s = solution;
  const demo = s?.demoSlug ? getDemo(s.demoSlug) : undefined;
  const Icon = s ? solutionIcons[s.icon] : null;
  let k = 0;
  const kk = () => ({ ["--k" as string]: k++ }) as React.CSSProperties;

  if (!mounted) return null;
  // Portal to <body> so the panel sits above the fixed header, outside section stacking contexts.
  return createPortal(
    <>
      <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside
        ref={panel}
        className={`drawer ${open ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label={s ? `${s.title} — details` : "Details"}
        data-lenis-prevent
      >
        {s && (
          <>
            <div className="drawer-top">
              <span className="drawer-crumb">
                {Icon && <Icon size={14} />} {s.index} / 07 · Hired for
              </span>
              <div className="drawer-nav">
                <button type="button" className="drawer-btn" onClick={() => onStep(-1)} aria-label="Previous solution">
                  <ChevronLeft size={17} />
                </button>
                <button type="button" className="drawer-btn" onClick={() => onStep(1)} aria-label="Next solution">
                  <ChevronRight size={17} />
                </button>
                <button type="button" className="drawer-btn close" onClick={onClose} aria-label="Close panel">
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="drawer-scroll" ref={scroller} key={s.slug}>
              <div style={kk()}>
                <h2 className="drawer-title">{s.title}</h2>
                <p className="drawer-hook">{s.hook}</p>
              </div>

              <div className="drawer-hero" style={kk()}>
                <div className="rent-art" style={{ backgroundImage: `url(${s.art})` }}>
                  {s.video && open && <LoopVideo src={`/video/${s.video}.mp4`} poster={`/video/${s.video}.webp`} className="art-video" />}
                </div>
                <Preview kind={s.preview} />
              </div>

              <section className="drawer-sec" style={kk()}>
                <p className="drawer-label">A word from me</p>
                <p className="drawer-word">{s.story}</p>
                <p className="drawer-sign">— Azad</p>
              </section>

              <section className="drawer-sec drawer-cols" style={kk()}>
                <div>
                  <p className="drawer-label">What it does</p>
                  <ul className="drawer-list">
                    {s.capabilities.map((c) => (
                      <li key={c}>
                        <Check size={15} /> {c}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="drawer-label">Who it&apos;s for</p>
                  <div className="chips">
                    {s.customers.map((c) => (
                      <span className="chip" key={c}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <p className="drawer-label" style={{ marginTop: "2rem" }}>
                    Toolbox
                  </p>
                  <div className="chips">
                    {s.stack.map((c) => (
                      <span className="chip" key={c}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              <section className="drawer-sec" style={kk()}>
                <p className="drawer-label">How I build it</p>
                <ol className="drawer-steps">
                  {s.build.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ol>
              </section>

              <section className="drawer-sec" style={kk()}>
                <p className="drawer-label">In the wild</p>
                {s.media ? (
                  <div className="media-slot filled">
                    {s.media.type === "video" ? (
                      <video src={s.media.src} muted loop playsInline autoPlay aria-label={s.media.alt} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- owner-supplied media of unknown size
                      <img src={s.media.src} alt={s.media.alt} />
                    )}
                  </div>
                ) : (
                  <div className="media-slot">
                    Product screenshots / video go here
                    <br />
                    <span style={{ color: "#444" }}>set `media` in src/content/solutions.ts</span>
                  </div>
                )}
              </section>

              <section className="drawer-sec" style={kk()}>
                <p className="drawer-label">Try it</p>
                <Showcase data={s.showcase} resetKey={s.slug} />
                <div className="drawer-foot">
                  {demo && (
                    <Link href={`/demos/${demo.slug}`} className="btn-ghost" onClick={onClose}>
                      Full demo · {statusLabel[demo.status]} <ArrowUpRight size={13} />
                    </Link>
                  )}
                  <Link href="/contact" className="btn-pill" onClick={onClose}>
                    Build this with me <ArrowUpRight size={16} />
                  </Link>
                </div>
              </section>
            </div>
          </>
        )}
      </aside>
    </>,
    document.body,
  );
}
