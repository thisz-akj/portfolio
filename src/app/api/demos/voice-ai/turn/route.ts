import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { takeAiQuestion, VOICE_FREE_TURNS } from "@/lib/aiQuota";

/** Vercel function time limit (s): long enough for streamed answers and uploads. */
export const maxDuration = 60;

/**
 * Called by the voice agent (never the browser) before it answers a caller turn: counts the turn against the
 * visitor's free daily allowance (VOICE_FREE_TURNS, default 5, both lines together). The agent proves itself with
 * the LiveKit API secret, which only the server side holds.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorised(req: Request) {
  const secret = process.env.LIVEKIT_API_SECRET ?? "";
  const given = req.headers.get("x-voice-secret") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function POST(req: Request) {
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { visitor?: unknown };
  const visitor = typeof body.visitor === "string" && body.visitor ? body.visitor.slice(0, 64) : "unknown";
  const q = await takeAiQuestion("voice-turn", visitor, Date.now(), VOICE_FREE_TURNS);
  return NextResponse.json({ ok: q.ok, remaining: q.remaining, limit: q.limit }, { status: q.ok ? 200 : 429 });
}
