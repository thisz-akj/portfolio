import type { Choice, RunResult, ScenarioId } from "./types";

export type RunResponse = RunResult & { notice?: string; quota?: { remaining: number; limit: number } };

/** Replays a scenario with the visitor's answers (POST /api/demos/autopilot/run). */
export async function runScenario(scenario: ScenarioId, choices: Record<string, Choice>): Promise<RunResponse> {
  const res = await fetch("/api/demos/autopilot/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenario, choices }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json().catch(() => ({}))) as RunResponse & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "The demo couldn't run that step. Try again.");
  return body;
}
