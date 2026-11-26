export type DemoStatus = "live" | "limited-preview" | "coming-soon";

export interface Solution {
  slug: string;
  index: string;
  title: string;
  /** Jorge-style one-liner: "When …" */
  hook: string;
  problem: string;
  capabilities: string[];
  customers: string[];
  icon: SolutionIcon;
  demoSlug?: string;
  /** Deep link straight into a live demo screen (overrides /demos/<demoSlug> for the side-panel button) */
  demoHref?: string;
  /** Button text for demoHref, e.g. "See it live: Ask Ops Suite" */
  demoLabel?: string;
  /** Which animated mock-UI preview to show */
  preview: PreviewKind;
  /** Mood image behind the preview (public/art, CC0 — see docs/credits.md) */
  art: string;
  /** Looping mood clip (public/video, Mixkit free licence — see docs/credits.md) */
  video?: string;
  /** "Why it's different" in the full-screen story: outcomes, never how it's built */
  usp: string[];
  /** "How it's used": one line per industry */
  industries: { name: string; use: string }[];
  /** Case studies that prove it (results + screenshots in the story) */
  projects?: string[];
  /** Screenshots for the story, overriding the projects' galleries */
  shots?: string[];
  /** Looping clip (mp4 in public/video, poster = same name .webp) shown at the top of the story */
  clip?: string;
  /** "chapters": one continuous scroll-animated page through `projects` (no demo / proof sections);
   *  "pitch": a long-form client article from `article` (AutomationStory) */
  layout?: "article" | "chapters" | "pitch";
  /** Long-form pitch article for layout "pitch" (what it connects to, services, industries, FAQ) */
  article?: PitchArticle;
  /** First-person note shown in the side panel */
  story: string;
  /** How I typically build it */
  /** Scripted walkthrough for the panel's demo showcase (sample data, not a live model) */
  showcase: Showcase;
}

export type ConnectorIcon =
  | "phone"
  | "whatsapp"
  | "mail"
  | "calendar"
  | "map"
  | "auth"
  | "crm"
  | "money"
  | "docs"
  | "sheet"
  | "team"
  | "shop";

/** The client-facing pitch article behind a solution card (outcomes only, never how it's built). */
export interface PitchArticle {
  kicker: string;
  /** Opening paragraphs under the title */
  lede: string[];
  /** "Where the hours go": the hidden cost of manual work */
  cost: { title: string; text: string }[];
  /** "What it connects to": each tool family and what the AI does with it */
  connections: { icon: ConnectorIcon; name: string; examples: string; does: string[] }[];
  /** One end-to-end story across several connections */
  journey: { title: string; intro: string; steps: { time: string; via: string; text: string }[]; outcome: string };
  /** "How it makes things better": before → after */
  better: { area: string; before: string; after: string }[];
  /** "Why work with me" */
  usp: { title: string; text: string }[];
  /** Industry → concrete automations */
  industries: { name: string; examples: string[] }[];
  /** Services I offer */
  services: { name: string; text: string; get: string[] }[];
  /** How an engagement runs */
  process: { step: string; text: string }[];
  faq: { q: string; a: string }[];
  close: { title: string; text: string };
}

export type PreviewKind = "flow" | "doc" | "chat" | "voice" | "data" | "eval" | "cv";

export interface Showcase {
  inputLabel: string;
  input: string;
  steps: { label: string; detail: string }[];
  outputLabel: string;
  output: string;
}

export type SolutionIcon =
  | "file-search"
  | "headset"
  | "workflow"
  | "gauge"
  | "scan-eye"
  | "chart-line"
  | "audio-lines";

export interface Demo {
  slug: string;
  name: string;
  solutionSlug: string;
  summary: string;
  problem: string;
  tryIt: string[];
  status: DemoStatus;
  sampleInput: string;
  evaluation?: string;
  limitations: string[];
  applications: string[];
  /** Shown as a wide tile on /demos */
  flagship?: boolean;
  /** Flagship tile: screenshot + the solution areas it covers */
  shot?: { src: string; alt: string };
  parts?: string[];
}

export interface ProjectMetric {
  label: string;
  value: string;
}

export interface Project {
  slug: string;
  index: string;
  title: string;
  client: string;
  tags: string[];
  year: string;
  summary: string;
  cover: string;
  gallery: string[];
  problem: string;
  contribution: string;
  results: ProjectMetric[];
  lessons: string[];
  featured?: boolean;
  repo?: string;
  /** Link to a working demo of the project (shown as "Open live demo") */
  demoUrl?: string;
  /** Looping clip (mp4 in public/video, poster = same name .webp) shown above the gallery */
  clip?: string;
  /** Why it stands out (shown in the computer-vision page's article for this project) */
  usp?: string[];
  /** Where it's used: one line per industry */
  industries?: { name: string; use: string }[];
}

export interface Client {
  name: string;
  /** Short mark used when no logo file is supplied */
  mark: string;
  /** Optional line under the wordmark */
  sub?: string;
  logo?: string;
  placeholder?: boolean;
}

export interface Role {
  company: string;
  title: string;
  period: string;
  placeholder?: boolean;
}
