import type { ContactInput } from "@/lib/contact";

/**
 * Email delivery for the contact form via Resend's REST API (no SDK dependency).
 * Builders are pure so they can be unit-tested; `sendEmail` is the only side effect.
 */

export interface EmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  reply_to?: string;
}

export interface MailConfig {
  apiKey: string;
  /** Where enquiries land. */
  to: string;
  /** Verified sender, e.g. "Azad Kumar Jha <hello@yourdomain.com>". */
  from: string;
  /** Send the visitor a confirmation. Needs a verified domain in Resend. */
  autoReply: boolean;
}

/** Reads mail config from env; returns null when email delivery isn't configured. */
export function mailConfigFromEnv(env: NodeJS.ProcessEnv, fallbackTo: string): MailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    to: env.CONTACT_TO_EMAIL?.trim() || fallbackTo,
    // Resend's shared test sender only delivers to your own Resend account address.
    from: env.CONTACT_FROM_EMAIL?.trim() || "Portfolio <onboarding@resend.dev>",
    autoReply: env.CONTACT_AUTOREPLY === "true",
  };
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Keeps user text out of header-like fields (subject/name). */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

const wrap = (inner: string) =>
  `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:600px">${inner}</div>`;

export function buildNotification(d: ContactInput, cfg: Pick<MailConfig, "from" | "to">): EmailPayload {
  const who = `${oneLine(d.name)}${d.company ? ` (${oneLine(d.company)})` : ""}`;
  const rows: [string, string][] = [
    ["Name", d.name],
    ["Email", d.email],
    ["Company", d.company || "—"],
    ["Project type", d.type],
  ];
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#666;white-space:nowrap">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return {
    from: cfg.from,
    to: [cfg.to],
    reply_to: d.email,
    subject: `New enquiry: ${oneLine(d.type)} from ${who}`,
    html: wrap(
      `<h2 style="margin:0 0 12px;font-size:18px">New project enquiry</h2>` +
        `<table style="border-collapse:collapse;margin-bottom:16px">${table}</table>` +
        `<div style="white-space:pre-wrap;padding:12px 14px;background:#f5f5f3;border-radius:8px">${escapeHtml(d.message)}</div>` +
        `<p style="color:#888;font-size:13px;margin-top:16px">Reply to this email to answer ${escapeHtml(oneLine(d.name))} directly.</p>`,
    ),
    text: `New project enquiry: ${d.type}\n\nName: ${d.name}\nEmail: ${d.email}\nCompany: ${d.company || "—"}\n\n${d.message}\n`,
  };
}

export function buildAutoReply(d: ContactInput, cfg: Pick<MailConfig, "from" | "to">): EmailPayload {
  const first = oneLine(d.name).split(" ")[0] || "there";
  return {
    from: cfg.from,
    to: [d.email],
    reply_to: cfg.to,
    subject: "Thanks, I got your message",
    html: wrap(
      `<p>Hi ${escapeHtml(first)},</p>` +
        `<p>Thanks for reaching out about <strong>${escapeHtml(d.type.toLowerCase())}</strong>. Your message reached me and I'll reply within two working days.</p>` +
        `<p>If anything else comes to mind (links, deadlines, constraints), just reply to this email.</p>` +
        `<p>Azad</p>` +
        `<hr style="border:none;border-top:1px solid #eee;margin:20px 0"><p style="color:#888;font-size:13px">Your message:</p>` +
        `<div style="white-space:pre-wrap;color:#555;font-size:14px">${escapeHtml(d.message)}</div>`,
    ),
    text: `Hi ${first},\n\nThanks for reaching out about ${d.type.toLowerCase()}. Your message reached me and I'll reply within two working days.\n\nIf anything else comes to mind, just reply to this email.\n\nAzad\n\n---\nYour message:\n${d.message}\n`,
  };
}

export async function sendEmail(apiKey: string, payload: EmailPayload): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    // Resend error bodies describe config problems (unverified domain etc.), never message content.
    const detail = await res.text().catch(() => "");
    throw new Error(`resend ${res.status} ${detail.slice(0, 200)}`);
  }
}
