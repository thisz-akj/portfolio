import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PORTAL_BASE } from "../nav";
import "./showcase.css";

/** /demos/ops-suite: one product, three entry points (automation, analytics, evaluation). */
const PARTS = [
  {
    key: "automation",
    label: "AI workflow automation",
    title: "Order-to-cash without the hand-offs",
    image: "/work/ops-suite-board.webp",
    alt: "Deals Kanban board with stage totals in rupees",
    points: [
      "Mark a deal won — a draft sales order appears with lines suggested from the customer's history.",
      "Confirm reserves stock; fulfil deducts it, issues the invoice and auto-reorders anything that dropped below its reorder level.",
      "Import a stock count or payment file; every row goes through the same rules, and every change lands in the audit log.",
    ],
    links: [
      { href: `${PORTAL_BASE}/deals/board`, label: "Deals board" },
      { href: `${PORTAL_BASE}/sales-orders?f=${encodeURIComponent('[["status","in",["draft"]],["deal","is_not_empty"]]')}`, label: "Drafts from won deals" },
      { href: `${PORTAL_BASE}/datasets`, label: "Data imports" },
    ],
  },
  {
    key: "analytics",
    label: "AI data analytics",
    title: "Ask the business a question",
    image: "/work/ops-suite-ask.webp",
    alt: "Ask Ops Suite answering which region's orders dropped most, with a ranked bar chart",
    points: [
      "Ask in plain English — no reports to request, no analyst in the loop.",
      "Every answer shows its working: the metric, grouping, period and filters it used, then a chart or the matching records.",
      "Forecasts and early-warning signals: customers going quiet, stock-out risk.",
    ],
    links: [
      { href: `${PORTAL_BASE}/ask`, label: "Ask Ops Suite" },
      { href: PORTAL_BASE, label: "Dashboard & signals" },
    ],
  },
  {
    key: "evaluation",
    label: "AI evaluation & monitoring",
    title: "Measured, not vibes",
    image: "/work/ops-suite-dashboard.webp",
    alt: "Ops Suite dashboard with KPI tiles and charts",
    points: [
      "Graded on 33 fixed business questions with known answers before anything changes.",
      "Live monitoring of every question: valid-plan rate, refusals, latency, tokens, cost and user feedback.",
      "Compare options on accuracy, speed and cost before switching anything over.",
    ],
    links: [{ href: `${PORTAL_BASE}/ai-quality`, label: "AI quality report" }],
  },
];

export function OpsSuiteDemo() {
  return (
    <div className="ops-show">
      <div className="ops-show-cta">
        <Link href={PORTAL_BASE} className="btn-pill">
          Open Ops Suite <ArrowUpRight size={16} />
        </Link>
        <p>
          No sign-up. Switch between Admin, Sales and Warehouse personas in the top bar — each sees different actions. Synthetic data, reset every
          night, so change anything.
        </p>
      </div>
      {PARTS.map((p, i) => (
        <section key={p.key} className="ops-show-part" aria-labelledby={`part-${p.key}`}>
          <figure>
            <Image src={p.image} alt={p.alt} width={1600} height={1000} sizes="(max-width: 767px) 100vw, 45vw" style={{ width: "100%", height: "auto" }} priority={i === 0} />
          </figure>
          <div>
            <p className="eyebrow">
              0{i + 1} · {p.label}
            </p>
            <h3 id={`part-${p.key}`}>{p.title}</h3>
            <ul>
              {p.points.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="ops-show-links">
              {p.links.map((l) => (
                <Link key={l.href} href={l.href} className="btn-ghost">
                  {l.label} <ArrowUpRight size={13} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
