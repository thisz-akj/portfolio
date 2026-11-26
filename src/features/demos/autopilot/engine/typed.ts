import type { Choice } from "../types";
import type { Ctx, ReadKind } from "./ctx";
import { missing, readLead, readReply, readService, valid, type Fields } from "./read";

const RULES: Record<ReadKind, (t: string) => Fields> = { lead: readLead, service: readService, reply: readReply };

/**
 * Fields from a typed answer. Rules read it first; fields are stored on the choice (so the browser sends
 * them back and nothing is read twice). If rules miss a required field and the model hasn't been tried
 * for this text yet, the run flags it; the route may ask the model once and rerun.
 */
export function readTyped(ctx: Ctx, id: string, kind: ReadKind, c: Choice): Fields {
  if (!("text" in c)) return {};
  if (!c.fields) {
    const f = RULES[kind](c.text);
    c.fields = { ...f, _s: "a" };
    ctx.choices[id] = c;
  }
  const f = valid(kind, c.fields);
  if (c.fields._s === "a" && missing(kind, f).length && !ctx.needsModel) ctx.needsModel = { choiceId: id, kind, text: c.text };
  return f;
}

/** Fields without bookkeeping keys or empty values. */
export const clean = (f: Fields) => Object.fromEntries(Object.entries(f).filter(([k, v]) => !k.startsWith("_") && v));
