import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { demos, statusLabel } from "@/content/demos";
import { getSolution } from "@/content/solutions";
import { solutionIcons } from "@/components/ui/Icons";
import { Reveal } from "@/components/shared/Reveal";

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
          only when it runs real models end to end. {liveCount === 0 && "The first flagship demo — Document Intelligence — is in development."}
        </p>
      </div>
      <div className="card-grid">
        {demos.map((d, i) => {
          const sol = getSolution(d.solutionSlug);
          const Icon = sol ? solutionIcons[sol.icon] : null;
          return (
            <Reveal key={d.slug} delay={(i % 3) * 0.08} className="card" as="article">
              <Link href={`/demos/${d.slug}`} style={{ position: "absolute", inset: 0 }} aria-label={`${d.name} — ${statusLabel[d.status]}`} data-cursor="view" />
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
              <div className="card-foot">
                <span className="chip">{d.problem.split(".")[0]}</span>
                <ArrowUpRight className="card-arrow" size={18} aria-hidden="true" />
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
