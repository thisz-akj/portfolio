import type { Choice, RunReport, RunResult, ScenarioId, Tool } from "../types";
import { Ctx, Pause, type NeedsModel } from "./ctx";
import { invoice, INVOICE_START } from "./invoice";
import { leadToCash, LEAD_START } from "./leadToCash";
import { noShow, NOSHOW_START } from "./noShow";
import { serviceJob, SERVICE_START } from "./serviceJob";

/**
 * Autopilot engine: replays a scenario from the start with the visitor's stored answers. Deterministic,
 * no I/O; a step that needs an answer pauses the run with a `pending` prompt.
 */
const SCRIPTS: Record<ScenarioId, { start: string; run: (ctx: Ctx) => void }> = {
  "lead-to-cash": { start: LEAD_START, run: leadToCash },
  "no-show": { start: NOSHOW_START, run: noShow },
  invoice: { start: INVOICE_START, run: invoice },
  "service-job": { start: SERVICE_START, run: serviceJob },
};

export const SCENARIO_IDS = Object.keys(SCRIPTS) as ScenarioId[];

export function simulate(scenario: ScenarioId, choices: Record<string, Choice>): RunResult & { needsModel?: NeedsModel } {
  const s = SCRIPTS[scenario];
  const copy: Record<string, Choice> = Object.fromEntries(Object.entries(choices).map(([k, v]) => [k, "text" in v ? { ...v, fields: v.fields ? { ...v.fields } : undefined } : { ...v }]));
  const ctx = new Ctx(s.start, copy);
  let pending;
  try {
    s.run(ctx);
  } catch (e) {
    if (!(e instanceof Pause)) throw e;
    pending = e.pending;
  }
  const result: RunResult & { needsModel?: NeedsModel } = { scenario, start: s.start, events: ctx.events, pending, done: !pending, choices: ctx.choices, needsModel: ctx.needsModel };
  if (!pending) result.report = report(ctx);
  return result;
}

function report(ctx: Ctx): RunReport {
  const ev = ctx.events;
  const tools: Tool[] = [];
  for (const e of ev) if (!tools.includes(e.tool)) tools.push(e.tool);
  return {
    automatic: ev.filter((e) => e.actor === "auto").length,
    humanTouches: ctx.humans,
    tools,
    elapsedMin: ev.length ? ev[ev.length - 1].at - ev[0].at : 0,
    savedMin: ev.reduce((s, e) => s + (e.saves ?? 0), 0),
    outcome: ctx.outcome,
  };
}
