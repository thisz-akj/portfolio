import { NextResponse } from "next/server";
import { validChat, type AssistantEvent } from "@/features/assistant/protocol";
import { offlineAnswer } from "@/features/assistant/offline";
import { refundAiQuestion, takeAiQuestion, visitorFromHeaders } from "@/lib/aiQuota";

/** Vercel function time limit (s): long enough for streamed answers and uploads. */
export const maxDuration = 60;

/**
 * Proxy to the Python assistant service (assistant/, FastAPI). Keeps the service private,
 * rate-limits per visitor and streams the NDJSON reply straight through.
 * ASSISTANT_URL defaults to the local dev server started by `npm run assistant:dev`.
 * When the service can't be reached (or isn't configured in production), the reply comes from
 * features/assistant/offline.ts instead: rules + search over the site's content, 0 tokens, no free question used.
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

/** Streams a no-AI answer in the same NDJSON events the Python service sends. */
function offlineReply(messages: { role: string; content: string }[], voice: boolean, headers: Record<string, string> = {}) {
  const t0 = Date.now();
  const users = messages.filter((m) => m.role === "user");
  const a = offlineAnswer(users[users.length - 1]?.content ?? "", { previous: users[users.length - 2]?.content, voice });
  const events: AssistantEvent[] = [
    { type: "meta", mode: "offline" },
    { type: "trace", topic: a.topic, route: a.route, sources: a.sources, mode: "offline", ttft_ms: Date.now() - t0, total_ms: Date.now() - t0 },
    // a few chunks, so the reply appears the way live answers do
    ...(a.text.match(/[\s\S]{1,48}(\s|$)/g) ?? [a.text]).map((text) => ({ type: "delta" as const, text })),
    { type: "done" },
  ];
  return new Response(events.map((e) => JSON.stringify(e)).join("\n") + "\n", {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", ...headers },
  });
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

  const voice = (body as { channel?: unknown }).channel === "voice";
  // No assistant service configured in production → quick answers straight away (no quota, no wasted call).
  if (!process.env.ASSISTANT_URL && process.env.NODE_ENV === "production") return offlineReply(body.messages, voice);

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
        channel: voice ? "voice" : "text",
      }),
      signal: req.signal,
      cache: "no-store",
    });
  } catch {
    // service unreachable → quick answers from the site's content; the free question is given back
    await refundAiQuestion("assistant", visitor);
    if (req.signal.aborted) return NextResponse.json({ error: "aborted" }, { status: 499 });
    return offlineReply(body.messages, voice);
  }
  if (!upstream.ok || !upstream.body) {
    await refundAiQuestion("assistant", visitor);
    if (upstream.status === 422) return NextResponse.json({ error: "invalid" }, { status: 422 });
    return offlineReply(body.messages, voice);
  }
  return new Response(upstream.body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no", ...quotaHeaders },
  });
}
