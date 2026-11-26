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
  taglineHighlight: "survive contact",
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
  { label: "About", href: "/#about", section: "about" },
  { label: "Work", href: "/#work", section: "work" },
  { label: "Contact", href: "/#contact", section: "contact" },
];

export const pages = [
  { label: "Solutions", href: "/solutions" },
  { label: "Demos", href: "/demos" },
  { label: "Work", href: "/work" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "/contact" },
];

export const philosophy =
  "I enjoy working with startups and businesses that want to move beyond experimentation and build AI solutions that deliver measurable value.";

/** Words in `philosophy` set in the italic serif on the home page. */
export const philosophyHighlight = ["beyond", "measurable"];

/** "What I build": the kinds of projects customers hire me for. */
export const expertise = [
  {
    icon: "workflow" as const,
    title: "AI Automation",
    items: ["Workflow automation", "AI agents", "Business process automation", "Intelligent integrations"],
  },
  {
    icon: "brain" as const,
    title: "AI Applications",
    items: ["Custom AI tools", "LLM-powered applications", "Chatbots", "RAG systems"],
  },
  {
    icon: "scan" as const,
    title: "Computer Vision",
    items: ["Object detection", "Segmentation", "Tracking", "OCR", "Visual intelligence systems"],
  },
  {
    icon: "chart" as const,
    title: "Machine Learning",
    items: ["Custom model development", "Data pipelines", "Optimization", "Deployment"],
  },
  {
    icon: "boxes" as const,
    title: "AI Product Engineering",
    items: ["Backend development", "API integrations", "End-to-end AI product development"],
  },
];

export const about = {
  text: "I'm Azad, an Applied AI Engineer focused on building intelligent systems that solve real-world problems.\n\nI work with startups and businesses to turn ideas, manual processes, and complex requirements into practical AI-powered solutions. My work spans AI automation, custom AI applications, LLM-powered systems, machine learning, and computer vision.\n\nI've collaborated with different companies on AI automation and product development, helping translate business requirements into working technical solutions. Alongside this, my engineering experience includes developing robotics perception systems at Virya Autonomous Technologies and working on AI research at IIT Madras.\n\nThis combination of experience allows me to approach problems from both a business and engineering perspective — whether it's automating repetitive operations, integrating AI into an existing product, developing a custom computer vision model, or building an AI-powered application from scratch.\n\nI take projects end to end: understanding the problem, designing the architecture, developing the solution, integrating APIs and existing tools, testing, and deploying a working system.",
  highlight: "end to end",
  pullquote: "Have an idea, a process to automate, or an AI product to build? Let's make it happen.",
};

export const experience: Role[] = [
  { company: "Independent", title: "Applied AI Engineer", period: "Now" },
  { company: "Virya Autonomous Technologies", title: "Robotics AI Engineer", period: "2026 – Now" },
  { company: "IIT Madras · Centre for Responsible AI", title: "ML Research Intern", period: "2025" },
];

/** Skills and sectors, shown as four lists under Experience. */
export const skills = [
  { title: "AI & automation", items: ["AI agents & assistants", "Voice & speech AI", "Document understanding", "Integrations & APIs"] },
  { title: "Vision & robotics", items: ["Detection, tracking & pose", "3D perception & mapping", "Sensor calibration & fusion", "Edge AI deployment"] },
  { title: "Business sectors", items: ["Clinics & healthcare", "Real estate", "Retail & e-commerce", "Finance, legal & CA firms", "Education", "Logistics & HR"] },
  { title: "Industrial sectors", items: ["Robotics & AMRs", "Automotive & ADAS", "Warehousing", "Manufacturing & distribution"] },
];

/** "Let's run it live" pop-up (components/shared/LiveDemoDialog) — shown when a live demo feature is offline. */
export const liveDemoCopy = {
  eyebrow: "Live demo",
  title: "Let's run it live",
  body: (demo: string) =>
    `${demo} runs live on request. Leave your details and I'll set up a short call to show it working, on your own example if you like.`,
  fields: { name: "Your name", email: "Email", company: "Company (optional)", note: "Anything you'd like to see? (optional)" },
  notePlaceholder: "e.g. our invoices, a clinic booking flow…",
  submit: "Request a live demo",
  sending: "Sending",
  dismiss: "Keep exploring",
  sent: { title: "Thanks, request received", body: "I'll email you within two working days to set up a time." },
  error: "Couldn't send right now. Please email me instead:",
};
