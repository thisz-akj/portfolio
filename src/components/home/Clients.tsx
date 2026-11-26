"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { Client } from "@/types/content";
import { Poster } from "@/components/shared/Poster";

/** How many copies of the list sit in the track — enough to cover very wide screens seamlessly. */
const COPIES = 3;

function ClientCard({ c }: { c: Client }) {
  return (
    <div className="client-tile">
      {c.logo ? (
        <Image src={c.logo} alt={c.name} width={160} height={90} />
      ) : (
        <span className="client-word">
          <span className="client-mark">{c.mark}</span>
          {c.sub && <span className="client-sub">{c.sub}</span>}
        </span>
      )}
    </div>
  );
}

/**
 * "Some of my clients." — a single lane of client cards drifting right → left
 * in an endless loop (cards leaving on the left re-enter from the right).
 * Hovering the lane pauses it so a name can be read; edges fade into the page.
 * The hand-drawn ink note writes itself when the section enters view.
 */
export function Clients({ clients }: { clients: Client[] }) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.querySelector(".client-lane")?.classList.add("in");
        el.querySelector(".ink-wrap")?.classList.add("drawn");
        el.querySelector(".ink-note")?.classList.add("drawn");
        io.disconnect();
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Speed scales with the number of cards so it reads the same however long the list gets.
  const seconds = Math.max(18, clients.length * 7);

  return (
    <section className="clients-section" id="clients" ref={root} aria-label="Some of my clients">
      <div className="clients-head">
        <p className="eyebrow">04 · Trusted by</p>
        <div style={{ position: "relative" }} className="ink-wrap">
          <Poster lines={["Some of my", "clients."]} />
          {/* Hand-drawn ink: arrow + scribble, drawn via stroke-dashoffset */}
          <svg className="ink-note" viewBox="0 0 220 120" style={{ right: "-11rem", top: "-1.5rem", width: "13rem" }} aria-hidden="true">
            <path pathLength={1} d="M18 92 C 40 40, 120 18, 186 40" />
            <path pathLength={1} d="M172 28 L 188 41 L 170 52" />
            <path pathLength={1} d="M30 104 c 10 -6, 22 6, 32 0 s 22 6, 32 0" />
          </svg>
          <span className="ink-note-text" style={{ right: "-12rem", top: "5.5rem" }}>
            &amp; counting
          </span>
        </div>
      </div>

      {/* Readable list for assistive tech; the moving lane below is decorative duplication. */}
      <ul className="sr-only">
        {clients.map((c) => (
          <li key={c.name}>{c.name}</li>
        ))}
      </ul>

      <div className="client-lane" aria-hidden="true">
        <div className="client-track" style={{ ["--dur" as string]: `${seconds}s`, ["--copies" as string]: COPIES }}>
          {Array.from({ length: COPIES }, (_, k) => (
            <div className="client-set" key={k}>
              {clients.map((c) => (
                <ClientCard key={`${k}-${c.name}`} c={c} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
