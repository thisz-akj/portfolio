import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { demos, statusLabel } from "@/content/demos";
import { getSolution } from "@/content/solutions";
import { solutionIcons } from "@/components/ui/Icons";
import { Reveal } from "@/components/shared/Reveal";
import "@/features/demos/ops-suite/showcase/showcase.css";

export const metadata: Metadata = {
  title: "Demos",
  description: "Interactive AI demos with honest status labels: Live, Limited Preview or Coming Soon.",
};

export default function DemosPage() {
  const liveCount = demos.filter((d) => d.status === "live").length;
  return (
    <section className="inner">
      <div className="inner-head">
        <p className="eyebrow">Demos</p>
        <h1 className="inner-title">Try it, don&apos;t trust it.</h1>
        <p className="lede">
          Working examples beat screenshots. A demo is marked <strong style={{ color: "var(--live)" }}>Live</strong>{" "}
          only when it runs real models end to end.{" "}
          {liveCount === 0 && "Ops Suite (a working CRM, ERP and data portal) and DocDesk (document Q&A, extraction and checks) are open in limited preview."}
        </p>
      </div>
      <div className="card-grid">
        {demos.map((d, i) => {
          const sol = getSolution(d.solutionSlug);
          const Icon = sol ? solutionIcons[sol.icon] : null;
          return (
            <Reveal key={d.slug} delay={(i % 3) * 0.08} className={`card${d.flagship ? " card-flagship" : ""}`} as="article">
              <Link href={`/demos/${d.slug}`} style={{ position: "absolute", inset: 0 }} aria-label={`${d.name} — ${statusLabel[d.status]}`} data-cursor="view" />
              <div className="card-text">
                <div className="card-top">
                  <span className={`status ${d.status}`}>{statusLabel[d.status]}</span>
                  {Icon && <Icon size={20} strokeWidth={1.3} aria-hidden="true" />}
                </div>
                <h2 className="card-title">{d.name}</h2>
                <p className="card-hook">{sol?.title}</p>
                <p className="card-body">{d.summary}</p>
                <ul className="card-list">
                  {d.tryIt.slice(0, 3).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                {d.parts && (
                  <div className="card-parts">
                    {d.parts.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="card-foot">
                  <span className="chip">{d.problem.split(".")[0]}</span>
                  <ArrowUpRight className="card-arrow" size={18} aria-hidden="true" />
                </div>
              </div>
              {d.flagship && d.shot && (
                <div className="card-shot">
                  <Image src={d.shot.src} alt={d.shot.alt} width={1600} height={1000} sizes="(max-width: 767px) 100vw, 55vw" style={{ width: "100%", height: "auto" }} />
                </div>
              )}
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
