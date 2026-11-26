import { NextResponse } from "next/server";
import { z } from "zod";
import { refundAiQuestion, takeAiQuestion, visitorFromHeaders } from "@/lib/aiQuota";
import { simulate, SCENARIO_IDS } from "@/features/demos/autopilot/engine";
import { readWithModel } from "@/features/demos/autopilot/model.server";
import type { Choice, ScenarioId } from "@/features/demos/autopilot/types";

/** Vercel function time limit (s): long enough for streamed answers and uploads. */
export const maxDuration = 60;

/**
 * Autopilot: replays a scenario with the visitor's answers and returns the business steps so far.
 * Tapped options and presets cost nothing; a typed message that rules can't read may use one model call
 * ("autopilot-read" free quota). Responses carry business steps only.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 240;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

const ChoiceSchema = z.union([
  z.object({ option: z.string().min(1).max(40) }).strict(),
  z.object({ text: z.string().trim().min(1).max(500), fields: z.record(z.string().max(20), z.string().max(80)).optional() }).strict(),
]);

const Body = z.object({
  scenario: z.enum(SCENARIO_IDS as [ScenarioId, ...ScenarioId[]]),
  choices: z.record(z.string().regex(/^[a-z0-9-]{1,20}$/), ChoiceSchema).refine((c) => Object.keys(c).length <= 24),
});

export async function POST(req: Request) {
  const visitor = visitorFromHeaders(req.headers);
  if (rateLimited(visitor)) return NextResponse.json({ error: "Too many steps in a short time. Try again in a few minutes." }, { status: 429 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (Object.values(body.choices).some((c) => "fields" in c && c.fields && Object.keys(c.fields).length > 10)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let run = simulate(body.scenario, body.choices as Record<string, Choice>);
  let notice: string | undefined;
  let quota: { remaining: number; limit: number } | undefined;

  if (run.needsModel) {
    const { choiceId, kind, text } = run.needsModel;
    const prev = run.choices[choiceId] as { text: string; fields?: Record<string, string> };
    const q = await takeAiQuestion("autopilot-read", visitor);
    let read: Record<string, string> | null = null;
    if (q.ok) {
      quota = { remaining: q.remaining, limit: q.limit };
      read = await readWithModel(kind, text);
      if (!read) {
        await refundAiQuestion("autopilot-read", visitor);
        quota = { remaining: q.remaining + 1, limit: q.limit };
        notice = "The assistant that reads typed messages is busy, so the automation asked a follow-up question instead.";
      }
    } else {
      quota = { remaining: 0, limit: q.limit };
      notice = "limit";
    }
    const rules = Object.fromEntries(Object.entries(prev.fields ?? {}).filter(([k]) => !k.startsWith("_")));
    run.choices[choiceId] = { text, fields: { ...(read ?? {}), ...rules, _s: read ? "b" : "c" } };
    run = simulate(body.scenario, run.choices);
  }

  const { needsModel: _drop, ...result } = run;
  void _drop;
  return NextResponse.json({ ...result, notice, quota }, { headers: { "cache-control": "no-store" } });
}
