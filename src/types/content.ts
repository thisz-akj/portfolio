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
  /** Which animated mock-UI preview to show */
  preview: PreviewKind;
  /** Mood image behind the preview (public/art, CC0 — see docs/credits.md) */
  art: string;
  /** Looping mood clip (public/video, Mixkit free licence — see docs/credits.md) */
  video?: string;
  /** Owner's own screenshot or video for the side panel. Leave empty to show a placeholder slot. */
  media?: { type: "image" | "video"; src: string; alt: string };
  /** First-person note shown in the side panel */
  story: string;
  /** How I typically build it */
  build: string[];
  stack: string[];
  /** Scripted walkthrough for the panel's demo showcase (sample data, not a live model) */
  showcase: Showcase;
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
  howItWorks: string[];
  architecture: string[];
  stack: string[];
  evaluation?: string;
  limitations: string[];
  applications: string[];
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
  approach: string[];
  results: ProjectMetric[];
  lessons: string[];
  stack: string[];
  featured?: boolean;
  repo?: string;
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
