import type { Actor, Card, Choice, Pending, RunEvent, Tool } from "../types";
import { hhmm, dayLabel, istAt, minutesUntil } from "../time";

/** Thrown by `ask()` when a step needs an answer the visitor hasn't given yet. */
export class Pause {
  constructor(public pending: Pending) {}
}

/** A typed message that rules could not fully read; the route may ask the model and rerun. */
export interface NeedsModel {
  choiceId: string;
  kind: ReadKind;
  text: string;
}

export type ReadKind = "lead" | "service" | "reply";

interface StepExtra {
  detail?: string;
  saves?: number;
  card?: Card;
  tone?: RunEvent["tone"];
}

/** Run context: the simulated clock, the event log and the visitor's stored answers. */
export class Ctx {
  events: RunEvent[] = [];
  now = 0;
  humans = 0;
  outcome = "";
  needsModel?: NeedsModel;

  constructor(
    public start: string,
    public choices: Record<string, Choice>,
  ) {}

  wait(minutes: number) {
    this.now += minutes;
  }

  /** Jump to an IST wall-clock time (never backwards). */
  waitUntil(dayOffset: number, hour: number, minute = 0) {
    this.now = Math.max(this.now, minutesUntil(this.start, dayOffset, hour, minute));
  }

  step(tool: Tool, actor: Actor, title: string, extra: StepExtra = {}) {
    this.events.push({ id: `e${this.events.length + 1}`, at: this.now, tool, actor, title, ...extra });
  }

  /** The business sends a message (to the visitor unless `to` is given). */
  send(tool: Tool, title: string, text: string, extra: StepExtra & { attachment?: string; to?: string } = {}) {
    const { attachment, to, ...rest } = extra;
    this.events.push({ id: `e${this.events.length + 1}`, at: this.now, tool, actor: "auto", title, msg: { side: "out", text, attachment, to }, ...rest });
  }

  /** A message arrives from the visitor (or from someone else when `from` is given). */
  receive(tool: Tool, title: string, text: string, extra: StepExtra & { attachment?: string; from?: string } = {}) {
    const { attachment, from, ...rest } = extra;
    this.events.push({ id: `e${this.events.length + 1}`, at: this.now, tool, actor: "customer", title, msg: { side: "in", text, attachment, to: from }, ...rest });
  }

  /** The stored answer for this prompt, or pause the run and ask for it. */
  ask(p: Pending): Choice {
    const c = this.choices[p.id];
    if (!c) throw new Pause(p);
    if (p.who === "team") this.humans++;
    return c;
  }

  /** Text of an answer: the typed text, or the chosen option's label. */
  textOf(p: Pending, c: Choice) {
    if ("text" in c) return c.text;
    return p.options.find((o) => o.id === c.option)?.label ?? c.option;
  }

  // ---- clock helpers ----
  time(at = this.now) {
    return hhmm(istAt(this.start, at));
  }
  day(at = this.now) {
    return dayLabel(istAt(this.start, at));
  }
  /** Day offset of a time from the start day */
  dayOffset(at = this.now) {
    return Math.floor((at + minutesUntil(this.start, 0, 0) * -1) / 1440);
  }
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const inr2 = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
