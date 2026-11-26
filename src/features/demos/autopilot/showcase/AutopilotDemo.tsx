import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import "@/features/demos/ops-suite/showcase/showcase.css";

const APP = "/demos/autopilot/app";

/** /demos/autopilot: four small businesses on autopilot. Screenshots + links straight into each scenario. */
const PARTS = [
  {
    key: "lead",
    label: "Enquiry to paid order",
    title: "A WhatsApp enquiry becomes a delivered order",
    image: "/work/autopilot-lead.webp",
    alt: "A packaging enquiry on WhatsApp turned into a quote, an approval, a payment, a GST invoice and a booked dispatch",
    points: [
      "Reads the enquiry, finds the customer in the CRM, checks stock and drafts the quote from the rate card.",
      "Big or discounted quotes wait for one tap from the sales manager. Everything else goes out in a minute.",
      "Paid? The GST invoice, the sales register, the dispatch slot and the warehouse note follow on their own. No reply? It follows up, then sets a call.",
    ],
    links: [{ href: `${APP}?s=lead-to-cash`, label: "Send an enquiry" }],
  },
  {
    key: "clinic",
    label: "No-show recovery",
    title: "Cancelled slots refill themselves",
    image: "/work/autopilot-clinic.webp",
    alt: "A clinic reminder, a cancellation, and the slot offered down the waitlist until someone takes it",
    points: [
      "Reminders go out the evening before. Confirm, cancel, or ask for Thursday in your own words.",
      "A freed slot goes down the waitlist until someone takes it, and the patient who cancelled is rebooked in the same chat.",
      "No reply gets a call in the morning, the front desk is warned, and low ratings reach the manager the same day.",
    ],
    links: [{ href: `${APP}?s=no-show`, label: "Reply to a reminder" }],
  },
  {
    key: "invoice",
    label: "Supplier invoice to payment",
    title: "Catch the wrong invoice before it's paid",
    image: "/work/autopilot-invoice.webp",
    alt: "An emailed supplier invoice checked against the order and goods receipt, with an over-billed quantity flagged",
    points: [
      "The emailed PDF is read and checked against the order and what actually arrived at the warehouse.",
      "Duplicates are stopped. Over-billing goes to the accounts manager with the numbers, and the supplier gets the credit-note request.",
      "Clean invoices are booked and paid early for the discount, with remittance advice sent back.",
    ],
    links: [{ href: `${APP}?s=invoice`, label: "Send an invoice" }],
  },
  {
    key: "service",
    label: "Service request to closed job",
    title: "From “AC not cooling” to a paid, rated job",
    image: "/work/autopilot-service.webp",
    alt: "An AC repair request matched to the nearest free technician by travel time, then closed with an OTP and paid",
    points: [
      "The request becomes a ticket and the nearest free technician is booked by travel time, not by guesswork.",
      "The customer gets the time, a live location link and a job OTP. The job closes only when they share it.",
      "Payment, the service register, the next service date and the feedback request follow. Not fixed? A free revisit with a senior technician.",
    ],
    links: [{ href: `${APP}?s=service-job`, label: "Report a broken AC" }],
  },
];

export function AutopilotDemo() {
  return (
    <div className="ops-show">
      <div className="ops-show-cta">
        <Link href={APP} className="btn-pill">
          Open Autopilot <ArrowUpRight size={16} />
        </Link>
        <p>
          No sign-up. You play the customer or the supplier; tap a reply or type your own. Every path ends with a report of what ran by itself. The businesses are
          fictional and nothing is really sent.
        </p>
      </div>
      {PARTS.map((p, i) => (
        <section key={p.key} className="ops-show-part" aria-labelledby={`ap-part-${p.key}`}>
          <figure>
            <Image src={p.image} alt={p.alt} width={1600} height={1000} sizes="(max-width: 767px) 100vw, 45vw" style={{ width: "100%", height: "auto" }} priority={i === 0} />
          </figure>
          <div>
            <p className="eyebrow">
              0{i + 1} · {p.label}
            </p>
            <h3 id={`ap-part-${p.key}`}>{p.title}</h3>
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
