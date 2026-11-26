import { NextResponse } from "next/server";
import { validChat } from "@/features/assistant/protocol";
import { refundAiQuestion, takeAiQuestion, visitorFromHeaders } from "@/lib/aiQuota";

/** Vercel function time limit (s): long enough for streamed answers and uploads. */
export const maxDuration = 60;

/**
 * Proxy to the Python assistant service (assistant/, FastAPI). Keeps the service private,
 * rate-limits per visitor and streams the NDJSON reply straight through.
 * ASSISTANT_URL defaults to the local dev server started by `npm run assistant:dev`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM = process.env.ASSISTANT_URL ?? "http://127.0.0.1:8001";
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>(); // best-effort, per instance

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return NextResponse.json({ error: "rate-limited" }, { status: 429 });

  if (Number(req.headers.get("content-length") ?? 0) > 64_000) {
    return NextResponse.json({ error: "too-large" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!validChat(body)) return NextResponse.json({ error: "invalid" }, { status: 422 });

  // Free questions per visitor per day; after that the UI invites them to send a message instead.
  const visitor = visitorFromHeaders(req.headers);
  const quota = await takeAiQuestion("assistant", visitor);
  const quotaHeaders = { "x-ai-remaining": String(quota.remaining), "x-ai-limit": String(quota.limit) };
  if (!quota.ok) return NextResponse.json({ error: "quota" }, { status: 429, headers: quotaHeaders });

  let upstream: Response;
  try {
    upstream = await fetch(`${UPSTREAM}/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.ASSISTANT_TOKEN ? { "x-assistant-token": process.env.ASSISTANT_TOKEN } : {}),
      },
      body: JSON.stringify({
        messages: body.messages.map(({ role, content }) => ({ role, content })),
        // The voice demo's "about Azad" line asks for short spoken answers.
        channel: (body as { channel?: unknown }).channel === "voice" ? "voice" : "text",
      }),
      signal: req.signal,
      cache: "no-store",
    });
  } catch {
    await refundAiQuestion("assistant", visitor);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (!upstream.ok || !upstream.body) {
    await refundAiQuestion("assistant", visitor);
    return NextResponse.json({ error: upstream.status === 422 ? "invalid" : "unavailable" }, { status: upstream.status === 422 ? 422 : 503 });
  }
  return new Response(upstream.body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no", ...quotaHeaders },
  });
}
