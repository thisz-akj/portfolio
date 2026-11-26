import { readEvents } from "@/features/assistant/protocol";

export const VOICE_API = "/api/demos/voice-ai";

export interface SlotView {
  doctor: string;
  start: string;
  label: string;
}

export interface CallEvent {
  t: number;
  kind: "understood" | "checked" | "booked" | "sms" | "answered" | "request" | "handoff" | "ended" | "changed" | "updated";
  text: string;
}

export interface CallSummary {
  outcome: "booked" | "handoff" | "request" | "info" | "incomplete" | "in-progress";
  patient: string | null;
  doctor: string | null;
  slot: SlotView | null;
  reason: string | null;
  requests: string[];
  flags: string[];
  turns: number;
  text: string;
}

export interface CallView {
  id: string;
  reply: string | null;
  ended: boolean;
  awaiting: string;
  offered: SlotView[];
  booking: SlotView | null;
  events: CallEvent[];
  summary: CallSummary;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function check<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  const body = (await res.json().catch(() => null)) as { detail?: { code?: string; message?: string } } | null;
  throw new ApiError(res.status, body?.detail?.code ?? "error", body?.detail?.message ?? "Something went wrong. Please try again.");
}

export const startCall = () => fetch(`${VOICE_API}/calls`, { method: "POST" }).then((r) => check<CallView>(r));

export const sendTurn = (id: string, text: string) =>
  fetch(`${VOICE_API}/calls/${id}/turn`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  }).then((r) => check<CallView>(r));

export async function transcribe(wav: Blob, hint: "clinic" | "about"): Promise<{ text: string; ms: number }> {
  const form = new FormData();
  form.set("audio", wav, "clip.wav");
  form.set("hint", hint);
  return check(await fetch(`${VOICE_API}/transcribe`, { method: "POST", body: form }));
}

export interface AskTurn {
  role: "user" | "assistant";
  content: string;
}

/** Ask the site assistant for a short spoken answer; `onText` gets text as it streams. */
export async function askAboutAzad(history: AskTurn[], onText: (t: string) => void, signal?: AbortSignal): Promise<{ remaining: number | null }> {
  const res = await fetch("/api/assistant", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: history.slice(-6), channel: "voice" }),
    signal,
  });
  const left = res.headers.has("x-ai-remaining") ? Number(res.headers.get("x-ai-remaining")) : null;
  if (res.status === 429) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(429, body?.error === "quota" ? "quota" : "rate_limited", "Free questions for today are used up.");
  }
  if (!res.ok || !res.body) throw new ApiError(res.status, "error", "The assistant isn't available right now.");
  await readEvents(res.body, (e) => {
    if (e.type === "delta") onText(e.text);
    else if (e.type === "error") onText(" " + e.message);
  });
  return { remaining: left };
}
