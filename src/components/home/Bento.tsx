"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { Project } from "@/types/content";

const SLIDE_MS = 4000;
const SIZES = ["size-wide size-tall", "", "", "size-wide", "", ""];

function CaseCard({ project, size, reveal }: { project: Project; size: string; reveal: boolean }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const n = project.gallery.length;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !inView || n < 2) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % n), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [index, playing, inView, n]);

  const go = useCallback((d: number) => setIndex((i) => (i + d + n) % n), [n]);
  const initials = project.client
    .split(/[\s_]+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article ref={ref} className={`case-card ${size} ${reveal ? "revealing" : ""}`} aria-roledescription="carousel" aria-label={project.title}>
      <Link href={`/work/${project.slug}`} className="case-media" data-cursor="view" data-cursor-label="Open" aria-label={`Open case study: ${project.title}`}>
        {project.gallery.map((src, i) => (
          <div key={src} className={`case-slide ${i === index ? "active" : ""}`} aria-hidden={i !== index}>
            <Image src={src} alt={i === index ? `${project.title}, image ${i + 1} of ${n}` : ""} fill sizes="(max-width: 767px) 100vw, 50vw" />
          </div>
        ))}
        <div className="case-tags">
          {project.tags.slice(0, 2).map((t) => (
            <span key={t} className="case-tag">
              {t}
            </span>
          ))}
        </div>
        {n > 1 && (
          <div className="case-progress" aria-hidden="true">
            {project.gallery.map((_, i) => (
              <span
                key={`${i}-${i === index ? index : "x"}`}
                className={i < index ? "done" : i === index && playing && inView ? "active" : i === index ? "done" : ""}
                style={{ ["--dur" as string]: `${SLIDE_MS}ms` }}
              />
            ))}
          </div>
        )}
      </Link>
      <div className="case-meta">
        <span className="case-logo" aria-hidden="true">
          {initials}
        </span>
        <span className="case-credit">
          <span className="case-title">
            <strong>{project.title}</strong>
          </span>
          for <span>{project.client}</span>
        </span>
        {n > 1 && (
          <>
            <button className="case-control" onClick={() => go(-1)} aria-label="Previous image">
              <ChevronLeft size={18} />
            </button>
            <button className="case-control" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause slideshow" : "Play slideshow"}>
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button className="case-control" onClick={() => go(1)} aria-label="Next image">
              <ChevronRight size={18} />
            </button>
          </>
        )}
        <span className="sr-only" aria-live="polite">
          Image {index + 1} of {n}
        </span>
      </div>
    </article>
  );
}

/** Bento grid of case cards; "See more" expands the rest with a clip-path reveal. */
export function Bento({ projects, initial = 3 }: { projects: Project[]; initial?: number }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? projects : projects.slice(0, initial);
  const hasMore = projects.length > initial;

  return (
    <>
      <div className={`bento-grid ${expanded ? "expanded" : ""}`}>
        {visible.map((p, i) => (
          <CaseCard key={p.slug} project={p} size={SIZES[i % SIZES.length]} reveal={expanded && i >= initial} />
        ))}
      </div>
      <div className="bento-more">
        {hasMore && !expanded ? (
          <button type="button" className="btn-pill" aria-expanded={expanded} onClick={() => setExpanded(true)}>
            See more
          </button>
        ) : (
          <Link href="/work" className="btn-pill">
            All case studies <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
    </>
  );
}
