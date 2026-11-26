/** Shared between the Autopilot engine (server) and the app (browser). Business steps only, never internals. */

export type ScenarioId = "lead-to-cash" | "no-show" | "invoice" | "service-job";

export type Tool = "whatsapp" | "email" | "phone" | "crm" | "stock" | "docs" | "calendar" | "sheet" | "chat" | "payments" | "maps";

export type Actor = "customer" | "auto" | "team";

export type Card =
  | { kind: "fields"; title: string; rows: [string, string][] }
  | { kind: "doc"; title: string; number: string; lines: { item: string; qty: string; rate: string; amount: string }[]; totals: [string, string][] }
  | { kind: "table"; title: string; head: string[]; rows: string[][]; highlight?: number[]; flag?: number[] };

export interface Message {
  /** in = from the customer/supplier (the visitor), out = from the business */
  side: "in" | "out";
  text: string;
  attachment?: string;
  /** Message to someone other than the visitor (e.g. a waitlisted patient) */
  to?: string;
}

export interface RunEvent {
  id: string;
  /** Minutes since the scenario's start */
  at: number;
  tool: Tool;
  actor: Actor;
  title: string;
  detail?: string;
  /** Rough manual desk-work minutes this step replaces */
  saves?: number;
  card?: Card;
  msg?: Message;
  /** Visual tone for outcomes */
  tone?: "good" | "warn" | "bad";
}

export interface PendingOption {
  id: string;
  label: string;
}

export interface Pending {
  id: string;
  who: "customer" | "team";
  tool: Tool;
  prompt: string;
  options: PendingOption[];
  /** The visitor may type their own reply */
  text?: { placeholder: string };
}

/** A visitor's answer: an option id, or typed text (+ fields read from it, returned by the server for reuse). */
export type Choice = { option: string } | { text: string; fields?: Record<string, string> };

export interface RunReport {
  automatic: number;
  humanTouches: number;
  tools: Tool[];
  elapsedMin: number;
  savedMin: number;
  outcome: string;
}

export interface RunResult {
  scenario: ScenarioId;
  start: string;
  events: RunEvent[];
  pending?: Pending;
  done: boolean;
  report?: RunReport;
  /** Choices with fields filled in by the server (typed text), to send back next time */
  choices: Record<string, Choice>;
  /** Set when a typed message could not be read by the assistant (quota/busy) and rules were used */
  notice?: string;
}
