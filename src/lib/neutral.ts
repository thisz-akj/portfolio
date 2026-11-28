/**
 * The assistant must refer to Azad by name, never he/she/him/his (no pronouns are given in about.md),
 * but models slip. Rewrites those pronouns to "Azad"/"Azad's" in finished text. Used by the site chat and
 * support demo (AssistantMessage) and the voice demo's "Ask about Azad" line (speech.ts).
 */
export function neutral(text: string, name = "Azad"): string {
  const cap = (w: string, r: string) => (w[0] === w[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r);
  return text
    .replace(/\b(himself|herself)\b/gi, name)
    .replace(/\b(his|her)\b(?=\s+[a-z])/gi, () => `${name}'s`)
    .replace(/\b(he|she|him|her)\b/gi, (w) => cap(w, name));
}
