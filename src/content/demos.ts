import type { Demo, DemoStatus } from "@/types/content";

/**
 * Demo registry. A demo is only `live` when real model execution works end to end.
 * See docs/development/adding-a-demo.md.
 */
export const demos: Demo[] = [
  {
    slug: "autopilot",
    name: "Autopilot",
    solutionSlug: "workflow-automation",
    flagship: true,
    shot: { src: "/work/autopilot-lead.webp", alt: "A WhatsApp enquiry running through CRM, stock, quote, approval, payment, invoice and dispatch on its own" },
    parts: ["WhatsApp & email", "CRM, stock & accounts", "Approvals & payments"],
    summary:
      "Four small businesses with their tools wired together. You play the customer or the supplier; watch the CRM, stock, documents, calendar, sheets, team chat and payments update by themselves, with a person asked only when it matters.",
    problem: "Every enquiry, cancellation, invoice and service call is passed by hand between WhatsApp, email, the CRM, the calendar and the accounts sheet, so things are slow, retyped and forgotten.",
    tryIt: [
      "Ask a packaging company for a quote on WhatsApp and pay it",
      "Cancel a clinic appointment and watch the waitlist refill the slot",
      "Email an over-billed invoice and see it caught before payment",
      "Report a broken AC and follow the technician to a closed, paid job",
      "Bargain, go silent or change your mind: every path ends with a report",
    ],
    status: "limited-preview",
    sampleInput: "Four fictional businesses in Bengaluru (packaging, a clinic, accounts payable, AC repair) with their own customers, stock, calendars and rate cards. Nothing is really sent.",
    limitations: [
      "A simulation: messages, payments and bookings are not sent to real services",
      "Typed messages are read for free up to 3 a day; tapping the suggested replies is unlimited",
      "Time saved is an estimate of the desk work each step replaces",
    ],
    applications: ["Distribution and wholesale", "Clinics and diagnostics", "Accounts payable", "Field service and repairs", "Any business run on WhatsApp"],
  },
  {
    slug: "ops-suite",
    name: "Ops Suite",
    solutionSlug: "workflow-automation",
    flagship: true,
    shot: { src: "/work/ops-suite-dashboard.webp", alt: "Ops Suite dashboard" },
    parts: ["Workflow automation", "Data analytics", "AI evaluation"],
    summary: "A working CRM, ERP and data portal on one database — with automated flows, a plain-English question box and its own AI quality report.",
    problem: "Sales, stock and money live in separate tools, so every hand-off is manual and every question waits on a report.",
    tryIt: ["Win a deal and watch the order, invoice and stock follow", "Ask a business question in plain English", "See how the AI is measured"],
    status: "limited-preview",
    sampleInput: "Synthetic Indian B2B data (₹, GST) — reset every night.",
    evaluation: "Graded on 33 fixed business questions with known answers; live monitoring of answer quality, speed, cost and user feedback.",
    limitations: ["Synthetic data only", "Free-form questions are limited in the preview; the examples show pre-written answers", "Changes reset nightly"],
    applications: ["Distribution and wholesale", "Order-to-cash automation", "Self-serve analytics", "AI evaluation"],
  },
  {
    slug: "document-intelligence",
    name: "DocDesk",
    solutionSlug: "document-intelligence",
    flagship: true,
    shot: { src: "/work/docdesk-ask.webp", alt: "DocDesk answering a contract question with the source clause highlighted on the page" },
    parts: ["Document Q&A", "Field extraction", "Invoice checks"],
    summary:
      "A document desk for contracts, invoices, leases and policies: ask questions and see the exact passage highlighted, pull out fields into JSON, catch errors before you pay, and compare versions clause by clause.",
    problem: "Teams still read the same PDFs line by line to find a clause, copy a total or check an invoice against its order.",
    tryIt: [
      "Ask a contract a question and see the source highlighted on the page",
      "Extract an invoice's fields and line items, then export JSON or CSV",
      "Catch a wrong total and an over-billed line before payment",
      "Redline two contract versions clause by clause",
      "Upload your own one-page PDF",
    ],
    status: "limited-preview",
    sampleInput: "8 synthetic Indian business documents (contracts, GST invoices, a purchase order, a lease, an HR policy), plus your own one-page PDFs.",
    evaluation: "Graded on 42 fixed questions with known answers, including paraphrases, answers that must be worked out from several clauses, and 6 about things the documents don't say: 100% answered correctly, 100% cite the right clause, 100% correct “not in the document”; 100% of 90 extracted fields correct; typical answer in 0.9 s.",
    limitations: [
      "Uploads are limited to one-page PDFs in this demo; the product handles multi-page documents (the samples run to three pages)",
      "Scanned images need OCR, which the demo doesn't run",
      "Free questions are limited per day; examples, comparisons and checks are unlimited",
      "Answers can still be wrong — every one links to its source so you can check",
    ],
    applications: ["Contract review", "Accounts payable", "Lease abstraction", "Policy Q&A", "Due diligence"],
  },
  {
    slug: "computer-vision",
    name: "Perception Lab",
    solutionSlug: "computer-vision",
    summary:
      "Perception for vehicles and robots: a 360° blind-spot monitor from four fisheye cameras, real-time keypoints on industrial trolleys, and camera–LiDAR calibration without a board.",
    problem: "Perception that works on a benchmark often breaks on a real vehicle or robot: bent fisheye images, sensors that drift apart, edge hardware that's too slow.",
    tryIt: ["Watch the 360° view raise a blind-spot alert", "See trolleys tracked keypoint by keypoint", "Watch a LiDAR scan lock onto the camera image"],
    status: "coming-soon",
    sampleInput: "Rendered illustrations of each project; the systems themselves run on vehicles, robots and sensor rigs.",
    evaluation:
      "Camera–LiDAR calibration: more than 95% of LiDAR points land on the person's mask, across several sensor setups. Edge pose estimation: 2× faster on the device than the unoptimised model, with keypoint accuracy held. Blind-spot monitoring validated on recorded datasets and live camera streams.",
    limitations: ["The clips are illustrations made for this site, not recordings of customer systems", "A hands-on demo is in progress"],
    applications: ["Autonomous mobile robots", "Driver assistance", "Physical AI", "Warehouse automation", "Sensor calibration"],
  },
  {
    slug: "customer-support",
    name: "Support Assistant",
    solutionSlug: "customer-support",
    summary:
      "The assistant that answers questions about my work on this site, opened up as a support console: every reply is triaged, grounded in the site's pages and either answered, handed to a human or declined.",
    problem: "Support bots fail in two ways: they make things up, or they never let a human take over. This one is built to do neither.",
    tryIt: [
      "Ask anything about my projects, services or background",
      "Run scenarios: off-topic, prompt injection, a project enquiry, Hinglish",
      "Inspect any reply: topic, route, the pages it cited and how fast it answered",
    ],
    status: "limited-preview",
    sampleInput: "The knowledge base is this website's pages. No customer data.",
    limitations: [
      "Knows only what is published on this site",
      "A daily cap applies; past it, the assistant quotes the site instead of answering in its own words",
    ],
    applications: ["Help centres", "E-commerce and SaaS support", "Internal IT and HR desks", "Sales enquiries"],
  },
  {
    slug: "voice-ai",
    name: "Front Desk Voice",
    solutionSlug: "voice-ai",
    flagship: true,
    shot: { src: "/work/voice-booking.webp", alt: "A clinic call transcript with the booked slot, the agent's timeline and the note left for staff" },
    parts: ["Voice agent", "Appointment booking", "Ask about Azad"],
    summary:
      "A phone agent you can talk to: it books clinic appointments from the real calendar, handles changes of mind, answers questions, hands urgent or tricky calls to a person, and leaves staff a one-line note. A second line answers questions about Azad's work out loud.",
    problem: "After hours, calls for bookings and questions go unanswered, and every missed call is a missed patient or customer.",
    tryIt: [
      "Call the clinic and book a slot by voice",
      "Change your mind mid-call and watch it rebook",
      "Ask about parking, fees or opening hours",
      "Play a sample call: no microphone needed",
      "Ask about Azad's work out loud",
    ],
    status: "limited-preview",
    sampleInput: "A fictional clinic in Bengaluru with four doctors and a realistic, partly booked two-week calendar; your own voice, or six sample calls.",
    evaluation:
      "Graded on 21 test calls with known outcomes (changes of mind, days the doctor is off, emergencies, cancellations): 21/21 handled correctly. 108 test recordings, clean, noisy and phone-quality, understood the same as the written line 88% of the time. Speech to text in about 0.4 s; most replies decided in under a millisecond.",
    limitations: [
      "Live calls are limited to 3 a day per visitor; sample calls are unlimited",
      "Test recordings use synthetic voices. Unusual names are the hardest part, so the agent always reads the name back",
      "English only for now; the voice you hear is your device's own",
      "Changes to existing appointments go to the front desk as a call-back",
    ],
    applications: ["Clinics and diagnostics", "Salons and service businesses", "Real-estate enquiries", "Lead qualification", "After-hours support"],
  },
];

export const statusLabel: Record<DemoStatus, string> = {
  live: "Live",
  "limited-preview": "Limited Preview",
  "coming-soon": "Coming Soon",
};

export const getDemo = (slug: string) => demos.find((d) => d.slug === slug);
