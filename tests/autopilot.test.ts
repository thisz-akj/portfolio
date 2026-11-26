import { describe, expect, it } from "vitest";
import { simulate, SCENARIO_IDS } from "@/features/demos/autopilot/engine";
import { readLead, readReply, readService } from "@/features/demos/autopilot/engine/read";
import type { Choice, ScenarioId } from "@/features/demos/autopilot/types";
import { SCENARIOS } from "@/features/demos/autopilot/scenarios";

/** Walks every option path of a scenario (tapped options only, no typed text). */
function walk(scenario: ScenarioId) {
  const leaves: ReturnType<typeof simulate>[] = [];
  const stack: Record<string, Choice>[] = [{}];
  let runs = 0;
  while (stack.length) {
    const choices = stack.pop()!;
    const r = simulate(scenario, choices);
    if (++runs > 2000) throw new Error("too many paths");
    if (r.done) leaves.push(r);
    else for (const o of r.pending!.options) stack.push({ ...choices, [r.pending!.id]: { option: o.id } });
  }
  return leaves;
}

describe("autopilot engine", () => {
  it("has metadata for every scenario", () => {
    expect(SCENARIOS.map((s) => s.id).sort()).toEqual([...SCENARIO_IDS].sort());
  });

  for (const id of SCENARIO_IDS) {
    it(`${id}: every path finishes with an outcome and a sane clock`, () => {
      const leaves = walk(id);
      expect(leaves.length).toBeGreaterThan(2);
      for (const r of leaves) {
        expect(r.report?.outcome, JSON.stringify(r.choices)).toBeTruthy();
        expect(r.report!.automatic).toBeGreaterThan(3);
        expect(r.report!.savedMin).toBeGreaterThan(0);
        const ids = new Set(r.events.map((e) => e.id));
        expect(ids.size).toBe(r.events.length);
        for (let i = 1; i < r.events.length; i++) expect(r.events[i].at, `${id} ${r.events[i].title}`).toBeGreaterThanOrEqual(r.events[i - 1].at);
        for (const e of r.events) expect(e.title).not.toMatch(/undefined|NaN/);
        expect(JSON.stringify(r.events)).not.toMatch(/undefined|NaN/);
      }
    });
  }

  it("pauses at the first prompt with nothing chosen", () => {
    const r = simulate("lead-to-cash", {});
    expect(r.done).toBe(false);
    expect(r.pending?.id).toBe("enquiry");
  });

  it("reads typed text with rules and flags the model only when a required field is missing", () => {
    const ok = simulate("lead-to-cash", { enquiry: { text: "Need 300 mailer boxes by Monday - Priya" } });
    expect(ok.needsModel).toBeUndefined();
    expect((ok.choices.enquiry as { fields: Record<string, string> }).fields).toMatchObject({ product: "mailer", qty: "300", by: "monday", name: "Priya", _s: "a" });
    const miss = simulate("lead-to-cash", { enquiry: { text: "can you send me a few hundred of the brown ones" } });
    expect(miss.needsModel?.choiceId).toBe("enquiry");
    // Once the model has been tried, it isn't flagged again; the flow asks the customer instead.
    const tried = simulate("lead-to-cash", { enquiry: { text: "can you send me a few hundred of the brown ones", fields: { _s: "c" } } });
    expect(tried.needsModel).toBeUndefined();
    expect(tried.pending?.id).toBe("more0");
  });

  it("ignores forged fields sent back from the browser", () => {
    const r = simulate("lead-to-cash", { enquiry: { text: "hello", fields: { product: "<b>x</b>", qty: "-5", _s: "c" } } });
    expect(r.pending?.id).toBe("more0");
    const s = simulate("service-job", { request: { text: "hi", fields: { problem: "cooling", area: "Atlantis", _s: "c" } } });
    expect(s.pending?.id).toBe("more0");
  });

  it("does not echo bookkeeping keys into event cards", () => {
    const r = simulate("service-job", { request: { text: "AC leaking in Koramangala" } });
    expect(JSON.stringify(r.events)).not.toContain("_s");
  });
});

describe("autopilot rules", () => {
  it("reads packaging enquiries", () => {
    expect(readLead("Hi, need 200 5-ply cartons 18x12x12 by Friday. Price? — Ravi, Sri Sai Foods")).toEqual({ product: "carton5", qty: "200", by: "friday", name: "Ravi", company: "Sri Sai Foods" });
    expect(readLead("Do you have pizza boxes? Need 1000 pcs tomorrow")).toMatchObject({ product: "pizza", qty: "1000", by: "tomorrow" });
    expect(readLead("2k tape rolls")).toMatchObject({ product: "tape", qty: "2000" });
    expect(readLead("Hi, need boxes urgently")).toEqual({ by: "today" });
    expect(readLead("3 ply boxes 12x10x8 inch, 1,500 nos").qty).toBe("1500");
  });

  it("reads AC service requests", () => {
    expect(readService("My AC isn't cooling, I'm in Indiranagar. Can someone come this evening?")).toEqual({ problem: "cooling", area: "Indiranagar", when: "today-evening" });
    expect(readService("AC leaking water in HSR Layout, tomorrow morning please")).toEqual({ problem: "leak", area: "HSR Layout", when: "tomorrow-morning" });
    expect(readService("need ac servicing in btm")).toMatchObject({ problem: "service", area: "BTM Layout" });
  });

  it("reads reminder replies", () => {
    expect(readReply("yes")).toMatchObject({ intent: "confirm" });
    expect(readReply("I can't come tomorrow, sorry")).toMatchObject({ intent: "cancel" });
    expect(readReply("can we move it to friday?")).toMatchObject({ intent: "move", day: "friday" });
    expect(readReply("Wednesday works better")).toMatchObject({ intent: "move", day: "wednesday" });
    expect(readReply("hmm")).toEqual({});
  });
});
