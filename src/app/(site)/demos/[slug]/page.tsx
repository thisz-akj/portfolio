import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, FlaskConical } from "lucide-react";
import { demos, getDemo, statusLabel } from "@/content/demos";
import { getSolution } from "@/content/solutions";
import { demoComponents } from "@/features/demos/registry";

export function generateStaticParams() {
  return demos.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = getDemo(slug);
  return d ? { title: `${d.name} — Demo`, description: d.summary } : {};
}

/** Consistent 7-part structure for every demo page (see docs/development/adding-a-demo.md). */
export default async function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const demo = getDemo(slug);
  if (!demo) notFound();
  const solution = getSolution(demo.solutionSlug);
  const Interactive = demoComponents[demo.slug];

  return (
    <article className="inner">
      <Link href="/demos" className="breadcrumb">
        <ArrowLeft size={12} /> All demos
      </Link>
      <div className="inner-head">
        <p className="eyebrow">{solution?.title}</p>
        <h1 className="inner-title">{demo.name}</h1>
        <p className="lede">{demo.summary}</p>
        <div style={{ marginTop: "1.5rem" }}>
          <span className={`status ${demo.status}`}>{statusLabel[demo.status]}</span>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          {/* 2. Interactive demo — kept prominent */}
          <div className="detail-block" style={{ borderTop: 0, paddingTop: 0 }}>
            {Interactive && demo.status !== "coming-soon" ? (
              <Interactive />
            ) : (
              <div className="demo-stage">
                <div>
                  <FlaskConical size={32} strokeWidth={1.2} aria-hidden="true" />
                  <h3>In the lab.</h3>
                  <p>
                    This demo isn&apos;t live yet. When it is, you&apos;ll be able to: {demo.tryIt.join(", ").toLowerCase()}.
                  </p>
                  <Link href="/contact" className="btn-pill">
                    Want this for your product? <ArrowUpRight size={16} />
                  </Link>
                </div>
              </div>
            )}
          </div>

          <section className="detail-block">
            <h2><span>01</span>Overview &amp; problem</h2>
            <p>{demo.problem}</p>
            {solution && <p style={{ marginTop: "1rem" }}>{solution.problem}</p>}
          </section>
          <section className="detail-block">
            <h2><span>03</span>Example input</h2>
            <p>{demo.sampleInput}</p>
          </section>
          <section className="detail-block">
            <h2><span>04</span>What you can try</h2>
            <ul>{demo.tryIt.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>
          <section className="detail-block">
            <h2><span>05</span>Evaluation</h2>
            <p>{demo.evaluation ?? "Not measured yet. Results will be published here once the demo is evaluated on a fixed dataset."}</p>
          </section>
          <section className="detail-block">
            <h2><span>06</span>Limitations &amp; applications</h2>
            <ul>{demo.limitations.map((t) => <li key={t}>{t}</li>)}</ul>
            <div className="chips" style={{ marginTop: "1.5rem" }}>
              {demo.applications.map((a) => <span className="chip" key={a}>{a}</span>)}
            </div>
          </section>
        </div>

        <aside className="detail-aside">
          <p className="disclaimer">
            AI outputs can be wrong. Demos use sample or synthetic data; uploads, when enabled, are size-limited and not
            retained longer than needed.
          </p>
          <div>
            <p className="aside-label">07 · Next step</p>
            <Link href="/contact" className="btn-pill" style={{ minWidth: 0, width: "100%" }}>
              Build this with me <ArrowUpRight size={16} />
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
