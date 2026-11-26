"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUpRight, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Project, Solution } from "@/types/content";
import { getDemo, statusLabel } from "@/content/demos";
import { getProject } from "@/content/projects";
import { lazyShowcases } from "@/features/demos/lazyShowcase";
import { solutionIcons } from "@/components/ui/Icons";
import { Preview } from "./Preview";
import { Showcase } from "./Showcase";
import { VisionStory } from "./VisionStory";
import { AutomationStory } from "./AutomationStory";
import { LoopVideo } from "@/components/shared/LoopVideo";

/**
 * Full-screen story for a solution card: an article (problem, what it does, how industries use it, why it's
 * different, proof from case studies, screens, a note from me) followed by the same demo showcase as
 * /demos/<slug>, so a visitor can read and then try it without leaving the page.
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
  const Live = demo && demo.status !== "coming-soon" ? lazyShowcases[demo.slug] : undefined;
  const projects = (s?.projects ?? []).map(getProject).filter((p): p is Project => !!p);
  const shots = s ? [...new Set(s.shots ?? projects.flatMap((p) => p.gallery))].slice(0, 7) : [];
  const shotAlt = (src: string, i: number) => {
    const p = projects.find((x) => x.gallery.includes(src));
    return `${p?.title ?? s?.title ?? "Screenshot"} (screenshot ${i + 1})`;
  };
  const ready = !!demo && demo.status !== "coming-soon";
  const tryHref = s?.demoHref ?? (ready ? `/demos/${demo!.slug}` : projects[0] ? `/work/${projects[0].slug}` : "/contact");
  const tryLabel = s?.demoLabel ?? (ready ? `Try ${demo!.name}` : projects[0] ? "Read the case studies" : "Talk about it");
  const Icon = s ? solutionIcons[s.icon] : null;
  let k = 0;
  const kk = () => ({ ["--k" as string]: k++ }) as React.CSSProperties;
  const go = (id: string) => scroller.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const toc = [
    ["sd-problem", "The problem"],
    ["sd-does", "What it does"],
    ["sd-industry", "How it's used"],
    ["sd-usp", "Why it's different"],
    ["sd-proof", "Proof"],
    ["sd-try", "Try it"],
  ] as const;

  if (!mounted) return null;
  // Portal to <body> so the panel sits above the fixed header, outside section stacking contexts.
  return createPortal(
    <>
      <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside
        ref={panel}
        className={`drawer drawer--story ${open ? "open" : ""}`}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-hidden={!open}
        inert={!open}
        aria-label={s ? `${s.title}: the full story` : "Details"}
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
                <button type="button" className="drawer-btn close" onClick={onClose} aria-label="Close">
                  <X size={17} />
                </button>
              </div>
            </div>

            {s.layout === "chapters" ? (
              <div className="drawer-scroll vision" ref={scroller} key={s.slug}>
                <VisionStory s={s} open={open} onClose={onClose} />
              </div>
            ) : s.layout === "pitch" && s.article ? (
              <div className="drawer-scroll vision" ref={scroller} key={s.slug}>
                <AutomationStory s={s} open={open} onClose={onClose} />
              </div>
            ) : (
            <div className="drawer-scroll story" ref={scroller} key={s.slug}>
              <header className="story-head" style={kk()}>
                <h2 className="drawer-title">{s.title}</h2>
                <p className="drawer-hook">{s.hook}</p>
                {demo && <p className="story-lede">{demo.summary}</p>}
                <div className="story-cta">
                  <Link href={tryHref} className="btn-pill" onClick={onClose}>
                    {tryLabel} <ArrowUpRight size={16} />
                  </Link>
                  <button type="button" className="btn-ghost" onClick={() => go("sd-try")}>
                    {ready ? "See the demo here" : "See a walkthrough"} <ArrowDown size={13} />
                  </button>
                </div>
              </header>

              <figure className="story-hero" style={kk()}>
                {s.clip ? (
                  <LoopVideo src={s.clip} poster={s.clip.replace(/\.mp4$/, ".webp")} className="story-clip" paused={!open} />
                ) : shots[0] ? (
                  <Image src={shots[0]} alt={shotAlt(shots[0], 0)} width={1600} height={1000} sizes="(max-width: 900px) 100vw, 1100px" priority />
                ) : (
                  <div className="drawer-hero">
                    <div className="rent-art" style={{ backgroundImage: `url(${s.art})` }}>
                      {s.video && open && <LoopVideo src={`/video/${s.video}.mp4`} poster={`/video/${s.video}.webp`} className="art-video" />}
                    </div>
                    <Preview kind={s.preview} />
                  </div>
                )}
              </figure>

              <div className="story-body" style={kk()}>
                <nav className="story-toc" aria-label="On this page">
                  {toc.map(([id, label], i) => (
                    <button key={id} type="button" onClick={() => go(id)}>
                      <span>0{i + 1}</span> {label}
                    </button>
                  ))}
                </nav>

                <article className="story-article">
                  <section id="sd-problem" className="story-sec">
                    <p className="drawer-label">01 · The problem</p>
                    <p className="story-big">{s.problem}</p>
                    {demo && <p>{demo.problem}</p>}
                  </section>

                  <section id="sd-does" className="story-sec">
                    <p className="drawer-label">02 · What it does</p>
                    <ul className="drawer-list">
                      {s.capabilities.map((c) => (
                        <li key={c}>
                          <Check size={15} /> {c}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section id="sd-industry" className="story-sec">
                    <p className="drawer-label">03 · How it&apos;s used</p>
                    <div className="story-industries">
                      {s.industries.map((x) => (
                        <div key={x.name}>
                          <h3>{x.name}</h3>
                          <p>{x.use}</p>
                        </div>
                      ))}
                    </div>
                    <div className="chips" style={{ marginTop: "1.2rem" }}>
                      {(demo?.applications ?? s.customers).map((c) => (
                        <span className="chip" key={c}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section id="sd-usp" className="story-sec">
                    <p className="drawer-label">04 · Why it&apos;s different</p>
                    <ol className="story-usp">
                      {s.usp.map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ol>
                  </section>

                  <section id="sd-proof" className="story-sec">
                    <p className="drawer-label">05 · Proof</p>
                    {demo?.evaluation && <p>{demo.evaluation}</p>}
                    {projects.map((p) => (
                      <div key={p.slug} className="story-proof">
                        <Link href={`/work/${p.slug}`} onClick={onClose} className="story-proof-title">
                          {p.title} <ArrowUpRight size={13} />
                        </Link>
                        {p.results.length > 0 && (
                          <dl>
                            {p.results.slice(0, 4).map((r) => (
                              <div key={r.label}>
                                <dt>{r.value}</dt>
                                <dd>{r.label}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    ))}
                    {!demo?.evaluation && projects.length === 0 && <p>Try it below: every answer shows its topic, route and sources.</p>}
                  </section>

                  {shots.length > 1 && (
                    <section className="story-sec">
                      <p className="drawer-label">Screens</p>
                      <div className="story-gallery">
                        {shots.slice(1).map((src, i) => (
                          <Image key={src} src={src} alt={shotAlt(src, i + 1)} width={1600} height={1000} sizes="(max-width: 900px) 100vw, 540px" />
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="story-sec">
                    <p className="drawer-label">A word from me</p>
                    <p className="drawer-word">{s.story}</p>
                    <p className="drawer-sign">— Azad</p>
                  </section>
                </article>
              </div>

              <section id="sd-try" className="story-demo" style={kk()}>
                <p className="drawer-label">06 · Try it</p>
                {Live && open ? <Live /> : <Showcase data={s.showcase} resetKey={s.slug} />}
                <div className="drawer-foot">
                  <Link href={ready || !demo ? tryHref : `/demos/${demo.slug}`} className="btn-ghost" onClick={onClose}>
                    {ready ? tryLabel : demo ? `Demo · ${statusLabel[demo.status]}` : tryLabel} <ArrowUpRight size={13} />
                  </Link>
                  <Link href="/contact" className="btn-pill" onClick={onClose}>
                    Build this with me <ArrowUpRight size={16} />
                  </Link>
                </div>
              </section>
            </div>
            )}
          </>
        )}
      </aside>
    </>,
    document.body,
  );
}
