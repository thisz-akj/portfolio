import { NextResponse } from "next/server";
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";
import { randomBytes } from "node:crypto";
import { peekAiQuestion, refundAiQuestion, takeAiQuestion, visitorFromHeaders, VOICE_FREE_TURNS } from "@/lib/aiQuota";

/**
 * Starts a live voice call: a private LiveKit room with the "front-desk" agent dispatched into it.
 * Clinic calls count against the free "voice-call" allowance; questions on the "about" line are counted per
 * question by /api/assistant (the agent calls it with this visitor's address, sealed in the dispatch metadata).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

const json = (status: number, code: string, message: string, headers?: Record<string, string>) =>
  NextResponse.json({ detail: { code, message } }, { status, headers });

export async function POST(req: Request) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return json(503, "offline", "Live calls are offline right now. The sample calls still play.");
  const ip = visitorFromHeaders(req.headers);
  if (rateLimited(ip)) return json(429, "rate_limited", "Too many calls. Try again in a few minutes.");
  const body = (await req.json().catch(() => ({}))) as { line?: unknown };
  const line = body.line === "about" ? "about" : "clinic";

  // Out of free turns today → no call at all (saves the voice allowance); the page shows the "build this" pop-up.
  if (peekAiQuestion("voice-turn", ip, Date.now(), VOICE_FREE_TURNS) <= 0)
    return json(429, "turns", "You've used today's free demo.");

  let qh: Record<string, string> = {};
  if (line === "clinic") {
    const quota = takeAiQuestion("voice-call", ip);
    qh = { "x-ai-remaining": String(quota.remaining), "x-ai-limit": String(quota.limit) };
    if (!quota.ok) return json(429, "quota", "Free live calls for today are used up.", qh);
  }

  try {
    const room = `vx-${line}-${randomBytes(6).toString("hex")}`;
    const identity = `visitor-${randomBytes(4).toString("hex")}`;
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, ttl: "10m" });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true });
    at.roomConfig = new RoomConfiguration({
      agents: [new RoomAgentDispatch({ agentName: "front-desk", metadata: JSON.stringify({ line, visitor: ip }) })],
    });
    const token = await at.toJwt();
    return NextResponse.json({ url: LIVEKIT_URL, token, line }, { headers: { ...qh, "cache-control": "no-store" } });
  } catch (err) {
    console.error("[voice] session failed:", err);
    if (line === "clinic") refundAiQuestion("voice-call", ip);
    return json(503, "offline", "Live calls are offline right now. The sample calls still play.");
  }
}
