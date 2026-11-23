import type { Role } from "@/types/content";

/**
 * Owner-editable site configuration.
 * Anything marked TODO is a placeholder — replace before publishing.
 */
export const site = {
  name: "Azad Kumar Jha",
  shortName: "Azad",
  role: "Independent Applied AI Engineer",
  roles: ["Automate", "Integrate", "Evaluate"],
  tagline: "I build AI systems that survive contact with real users.",
  description:
    "Independent applied AI engineer building AI automation for founders and product teams: workflow agents, document intelligence, support copilots, voice agents and the evaluation that keeps them honest.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "azadkumarjha09@gmail.com",
  phone: { display: "+91 70736 75669", tel: "+917073675669" },
  status: "Available for projects",
  location: {
    city: "India", // TODO(owner): city you want to show
    coords: "",
  },
  socials: [
    { label: "GitHub", href: "https://github.com/thisz-akj", icon: "github" as const },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/azad-kumar-jha/", icon: "linkedin" as const },
  ],
};

export const nav = [
  { label: "Intro", href: "/#intro", section: "intro" },
  { label: "Work", href: "/#work", section: "work" },
  { label: "About", href: "/#about", section: "about" },
  { label: "Contact", href: "/#contact", section: "contact" },
];

export const pages = [
  { label: "Solutions", href: "/solutions" },
  { label: "Demos", href: "/demos" },
  { label: "Work", href: "/work" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const philosophy =
  "I build AI that earns its place in a product: grounded in real data, measured against honest baselines, and engineered to keep working when the inputs get messy. Research is the starting point. Shipping is the job.";

export const expertise = [
  {
    icon: "brain" as const,
    title: "Applied AI",
    items: ["LLM & RAG systems", "Document intelligence", "Support & voice agents", "Computer vision"],
  },
  {
    icon: "workflow" as const,
    title: "Automation",
    items: ["Workflow agents", "CRM & inbox integrations", "Human-in-the-loop review", "Audit logs & rollback"],
  },
  {
    icon: "gauge" as const,
    title: "Evaluation",
    items: ["Benchmarks & baselines", "Quantization studies", "Failure analysis", "Latency & cost"],
  },
  {
    icon: "boxes" as const,
    title: "Shipping",
    items: ["APIs & backends", "Desktop & web tools", "Docker & CI", "MLOps pipelines"],
  },
];

export const about = {
  text: "I'm an applied AI engineer who builds automation for the unglamorous half of a business: the inbox nobody wants, the PDFs nobody reads, the report someone rebuilds every Friday. I like the parts most demos skip — the integrations, the edge cases, the evaluation harness that proves it works.\n\nI came to this from perception research: visual SLAM, sensor calibration, quantised models. That taught me one habit I bring to every client project. Every system starts with a baseline, gets measured honestly, and ships with its limitations written down. I'd rather show you a working demo than a slide about one.\n\nIf you have a product feature that needs AI — or AI that needs to start working reliably — let's talk.",
  highlight: "measured honestly",
  pullquote: "Show the demo. Then show the numbers.",
};

// TODO(owner): replace with approved roles. Shown with a placeholder badge until then.
export const experience: Role[] = [
  { company: "Independent", title: "Applied AI Engineer", period: "Now", placeholder: false },
  { company: "Company name", title: "Your role", period: "Year – Year", placeholder: true },
];

export const skills = [
  { title: "AI", items: ["LLMs & embeddings", "Agents & tool calling", "RAG & rerankers", "Speech (ASR / TTS)"] },
  { title: "Integrations", items: ["CRMs & helpdesks", "Email & calendars", "Webhooks & queues", "Python · C++"] },
  { title: "Product", items: ["Next.js · TypeScript", "FastAPI", "Docker", "DVC · MLflow"] },
  { title: "Practice", items: ["Evaluation design", "Error analysis", "Docs that people read", "Honest reporting"] },
];
