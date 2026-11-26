"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Project, Solution } from "@/types/content";
import { getProject } from "@/content/projects";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/motion";
import { LoopVideo } from "@/components/shared/LoopVideo";
import { GitHubIcon } from "@/components/ui/Icons";

const pad = (n: number) => String(n).padStart(2, "0");

function split(title: string) {
  const i = title.indexOf(":");
  return i > 0 ? { name: title.slice(0, i), sub: title.slice(i + 1).trim() } : { name: title, sub: "" };
}

function Media({ p, playing }: { p: Project; playing: boolean }) {
  if (p.clip) return <LoopVideo src={p.clip} poster={p.clip.replace(/\.mp4$/, ".webp")} className="vs-video" paused={!playing} />;
  return <Image src={p.cover} alt={p.title} width={1600} height={1000} sizes="(max-width: 900px) 100vw, 900px" />;
}

/**
 * Computer vision & robotics as one scrollable page: an intro, then every project as its own short article
 * (the project, key figures, why it stands out, where it's used), then how it helps each industry.
 * Calm GSAP reveals on the drawer's own scroller; a sticky contents list marks which project you're reading.
 * No demo / try / proof sections (owner).
 */
export function VisionStory({ s, open, onClose }: { s: Solution; open: boolean; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const chapters = useMemo(() => (s.projects ?? []).map(getProject).filter((p): p is Project => !!p), [s.projects]);
  const [active, setActive] = useState(0);
  const [reduced] = useState(() => prefersReducedMotion());
  const n = chapters.length;
  const fields = s.capabilities.map((c) => {
    const i = c.indexOf(":");
    return i > 0 ? { name: c.slice(0, i), text: c.slice(i + 1).trim() } : { name: "", text: c };
  });

  useLayoutEffect(() => {
    const el = root.current;
    if (!open || !el) return;
    const scroller = el.closest<HTMLElement>(".drawer-scroll") ?? undefined;
    const ctx = gsap.context(() => {
      // which project is on screen → contents list
      gsap.utils.toArray<HTMLElement>(".vs-article").forEach((a, i) =>
        ScrollTrigger.create({ trigger: a, scroller, start: "top 55%", end: "bottom 55%", onToggle: (self) => self.isActive && setActive(i) }),
      );
      if (reduced) return;
      gsap.fromTo(".vs-intro-in", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, stagger: 0.1, ease: "expo.out", delay: 0.45 });
      const reveal = (sel: string, from: gsap.TweenVars, start = "top 88%") =>
        gsap.utils.toArray<HTMLElement>(sel).forEach((e) =>
          gsap.fromTo(e, from, { y: 0, x: 0, opacity: 1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: e, scroller, start } }),
        );
      reveal(".vs-field", { y: 30, opacity: 0 });
      gsap.utils.toArray<HTMLElement>(".vs-article").forEach((a) => {
        const head = a.querySelectorAll(".vs-head > *");
        gsap.fromTo(head, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, stagger: 0.08, ease: "expo.out", scrollTrigger: { trigger: a, scroller, start: "top 80%" } });
        const num = a.querySelector(".vs-num");
        if (num) gsap.fromTo(num, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: a, scroller, start: "top 80%" } });
        const media = a.querySelector(".vs-media");
        if (media)
          gsap.fromTo(
            media,
            { clipPath: "inset(10% 8% 10% 8% round 24px)", scale: 1.04 },
            { clipPath: "inset(0% 0% 0% 0% round 10px)", scale: 1, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: media, scroller, start: "top 85%" } },
          );
      });
      reveal(".vs-block", { y: 30, opacity: 0 }, "top 90%");
      reveal(".vs-help-row", { x: -24, opacity: 0 }, "top 92%");
    }, el);
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 900); // after the drawer has slid in
    return () => {
      window.clearTimeout(t);
      ctx.revert();
    };
  }, [open, reduced, n]);

  const go = (i: number) => root.current?.querySelector(`#vs-p${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="vs" ref={root}>
      <section className="vs-intro">
        <div className="vs-grid" aria-hidden="true" />
        <p className="vs-kicker vs-intro-in">Computer vision · Geometric vision · Robotics</p>
        <h2 className="vs-title vs-intro-in">{s.title}</h2>
        <p className="vs-hook vs-intro-in">{s.hook}</p>
        <p className="vs-lede vs-intro-in">{s.story}</p>
        <div className="vs-fields">
          {fields.map((f, i) => (
            <div className="vs-field" key={f.name || i}>
              <span className="vs-field-n">{pad(i + 1)}</span>
              {f.name && <h3>{f.name}</h3>}
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="vs-body">
        <nav className="vs-toc" aria-label="Projects on this page">
          <p className="vs-kicker">The work</p>
          {chapters.map((p, i) => (
            <button key={p.slug} type="button" className={active === i ? "on" : ""} onClick={() => go(i)}>
              <span>{pad(i + 1)}</span> {p.title.split(/[:,]/)[0]}
            </button>
          ))}
        </nav>

        <div className="vs-articles">
          {chapters.map((p, i) => {
            const t = split(p.title);
            const extra = p.gallery.filter((g) => g !== p.cover && !g.includes("-2.webp")).slice(0, 3);
            return (
              <article className="vs-article" id={`vs-p${i}`} key={p.slug}>
                <span className="vs-num" aria-hidden="true">
                  {pad(i + 1)}
                </span>
                <header className="vs-head">
                  <p className="vs-tags">
                    Project {pad(i + 1)} / {pad(n)} · {p.tags.join(" · ")}
                  </p>
                  <h3 className="vs-name">{t.name}</h3>
                  {t.sub && <p className="vs-sub">{t.sub}</p>}
                  <p className="vs-sum">{p.summary}</p>
                  {p.repo && (
                    <a className="vs-repo" href={p.repo} target="_blank" rel="noreferrer">
                      <GitHubIcon size={15} /> View code on GitHub <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  )}
                </header>

                <figure className="vs-media">
                  <Media p={p} playing={open && Math.abs(active - i) <= 1} />
                </figure>

                <section className="vs-block">
                  <p className="drawer-label">The project</p>
                  <p>{p.problem}</p>
                  <p>{p.contribution}</p>
                </section>

                {p.results.length > 0 && (
                  <dl className="vs-figures vs-block">
                    {p.results.slice(0, 4).map((r) => (
                      <div key={r.label}>
                        <dt>{r.value}</dt>
                        <dd>{r.label}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {p.usp && (
                  <section className="vs-block">
                    <p className="drawer-label">Why it stands out</p>
                    <ol className="story-usp">
                      {p.usp.map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ol>
                  </section>
                )}

                {p.industries && (
                  <section className="vs-block">
                    <p className="drawer-label">Where it&apos;s used</p>
                    <div className="story-industries">
                      {p.industries.map((x) => (
                        <div key={x.name}>
                          <h3>{x.name}</h3>
                          <p>{x.use}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {extra.length > 0 && (
                  <div className="vs-more vs-block">
                    {extra.map((src, k) => (
                      <Image key={src} src={src} alt={`${t.name}, image ${k + 2}`} width={1600} height={1000} sizes="(max-width: 900px) 100vw, 300px" />
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <section className="vs-help">
        <p className="vs-kicker">How I can help</p>
        {s.industries.map((x, i) => (
          <div className="vs-help-row" key={x.name}>
            <span className="vs-field-n">{pad(i + 1)}</span>
            <h3>{x.name}</h3>
            <p>{x.use}</p>
          </div>
        ))}
        <div className="vs-cta">
          <Link href="/contact" className="btn-pill" onClick={onClose}>
            Build this with me <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
