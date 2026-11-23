import { NextResponse } from "next/server";
import { validateContact, type ContactInput } from "@/lib/contact";
import { buildAutoReply, buildNotification, mailConfigFromEnv, sendEmail } from "@/lib/mailer";
import { site } from "@/content/site";

/**
 * Contact endpoint.
 * - RESEND_API_KEY set → enquiry is emailed to CONTACT_TO_EMAIL (reply-to = visitor), plus an optional
 *   confirmation to the visitor (CONTACT_AUTOREPLY=true).
 * - CONTACT_WEBHOOK_URL set → Slack/Discord/Make ping (primary channel if email isn't configured).
 * - Neither → 503 so the UI falls back to a mailto link. No message is silently dropped.
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

  const data = result.data;
  const mail = mailConfigFromEnv(process.env, site.email);
  const webhook = process.env.CONTACT_WEBHOOK_URL;
  if (!mail && !webhook) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 503 });
  }

  // Primary channel: email if configured, otherwise the webhook. Failure here → 502 → UI mailto fallback.
  try {
    if (mail) await sendEmail(mail.apiKey, buildNotification(data, mail));
    else await postWebhook(webhook!, data);
  } catch (err) {
    // Log metadata only — never the message content.
    console.error("contact delivery failed", { type: data.type, error: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json({ ok: false, error: "delivery-failed" }, { status: 502 });
  }

  // Best-effort extras: the enquiry is already delivered, so these never fail the request.
  const extras: Promise<void>[] = [];
  if (mail?.autoReply) extras.push(sendEmail(mail.apiKey, buildAutoReply(data, mail)));
  if (mail && webhook) extras.push(postWebhook(webhook, data));
  for (const r of await Promise.allSettled(extras)) {
    if (r.status === "rejected") console.warn("contact extra failed", { error: r.reason instanceof Error ? r.reason.message : "unknown" });
  }
  return NextResponse.json({ ok: true });
}

async function postWebhook(url: string, d: ContactInput) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: `New project enquiry — ${d.type}\nFrom: ${d.name} <${d.email}>${d.company ? ` (${d.company})` : ""}\n\n${d.message}`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`webhook ${res.status}`);
}
