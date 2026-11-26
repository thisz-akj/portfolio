import { NextResponse } from "next/server";
import { refundAiQuestion, takeAiQuestion, visitorFromHeaders } from "@/lib/aiQuota";
import { snapshotLookup } from "@/features/demos/document-intelligence/snapshot.server";

/** Vercel function time limit (s): long enough for streamed answers and uploads. */
export const maxDuration = 60;

/**
 * Proxy to the DocDesk service (docintel/, FastAPI). Keeps the service private, allow-lists paths,
 * rate-limits, and counts free questions / uploads per visitor. When the service is unreachable, read-only
 * sample data is served from a build-time snapshot so the library, fields, checks, compare and examples still work.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM = process.env.DOCINTEL_URL ?? "http://127.0.0.1:8002";
const MAX_UPLOAD = 2 * 1024 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 120;
const hits = new Map<string, number[]>();

const ID = "[A-Za-z0-9_-]{1,40}";
const GET_PATHS = [
  /^documents$/,
  new RegExp(`^documents/${ID}$`),
  new RegExp(`^documents/${ID}/extract$`),
  new RegExp(`^documents/${ID}/pages/\\d{1,3}$`),
  /^compare$/,
  /^review$/,
  /^quality$/,
  /^limits$/,
  /^health$/,
];
const ASK = new RegExp(`^documents/(${ID})/ask$`);

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

const auth = (): Record<string, string> => (process.env.DOCINTEL_TOKEN ? { "x-docintel-token": process.env.DOCINTEL_TOKEN } : {});

async function upstream(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 25_000, ...rest } = init;
  return fetch(`${UPSTREAM}/${path}`, {
    ...rest,
    headers: { ...auth(), ...(rest.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
}

function passThrough(res: Response, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extra };
  for (const h of ["content-type", "cache-control"]) {
    const v = res.headers.get(h);
    if (v) headers[h] = v;
  }
  return new Response(res.body, { status: res.status, headers });
}

const offline = () => NextResponse.json({ detail: { code: "offline", message: "Live answers are offline right now — the examples still work." } }, { status: 503 });

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  if (!GET_PATHS.some((re) => re.test(path))) return NextResponse.json({ detail: { code: "not_found" } }, { status: 404 });
  const ip = visitorFromHeaders(req.headers);
  if (rateLimited(ip)) return NextResponse.json({ detail: { code: "rate_limited", message: "Too many requests — try again in a few minutes." } }, { status: 429 });
  const qs = new URL(req.url).search;
  try {
    const res = await upstream(path + qs, { timeoutMs: 8_000 });
    if (res.status < 500) return passThrough(res);
  } catch {
    /* fall through to the snapshot */
  }
  const snap = await snapshotLookup(path, new URL(req.url).searchParams);
  if (snap === undefined) return offline();
  if (snap instanceof Response) return snap;
  return NextResponse.json(snap, { headers: { "x-docdesk-snapshot": "1" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  const ip = visitorFromHeaders(req.headers);
  if (rateLimited(ip)) return NextResponse.json({ detail: { code: "rate_limited", message: "Too many requests — try again in a few minutes." } }, { status: 429 });

  // Upload: 1-page PDFs (demo limit), counted per visitor per day.
  if (path === "documents") {
    if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD + 64_000) {
      return NextResponse.json({ detail: { code: "too_large", message: "That file is too large for the demo (2 MB max)." } }, { status: 413 });
    }
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ detail: { code: "invalid", message: "Upload a PDF file." } }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ detail: { code: "invalid", message: "Upload a PDF file." } }, { status: 400 });
    if (file.size > MAX_UPLOAD) return NextResponse.json({ detail: { code: "too_large", message: "That file is too large for the demo (2 MB max)." } }, { status: 413 });
    const quota = await takeAiQuestion("docdesk-upload", ip);
    const qh = { "x-ai-remaining": String(quota.remaining), "x-ai-limit": String(quota.limit) };
    if (!quota.ok) return NextResponse.json({ detail: { code: "quota", message: "Free uploads for today are used up." } }, { status: 429, headers: qh });
    const out = new FormData();
    out.set("file", file, file.name.slice(0, 120) || "document.pdf");
    try {
      const res = await upstream("documents", { method: "POST", body: out, timeoutMs: 45_000 });
      if (!res.ok) await refundAiQuestion("docdesk-upload", ip);
      return passThrough(res, qh);
    } catch {
      await refundAiQuestion("docdesk-upload", ip);
      return offline();
    }
  }

  const ask = ASK.exec(path);
  if (!ask) return NextResponse.json({ detail: { code: "not_found" } }, { status: 404 });
  if (Number(req.headers.get("content-length") ?? 0) > 32_000) return NextResponse.json({ detail: { code: "too_large" } }, { status: 413 });
  let body: { question?: unknown; history?: unknown; example?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: { code: "invalid" } }, { status: 400 });
  }
  const example = typeof body.example === "number" && Number.isInteger(body.example) ? body.example : null;
  const payload = JSON.stringify(
    example !== null
      ? { example }
      : {
          question: typeof body.question === "string" ? body.question.slice(0, 500) : "",
          history: Array.isArray(body.history)
            ? body.history
                .filter((m): m is { role: string; content: string } => !!m && typeof m === "object" && typeof (m as { content?: unknown }).content === "string")
                .slice(-6)
                .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content.slice(0, 1500) }))
            : [],
        },
  );

  // Pre-written examples never touch a model → no quota.
  if (example !== null) {
    try {
      const res = await upstream(path, { method: "POST", body: payload, headers: { "content-type": "application/json" }, timeoutMs: 8_000 });
      if (res.status < 500) return passThrough(res);
    } catch {
      /* snapshot */
    }
    const snap = await snapshotLookup(path, new URLSearchParams({ example: String(example) }));
    return snap === undefined || snap instanceof Response ? offline() : NextResponse.json(snap);
  }

  const quota = await takeAiQuestion("docdesk-ask", ip);
  const qh = { "x-ai-remaining": String(quota.remaining), "x-ai-limit": String(quota.limit) };
  if (!quota.ok) return NextResponse.json({ detail: { code: "quota", message: "Free questions for today are used up." } }, { status: 429, headers: qh });
  try {
    const res = await upstream(path, { method: "POST", body: payload, headers: { "content-type": "application/json" } });
    if (!res.ok) {
      await refundAiQuestion("docdesk-ask", ip);
      return passThrough(res, qh);
    }
    const data = (await res.json()) as { mode?: string; cached?: boolean; busy?: boolean };
    // Answers that cost nothing (cache, matched example, passages fallback) don't use up a free question.
    const free = data.cached || data.mode === "example" || data.mode === "passages";
    if (free) await refundAiQuestion("docdesk-ask", ip);
    const remaining = free ? quota.remaining + 1 : quota.remaining;
    return NextResponse.json(data, { headers: { "x-ai-remaining": String(remaining), "x-ai-limit": String(quota.limit), "cache-control": "no-store" } });
  } catch (err) {
    console.error("[docdesk] ask failed:", err);
    await refundAiQuestion("docdesk-ask", ip);
    return offline();
  }
}
