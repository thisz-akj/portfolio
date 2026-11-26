import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DOCDESK_BASE } from "../nav";
import "@/features/demos/ops-suite/showcase/showcase.css";

/** /demos/document-intelligence: one product, four jobs (ask, extract, check, compare) + its quality report. */
const PARTS = [
  {
    key: "ask",
    label: "Ask with receipts",
    title: "Every answer shows where it came from",
    image: "/work/docdesk-ask.webp",
    alt: "A contract on the left with the termination clause highlighted; the answer and its two sources on the right",
    points: [
      "Ask in plain English (or Hinglish) and get a short answer with numbered sources.",
      "Click a source and the exact words light up on the page.",
      "If the document doesn't say, DocDesk says so instead of guessing — every quoted source is checked against the page before you see it.",
    ],
    links: [
      { href: `${DOCDESK_BASE}/d/msa-kestrel-v1`, label: "Ask the services agreement" },
      { href: `${DOCDESK_BASE}/d/lease-indigo-park`, label: "Ask the office lease" },
    ],
  },
  {
    key: "extract",
    label: "Extract & check",
    title: "Fields out, mistakes caught",
    image: "/work/docdesk-checks.webp",
    alt: "An invoice with its grand total highlighted and a check explaining the total is off by ₹270",
    points: [
      "Invoices, purchase orders, contracts, leases and policies become structured fields and line items, ready as JSON or CSV.",
      "Every value is tied to its place on the page; anything unconfirmed is flagged for a person, never passed off as right.",
      "Arithmetic, GST and GSTIN checks run on every invoice — the sample one is off by ₹270.",
    ],
    links: [
      { href: `${DOCDESK_BASE}/d/invoice-kaveri-1187?tab=checks`, label: "See the invoice checks" },
      { href: `${DOCDESK_BASE}/d/lease-indigo-park?tab=fields`, label: "Lease fields" },
    ],
  },
  {
    key: "compare",
    label: "Compare",
    title: "Invoice vs order, v1 vs v2",
    image: "/work/docdesk-match.webp",
    alt: "A purchase order and its invoice side by side, with the over-billed line highlighted on both",
    points: [
      "Match an invoice to its purchase order line by line: extra quantity, changed prices and different payment terms, before you pay.",
      "Redline two versions of a contract clause by clause, with the key terms that moved in one table.",
      "A review queue collects everything a person should look at; the rest flows through.",
    ],
    links: [
      { href: `${DOCDESK_BASE}/compare?a=po-saffron-0932&b=invoice-kaveri-1187`, label: "Order ↔ invoice" },
      { href: `${DOCDESK_BASE}/compare?a=msa-kestrel-v1&b=msa-kestrel-v2`, label: "Contract redline" },
      { href: `${DOCDESK_BASE}/review`, label: "Review queue" },
    ],
  },
  {
    key: "quality",
    label: "Measured",
    title: "Graded before it ships",
    image: "/work/docdesk-quality.webp",
    alt: "DocDesk quality report with answer, citation and extraction accuracy",
    points: [
      "A fixed set of questions with known answers — including traps the documents don't answer — is re-run before every change.",
      "Answer accuracy, right-clause citations, honest “not in the document” replies, extraction accuracy and speed, all published.",
    ],
    links: [{ href: `${DOCDESK_BASE}/quality`, label: "Quality report" }],
  },
];

export function DocDeskDemo() {
  return (
    <div className="ops-show">
      <div className="ops-show-cta">
        <Link href={DOCDESK_BASE} className="btn-pill">
          Open DocDesk <ArrowUpRight size={16} />
        </Link>
        <p>
          No sign-up. Eight sample documents with fictional companies, or upload your own one-page PDF — a demo limit; DocDesk handles long, multi-page
          documents.
        </p>
      </div>
      {PARTS.map((p, i) => (
        <section key={p.key} className="ops-show-part" aria-labelledby={`dd-part-${p.key}`}>
          <figure>
            <Image src={p.image} alt={p.alt} width={1600} height={1000} sizes="(max-width: 767px) 100vw, 45vw" style={{ width: "100%", height: "auto" }} priority={i === 0} />
          </figure>
          <div>
            <p className="eyebrow">
              0{i + 1} · {p.label}
            </p>
            <h3 id={`dd-part-${p.key}`}>{p.title}</h3>
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
