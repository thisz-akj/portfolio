/** Wire format shared with the Python service (assistant/app/main.py): NDJSON, one event per line. */

export type AssistantMode = "live" | "offline" | "limit";

export type AssistantTopic = "projects" | "services" | "demos" | "background" | "contact" | "pricing" | "other";
export type AssistantRoute = "answered" | "handoff" | "off_topic";

/** Support-style triage of one answer (assistant/app/triage.py). */
export interface AssistantTrace {
  topic: AssistantTopic;
  route: AssistantRoute;
  sources: { path: string; label: string }[];
  mode: AssistantMode;
  ttft_ms: number;
  total_ms: number;
}

export type AssistantEvent =
  | { type: "meta"; mode: AssistantMode }
  | ({ type: "trace" } & AssistantTrace)
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const MAX_USER_CHARS = 1000;
export const MAX_MESSAGES = 40;

export function parseEvent(line: string): AssistantEvent | null {
  try {
    const e = JSON.parse(line) as AssistantEvent;
    if (e && typeof e === "object" && typeof e.type === "string") return e;
  } catch {
    /* ignore malformed line */
  }
  return null;
}

/** Splits a byte stream into events; tolerant of chunks that end mid-line. */
export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (e: AssistantEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      const e = line ? parseEvent(line) : null;
      if (e) onEvent(e);
    }
    if (done) break;
  }
  const rest = buffer.trim() ? parseEvent(buffer.trim()) : null;
  if (rest) onEvent(rest);
}

/** Request validation used by the Next.js proxy before anything reaches Python. */
export function validChat(body: unknown): body is { messages: ChatMessage[] } {
  if (!body || typeof body !== "object") return false;
  const msgs = (body as { messages?: unknown }).messages;
  if (!Array.isArray(msgs) || msgs.length === 0 || msgs.length > MAX_MESSAGES) return false;
  return msgs.every(
    (m) =>
      m &&
      typeof m === "object" &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0 &&
      m.content.length <= (m.role === "user" ? MAX_USER_CHARS : 4000),
  ) && msgs[msgs.length - 1].role === "user";
}
