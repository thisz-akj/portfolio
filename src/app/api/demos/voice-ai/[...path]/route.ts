import { NextResponse } from "next/server";
import { refundAiQuestion, takeAiQuestion, visitorFromHeaders } from "@/lib/aiQuota";

/** Vercel function time limit (s): long enough for streamed answers and uploads. */
export const maxDuration = 60;

/**
 * Proxy to the Front Desk Voice service (voice/, FastAPI). Keeps the service private, allow-lists paths,
 * rate-limits, counts free live calls per visitor ("voice-call") and caps speech clips per visitor per day.
 * Questions about Azad on the voice demo go through /api/assistant (its own free-question quota).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM = process.env.VOICE_URL ?? "http://127.0.0.1:8003";
const MAX_CLIP = 1_000_000;
const CLIPS_PER_DAY = Math.max(10, Number(process.env.VOICE_CLIPS_PER_DAY ?? 80) || 80);
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 150;
const hits = new Map<string, number[]>();
const clips = new Map<string, number>();
let clipDay = "";

const ID = "[A-Za-z0-9_-]{6,40}";
const CALL = new RegExp(`^calls/${ID}$`);
const TURN = new RegExp(`^calls/${ID}/turn$`);

const json = (status: number, code: string, message?: string, headers?: Record<string, string>) =>
  NextResponse.json({ detail: { code, message } }, { status, headers });

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

function takeClip(ip: string) {
  const d = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  if (d !== clipDay) {
    clipDay = d;
    clips.clear();
  }
  const n = clips.get(ip) ?? 0;
  if (n >= CLIPS_PER_DAY) return false;
  clips.set(ip, n + 1);
  return true;
}

const auth = (): Record<string, string> => (process.env.VOICE_TOKEN ? { "x-voice-token": process.env.VOICE_TOKEN } : {});

async function upstream(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 20_000, ...rest } = init;
  return fetch(`${UPSTREAM}/${path}`, {
    ...rest,
    headers: { ...auth(), ...(rest.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
}

function passThrough(res: Response, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { "cache-control": "no-store", ...extra };
  const ct = res.headers.get("content-type");
  if (ct) headers["content-type"] = ct;
  return new Response(res.body, { status: res.status, headers });
}

const offline = () => json(503, "offline", "Live calls are offline right now. The sample calls still play.");

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  if (path !== "health" && !CALL.test(path)) return json(404, "not_found");
  if (rateLimited(visitorFromHeaders(req.headers))) return json(429, "rate_limited", "Too many requests. Try again in a few minutes.");
  try {
    return passThrough(await upstream(path, { timeoutMs: 5_000 }));
  } catch {
    return offline();
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  const ip = visitorFromHeaders(req.headers);
  if (rateLimited(ip)) return json(429, "rate_limited", "Too many requests. Try again in a few minutes.");

  // A new live call: counted per visitor per day.
  if (path === "calls") {
    const quota = await takeAiQuestion("voice-call", ip);
    const qh = { "x-ai-remaining": String(quota.remaining), "x-ai-limit": String(quota.limit) };
    if (!quota.ok) return json(429, "quota", "Free live calls for today are used up.", qh);
    try {
      const res = await upstream("calls", { method: "POST", timeoutMs: 8_000 });
      if (!res.ok) await refundAiQuestion("voice-call", ip);
      return passThrough(res, qh);
    } catch {
      await refundAiQuestion("voice-call", ip);
      return offline();
    }
  }

  if (TURN.test(path)) {
    if (Number(req.headers.get("content-length") ?? 0) > 4_000) return json(413, "too_large");
    let body: { text?: unknown };
    try {
      body = await req.json();
    } catch {
      return json(400, "invalid");
    }
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 400) : "";
    if (!text) return json(422, "invalid");
    try {
      const res = await upstream(path, { method: "POST", body: JSON.stringify({ text }), headers: { "content-type": "application/json" } });
      return passThrough(res);
    } catch {
      return offline();
    }
  }

  // One caller clip → text (both lines).
  if (path === "transcribe") {
    if (Number(req.headers.get("content-length") ?? 0) > MAX_CLIP + 16_000) return json(413, "too_long", "That was too long. Keep each turn short.");
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json(400, "invalid");
    }
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0) return json(400, "empty", "No audio received.");
    if (audio.size > MAX_CLIP) return json(413, "too_long", "That was too long. Keep each turn short.");
    if (!takeClip(ip)) return json(429, "quota", "Voice input for today is used up. You can still type.");
    const out = new FormData();
    out.set("audio", audio, "clip.wav");
    out.set("hint", form.get("hint") === "about" ? "about" : "clinic");
    try {
      return passThrough(await upstream("transcribe", { method: "POST", body: out, timeoutMs: 15_000 }));
    } catch {
      return json(503, "no_speech", "Voice input is offline right now. You can type instead.");
    }
  }

  return json(404, "not_found");
}
