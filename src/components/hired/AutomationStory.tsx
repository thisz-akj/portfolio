"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  FileText,
  IndianRupee,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Phone,
  Plus,
  Sheet,
  ShieldCheck,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ConnectorIcon, Solution } from "@/types/content";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/motion";
import { LoopVideo } from "@/components/shared/LoopVideo";
import { Preview } from "./Preview";

const pad = (n: number) => String(n).padStart(2, "0");

const icons: Record<ConnectorIcon, LucideIcon> = {
  phone: Phone,
  whatsapp: MessageCircle,
  mail: Mail,
  calendar: CalendarDays,
  map: MapPin,
  auth: ShieldCheck,
  crm: Users,
  money: IndianRupee,
  docs: FileText,
  sheet: Sheet,
  team: MessagesSquare,
  shop: ShoppingBag,
};

const SECTIONS = [
  ["as-cost", "Where the hours go"],
  ["as-connect", "What it connects to"],
  ["as-journey", "One enquiry, end to end"],
  ["as-services", "What I can do for you"],
  ["as-better", "What gets better"],
  ["as-why", "Why work with me"],
  ["as-industries", "Industries"],
  ["as-process", "How we work"],
  ["as-faq", "Questions"],
] as const;

/**
 * AI workflow automation as the main client pitch: one long, calm article (layout "pitch") from `s.article`:
 * the cost of manual work, every tool family it connects to, one end-to-end story, before/after, why me,
 * industries, services, process and FAQ. Same reveal language as VisionStory, on the drawer's scroller.
 */
export function AutomationStory({ s, open, onClose }: { s: Solution; open: boolean; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [reduced] = useState(() => prefersReducedMotion());
  const a = s.article!;

  useLayoutEffect(() => {
    const el = root.current;
    if (!open || !el) return;
    const scroller = el.closest<HTMLElement>(".drawer-scroll") ?? undefined;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".as-sec").forEach((sec, i) =>
        ScrollTrigger.create({ trigger: sec, scroller, start: "top 45%", end: "bottom 45%", onToggle: (self) => self.isActive && setActive(i) }),
      );
      if (reduced) return;
      gsap.fromTo(".as-intro-in", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, stagger: 0.1, ease: "expo.out", delay: 0.45 });
      gsap.utils.toArray<HTMLElement>(".as-sec").forEach((sec) => {
        gsap.fromTo(sec.querySelectorAll(".as-sec-head > *"), { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, stagger: 0.08, ease: "expo.out", scrollTrigger: { trigger: sec, scroller, start: "top 82%" } });
        const items = sec.querySelectorAll<HTMLElement>(".as-reveal");
        items.forEach((e, k) =>
          gsap.fromTo(e, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, delay: (k % 3) * 0.06, ease: "power3.out", scrollTrigger: { trigger: e, scroller, start: "top 92%" } }),
        );
      });
      const hero = el.querySelector(".as-hero");
      if (hero)
        gsap.fromTo(hero, { clipPath: "inset(8% 6% 8% 6% round 24px)", scale: 1.03 }, { clipPath: "inset(0% 0% 0% 0% round 16px)", scale: 1, duration: 1.4, delay: 0.6, ease: "expo.out" });
    }, el);
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 900); // after the drawer has slid in
    return () => {
      window.clearTimeout(t);
      ctx.revert();
    };
  }, [open, reduced]);

  const go = (id: string) => root.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const head = (i: number, title: string, lead?: string) => (
    <header className="as-sec-head">
      <p className="vs-kicker">
        {pad(i + 1)} · {SECTIONS[i][1]}
      </p>
      <h3 className="as-h">{title}</h3>
      {lead && <p className="as-lead">{lead}</p>}
    </header>
  );

  return (
    <div className="vs as" ref={root}>
      <section className="vs-intro">
        <div className="vs-grid" aria-hidden="true" />
        <p className="vs-kicker as-intro-in">{a.kicker}</p>
        <h2 className="vs-title as-intro-in">{s.title}</h2>
        <p className="vs-hook as-intro-in">{s.hook}</p>
        {a.lede.map((p, i) => (
          <p className={`vs-lede as-intro-in${i === 0 ? " as-lede-first" : ""}`} key={i}>
            {p}
          </p>
        ))}
        <div className="story-cta as-intro-in">
          <Link href="/contact" className="btn-pill" onClick={onClose}>
            Automate a workflow with me <ArrowUpRight size={16} />
          </Link>
          {s.demoHref && (
            <Link href={s.demoHref} className="btn-ghost" onClick={onClose}>
              {s.demoLabel ?? "See it live"} <ArrowUpRight size={13} />
            </Link>
          )}
        </div>
        <figure className="as-hero">
          <div className="drawer-hero">
            <div className="rent-art" style={{ backgroundImage: `url(${s.art})` }}>
              {s.video && open && <LoopVideo src={`/video/${s.video}.mp4`} poster={`/video/${s.video}.webp`} className="art-video" />}
            </div>
            <Preview kind={s.preview} />
          </div>
        </figure>
      </section>

      <div className="vs-body">
        <nav className="vs-toc" aria-label="On this page">
          <p className="vs-kicker">On this page</p>
          {SECTIONS.map(([id, label], i) => (
            <button key={id} type="button" className={active === i ? "on" : ""} onClick={() => go(id)}>
              <span>{pad(i + 1)}</span> {label}
            </button>
          ))}
        </nav>

        <div className="as-main">
          <section className="as-sec" id="as-cost">
            {head(0, "Manual work is quietly expensive.")}
            <div className="as-cost">
              {a.cost.map((c) => (
                <div className="as-card as-reveal" key={c.title}>
                  <h4>{c.title}</h4>
                  <p>{c.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="as-sec" id="as-connect">
            {head(
              1,
              "AI connected to everything your business runs on.",
              "The value isn't the AI on its own, it's what it can reach.",
            )}
            <div className="as-connect">
              {a.connections.map((c) => {
                const I = icons[c.icon];
                return (
                  <div className="as-conn as-reveal" key={c.name}>
                    <div className="as-conn-top">
                      <span className="as-conn-icon">
                        <I size={18} />
                      </span>
                      <div>
                        <h4>{c.name}</h4>
                        <p className="as-conn-ex">{c.examples}</p>
                      </div>
                    </div>
                    <ul>
                      {c.does.map((d) => (
                        <li key={d}>
                          <Check size={14} /> {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="as-note as-reveal">Using something else? If your team works in it, it can almost always be connected.</p>
          </section>

          <section className="as-sec" id="as-journey">
            {head(2, a.journey.title, a.journey.intro)}
            <ol className="as-journey">
              {a.journey.steps.map((st, i) => (
                <li className="as-reveal" key={i}>
                  <span className="as-time">{st.time}</span>
                  <span className="as-via">{st.via}</span>
                  <p>{st.text}</p>
                </li>
              ))}
            </ol>
            <p className="as-outcome as-reveal">{a.journey.outcome}</p>
          </section>

          <section className="as-sec" id="as-services">
            {head(3, "What I can do for you.", "Start with one workflow or hand me the whole map.")}
            <div className="as-services">
              {a.services.map((sv, i) => (
                <div className="as-svc as-reveal" key={sv.name}>
                  <span className="as-why-n">{pad(i + 1)}</span>
                  <h4>{sv.name}</h4>
                  <p>{sv.text}</p>
                  <ul>
                    {sv.get.map((g) => (
                      <li key={g}>
                        <Check size={13} /> {g}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="as-sec" id="as-better">
            {head(4, "How it makes the business better.")}
            <div className="as-table" role="table" aria-label="Before and after automation">
              <div className="as-row as-row-head" role="row">
                <span role="columnheader" />
                <span role="columnheader">Before</span>
                <span role="columnheader">After</span>
              </div>
              {a.better.map((b) => (
                <div className="as-row as-reveal" role="row" key={b.area}>
                  <span role="rowheader">{b.area}</span>
                  <span role="cell" className="as-before">
                    {b.before}
                  </span>
                  <span role="cell" className="as-after">
                    {b.after}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="as-sec" id="as-why">
            {head(5, "Automation your team will actually trust.")}
            <div className="as-why">
              {a.usp.map((u, i) => (
                <div className="as-why-item as-reveal" key={u.title}>
                  <span className="as-why-n">{pad(i + 1)}</span>
                  <h4>{u.title}</h4>
                  <p>{u.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="as-sec" id="as-industries">
            {head(6, "Where it pays off.")}
            <div className="as-ind">
              {a.industries.map((x) => (
                <div className="as-card as-reveal" key={x.name}>
                  <h4>{x.name}</h4>
                  <ul>
                    {x.examples.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="as-sec" id="as-process">
            {head(7, "From first call to running on its own.")}
            <ol className="as-process">
              {a.process.map((p, i) => (
                <li className="as-reveal" key={p.step}>
                  <span className="as-step-n">{pad(i + 1)}</span>
                  <div>
                    <h4>{p.step}</h4>
                    <p>{p.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="as-sec" id="as-faq">
            {head(8, "Questions clients ask.")}
            <div className="as-faq">
              {a.faq.map((f) => (
                <details className="as-reveal" key={f.q}>
                  <summary>
                    {f.q} <Plus size={16} />
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="vs-help as-close">
        <p className="vs-kicker">Let&apos;s start</p>
        <h3 className="as-close-title">{a.close.title}</h3>
        <p className="as-close-text">{a.close.text}</p>
        <div className="vs-cta story-cta">
          <Link href="/contact" className="btn-pill" onClick={onClose}>
            Talk about your workflow <ArrowUpRight size={16} />
          </Link>
        </div>
        <p className="drawer-sign">— Azad</p>
      </section>
    </div>
  );
}
