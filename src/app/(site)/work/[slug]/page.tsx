import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getProject, projects } from "@/content/projects";
import { Reveal } from "@/components/shared/Reveal";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getProject(slug);
  return p ? { title: p.title, description: p.summary } : {};
}

export default async function CaseStudy({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) notFound();
  const i = projects.findIndex((x) => x.slug === slug);
  const next = projects[(i + 1) % projects.length];

  return (
    <article className="inner">
      <Link href="/work" className="breadcrumb">
        <ArrowLeft size={12} /> All work
      </Link>
      <div className="inner-head" style={{ maxWidth: 1100 }}>
        <p className="eyebrow">
          {p.client} · {p.year}
        </p>
        <h1 className="inner-title" style={{ fontSize: "clamp(2.6rem, 6vw, 5.5rem)" }}>
          {p.title}
        </h1>
        <p className="lede">{p.summary}</p>
        <div className="chips" style={{ marginTop: "1.5rem" }}>
          {p.tags.map((t) => (
            <span className="chip" key={t}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <Reveal className="gallery">
        {p.gallery.map((src, gi) => (
          <figure key={src}>
            <Image src={src} alt={`${p.title} — figure ${gi + 1}`} width={1600} height={1000} sizes="(max-width: 767px) 100vw, 70vw" style={{ width: "100%", height: "auto" }} priority={gi === 0} />
          </figure>
        ))}
      </Reveal>

      <div className="detail-grid" style={{ marginTop: "4rem" }}>
        <div>
          <section className="detail-block">
            <h2><span>01</span>Problem</h2>
            <p>{p.problem}</p>
          </section>
          <section className="detail-block">
            <h2><span>02</span>My contribution</h2>
            <p>{p.contribution}</p>
          </section>
          <section className="detail-block">
            <h2><span>03</span>Approach &amp; implementation</h2>
            <ul>{p.approach.map((a) => <li key={a}>{a}</li>)}</ul>
          </section>
          <section className="detail-block">
            <h2><span>04</span>Results</h2>
            <div className="metrics">
              {p.results.map((r) => (
                <div className="metric" key={r.label}>
                  <div className="metric-value">{r.value}</div>
                  <div className="metric-label">{r.label}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="detail-block">
            <h2><span>05</span>Lessons learned</h2>
            <ul>{p.lessons.map((l) => <li key={l}>{l}</li>)}</ul>
          </section>
        </div>
        <aside className="detail-aside">
          <div>
            <p className="aside-label">Stack</p>
            <div className="chips">{p.stack.map((s) => <span className="chip" key={s}>{s}</span>)}</div>
          </div>
          <div>
            <p className="aside-label">Next project</p>
            <Link href={`/work/${next.slug}`} className="btn-ghost" style={{ width: "100%", justifyContent: "space-between" }}>
              {next.title.slice(0, 34)}
              {next.title.length > 34 ? "…" : ""} <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link href="/contact" className="btn-pill" style={{ minWidth: 0 }}>
            Need something like this? <ArrowUpRight size={16} />
          </Link>
        </aside>
      </div>
    </article>
  );
}
