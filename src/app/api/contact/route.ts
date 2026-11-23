import { NextResponse } from "next/server";
import { validateContact } from "@/lib/contact";

/**
 * Contact endpoint.
 * Delivery is provider-agnostic: set CONTACT_WEBHOOK_URL (e.g. a Slack/Discord/Make/Zapier webhook
 * or your own mail relay). Without it the endpoint validates and answers 503 so the UI can fall back
 * to a mailto link — no message is silently dropped.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>(); // best-effort, per instance

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "Too many messages — please try again later." }, { status: 429 });
  }

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 20_000) return NextResponse.json({ ok: false, error: "Message too large." }, { status: 413 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const result = validateContact(body);
  if (!result.ok) return NextResponse.json({ ok: false, errors: result.errors }, { status: 422 });
  // Honeypot: pretend success for bots.
  if (result.data.website) return NextResponse.json({ ok: true });

  const webhook = process.env.CONTACT_WEBHOOK_URL;
  if (!webhook) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }

  const { name, email, company, type, message } = result.data;
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `New project enquiry — ${type}\nFrom: ${name} <${email}>${company ? ` (${company})` : ""}\n\n${message}`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`webhook ${res.status}`);
  } catch (err) {
    // Log metadata only — never the message content.
    console.error("contact delivery failed", { type, error: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json({ ok: false, error: "delivery-failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
