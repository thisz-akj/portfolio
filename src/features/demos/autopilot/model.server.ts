import { AREAS, PRODUCTS, PROBLEMS } from "./engine/data";
import type { ReadKind } from "./engine/ctx";
import type { Fields } from "./engine/read";

/**
 * Reads a visitor's typed message into fields when rules missed something (Groq, strict JSON schema,
 * ≤200 output tokens). Server-only. Returns null when there's no key, the models are busy or the
 * daily cap is used; the flow then asks the customer a follow-up question instead.
 */

const URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];
const TIMEOUT_MS = 12_000;
const DAILY_LIMIT = Math.max(0, Number(process.env.AUTOPILOT_DAILY_LIMIT ?? 200) || 0);

let day = "";
let calls = 0;

const DAYS = ["today", "tomorrow", "dayafter", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "nextweek", "none"];

const SCHEMAS: Record<ReadKind, { prompt: string; schema: object }> = {
  lead: {
    prompt: `A customer messaged a packaging supplier on WhatsApp. Products: ${PRODUCTS.map((p) => `${p.key} = ${p.name}`).join("; ")}. Return the product key they want ("none" if unclear), the quantity as a number (0 if not given), when they need it as a day word ("none" if not given) and their name ("" if not given). Copy only what the message says.`,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["product", "qty", "by", "name"],
      properties: { product: { type: "string", enum: [...PRODUCTS.map((p) => p.key), "none"] }, qty: { type: "integer" }, by: { type: "string", enum: DAYS }, name: { type: "string" } },
    },
  },
  service: {
    prompt: `A customer messaged an AC repair company in Bengaluru. Problems: ${Object.entries(PROBLEMS).map(([k, v]) => `${k} = ${v.label}`).join("; ")}. Areas: ${AREAS.map((a) => a.name).join(", ")}. Return the problem key, the area (nearest listed one only if they name a place in or next to it, else "none") and when they want the visit. Use "none" when not given.`,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["problem", "area", "when"],
      properties: {
        problem: { type: "string", enum: [...Object.keys(PROBLEMS), "none"] },
        area: { type: "string", enum: [...AREAS.map((a) => a.name), "none"] },
        when: { type: "string", enum: ["today-asap", "today-afternoon", "today-evening", "tomorrow-morning", "tomorrow-evening", "none"] },
      },
    },
  },
  reply: {
    prompt: `A patient replied to a clinic's reminder about tomorrow's appointment. Intent: confirm (will come), cancel (can't come), move (wants another day/time), or none (unclear or unrelated). Day: the day they ask for, or "none".`,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["intent", "day"],
      properties: { intent: { type: "string", enum: ["confirm", "cancel", "move", "none"] }, day: { type: "string", enum: DAYS } },
    },
  },
};

const models = () => {
  const fromEnv = (process.env.AUTOPILOT_GROQ_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_MODELS;
};

export const modelAvailable = () => Boolean(process.env.GROQ_API_KEY) && DAILY_LIMIT > 0;

function takeDaily() {
  const d = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  if (d !== day) {
    day = d;
    calls = 0;
  }
  if (calls >= DAILY_LIMIT) return false;
  calls++;
  return true;
}

export async function readWithModel(kind: ReadKind, text: string): Promise<Fields | null> {
  if (!modelAvailable() || !takeDaily()) return null;
  const { prompt, schema } = SCHEMAS[kind];
  for (const model of models()) {
    try {
      const res = await fetch(URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_completion_tokens: 200,
          reasoning_effort: "low",
          response_format: { type: "json_schema", json_schema: { name: kind, strict: true, schema } },
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: text.slice(0, 500) },
          ],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.status === 401) return null;
      if (!res.ok) continue;
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as Record<string, string | number>;
      const out: Fields = {};
      for (const [k, v] of Object.entries(raw)) {
        if (v === "none" || v === "" || v === 0) continue;
        out[k] = String(v).slice(0, 60);
      }
      return out;
    } catch {
      continue;
    }
  }
  return null;
}
