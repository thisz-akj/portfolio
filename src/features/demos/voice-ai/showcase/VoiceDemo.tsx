import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import "@/features/demos/ops-suite/showcase/showcase.css";

const APP = "/demos/voice-ai/app";

/** /demos/voice-ai: one voice front end, two lines (clinic front desk, ask about Azad) + how it's measured. */
const PARTS = [
  {
    key: "book",
    label: "Books for real",
    title: "Only times that are actually free",
    image: "/work/voice-booking.webp",
    alt: "A finished clinic call: transcript, the booked slot, what the agent did, and the note left for staff",
    points: [
      "Say it all in one breath (doctor, day, name) and it books in two turns, reading the details back.",
      "It offers at most two times, straight from the calendar. Ask for a day the doctor is off and it says so, then offers the nearest real slots.",
      "Staff get a one-line note: who, when, why, and whether anything needs a call-back.",
    ],
    links: [{ href: APP, label: "Call the clinic" }],
  },
  {
    key: "change",
    label: "Changes & questions",
    title: "People change their mind. So does the booking.",
    image: "/work/voice-change.webp",
    alt: "A caller moving a booking to Thursday; the agent releases the first slot and books the new one",
    points: [
      "“Actually, can we make it Thursday?” releases the first slot and books the new one in the same call.",
      "Parking, fees, opening hours or what to bring are answered mid-booking, then it picks up where it left off.",
      "Tap an offered slot instead of saying it. Talk over the agent and it stops to listen.",
    ],
    links: [{ href: APP, label: "Try changing a booking" }],
  },
  {
    key: "handover",
    label: "Knows when to stop",
    title: "Urgent calls go to people, fast",
    image: "/work/voice-urgent.webp",
    alt: "An urgent call: the agent tells the caller to ring 112 or 108 and flags the call for the doctor on duty",
    points: [
      "Chest pain or breathing trouble: it stops booking, tells the caller to ring 112 or 108, and flags the call as urgent.",
      "Asks for a person, wants to cancel an existing appointment, or keeps not being understood: it takes the details and arranges a call-back.",
    ],
    links: [{ href: APP, label: "Play the sample calls" }],
  },
  {
    key: "about",
    label: "Ask about Azad",
    title: "The portfolio, out loud",
    image: "/work/voice-about.webp",
    alt: "The Ask about Azad line answering a spoken question about Azad's work",
    points: [
      "A second line on the same voice front end: ask about projects, services or how to work together.",
      "Short spoken answers that start as soon as the first sentence is ready, from the same knowledge as the site's chat.",
    ],
    links: [{ href: `${APP}?line=about`, label: "Ask about Azad" }],
  },
];

export function VoiceDemo() {
  return (
    <div className="ops-show">
      <div className="ops-show-cta">
        <Link href={APP} className="btn-pill">
          Open Front Desk Voice <ArrowUpRight size={16} />
        </Link>
        <p>
          No sign-up. Talk with your microphone or type, three live calls a day. The six sample calls play any time, no microphone needed. The clinic, its
          doctors and its calendar are fictional.
        </p>
      </div>
      {PARTS.map((p, i) => (
        <section key={p.key} className="ops-show-part" aria-labelledby={`vx-part-${p.key}`}>
          <figure>
            <Image src={p.image} alt={p.alt} width={1600} height={1000} sizes="(max-width: 767px) 100vw, 45vw" style={{ width: "100%", height: "auto" }} priority={i === 0} />
          </figure>
          <div>
            <p className="eyebrow">
              0{i + 1} · {p.label}
            </p>
            <h3 id={`vx-part-${p.key}`}>{p.title}</h3>
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
