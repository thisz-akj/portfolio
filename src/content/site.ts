import type { Role } from "@/types/content";

/**
 * Owner-editable site configuration.
 */
export const site = {
  name: "Azad Kumar Jha",
  shortName: "Azad",
  role: "Applied AI Engineer",
  roles: ["AI automation", "Computer vision", "Robotics"],
  tagline: "I build AI systems that survive contact with the real world.",
  taglineHighlight: "survive contact",
  description:
    "Applied AI engineer building AI automation for businesses (workflow agents, document intelligence, voice and support agents) and computer vision for robots and vehicles (perception, SLAM, sensor calibration, edge AI), with the evaluation that keeps both honest.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "azadkumarjha09@gmail.com",
  phone: { display: "+91 70736 75669", tel: "+917073675669" },
  status: "Available for projects",
  location: {
    city: "Bengaluru, India",
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
  "I enjoy working with teams that want to move beyond experimentation and build AI that delivers measurable value, whether it runs a business process or a robot.";

/** Words in `philosophy` set in the italic serif on the home page. */
export const philosophyHighlight = ["beyond", "measurable"];

/** "What I build": AI automation (left column on desktop) and computer vision & robotics (right column), three each — owner: balance both. */
export const expertise = [
  {
    icon: "workflow" as const,
    title: "AI Automation",
    items: ["Workflow automation", "AI agents", "Voice & chat agents", "Integrations with existing tools"],
  },
  {
    icon: "scan" as const,
    title: "Computer Vision",
    items: ["Object detection & segmentation", "Tracking & pose estimation", "Monocular depth", "OCR & visual inspection"],
  },
  {
    icon: "brain" as const,
    title: "AI Applications",
    items: ["LLM-powered applications", "RAG & document intelligence", "Custom AI tools", "Evaluation & monitoring"],
  },
  {
    icon: "robot" as const,
    title: "Robotics & Autonomy",
    items: ["Perception on ROS2", "Visual SLAM & 3D mapping", "Camera–LiDAR calibration & fusion", "Navigation"],
  },
  {
    icon: "boxes" as const,
    title: "AI Product Engineering",
    items: ["Backend & APIs", "Data pipelines", "End-to-end product delivery"],
  },
  {
    icon: "chip" as const,
    title: "Edge AI & Deployment",
    items: ["Quantization (INT8 / BF16)", "Compilation for accelerators", "Real-time inference", "Reproducible evaluation"],
  },
];

export const about = {
  text: "I'm Azad, an Applied AI Engineer in Bengaluru. I build AI that has to work outside the demo: in the daily operations of a business, and on robots and vehicles in the field.\n\nOn the automation side, I build voice and chat agents, document intelligence and workflows that connect the tools a business already uses, from the phone and WhatsApp to email, CRM and accounts. As a freelancer, I've built voice agents, automated review replies and search-ranking tracking for companies.\n\nOn the robotics side, I build perception for autonomous mobile robots and driver assistance at Virya Autonomous Technologies: detection, tracking, pose, depth and LiDAR perception, deployed in real time on edge hardware. My own projects range from visual SLAM that lets a robot map a room and drive itself, to calibrating cameras and LiDAR without a target.\n\nThe two halves share one habit, which my AI research at IIT Madras made second nature: measure it. Every system I ship comes with a fixed test set and real numbers for accuracy, speed and cost, whether it's answering a customer's call or finding a trolley's wheels.",
  highlight: "outside the demo",
  pullquote: "A process to automate, or a robot that needs to see: either way, I build AI that holds up in the real world.",
};

export const experience: Role[] = [
  { company: "Independent", title: "Applied AI Engineer", period: "Now" },
  { company: "Virya Autonomous Technologies", title: "Robotics AI Engineer", period: "2026 – Now" },
  { company: "Fuvii · AI marketing for local businesses", title: "AI Engineer (Freelance)", period: "2026" },
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

/** Shown under Experience in About (from the résumé). */
export const achievements = [
  { title: "GATE rank 8603, Data Science & Artificial Intelligence", year: "2025" },
  { title: "Amazon ML Challenge: top 0.5% of national participants", year: "2024" },
  { title: "Finalist, International Rover Challenge (Space Robotics Society)", year: "2024" },
];

/** Downloadable résumés (public/resume/), one per kind of role. Built from resume/ (each folder has a build.mjs). */
export const resumes = [
  { label: "Applied AI & automation", href: "/resume/azad-kumar-applied-ai.pdf" },
  { label: "Computer vision & robotics", href: "/resume/azad-kumar-cv-robotics.pdf" },
];
