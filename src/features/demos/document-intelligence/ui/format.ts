import type { DocDetail, Extraction } from "../types";

/** ₹ with Indian digit grouping: 217356 → ₹2,17,356 */
export function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The export a downstream system would receive: typed values, human edits applied, sources kept. */
export function fieldsExport(doc: DocDetail, x: Extraction, edits: Record<string, string>) {
  return {
    document: { id: doc.id, title: doc.title, type: x.type },
    fields: Object.fromEntries(x.fields.map((f) => [f.key, f.key in edits ? edits[f.key] : f.value])),
    lineItems: x.lineItems.map(({ description, hsn, qty, rate, amount }) => ({ description, hsn: hsn || null, qty, rate, amount })),
    review: Object.fromEntries(
      x.fields.map((f) => [f.key, { status: f.key in edits ? "edited" : f.confidence, page: f.source?.page ?? null, quote: f.source?.quote ?? null }]),
    ),
  };
}
