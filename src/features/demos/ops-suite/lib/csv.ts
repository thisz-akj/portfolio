/**
 * RFC 4180 CSV with a UTF-8 BOM (so Excel shows ₹ and Indian names correctly).
 * Cells that start with = + - @ (or tab/CR) are prefixed with ' to stop spreadsheet formula injection;
 * plain numbers are left as numbers.
 */
export function toCsv(header: string[], rows: unknown[][]): string {
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
    let s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join("; ") : String(v);
    // formula-injection guard; plain numbers like -4 or +91 98765 are data, not formulas
    if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d[\d\s.,]*$/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export const CSV_LIMITS = { bytes: 1_000_000, rows: 5000, columns: 50, cell: 1000 } as const;

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/**
 * RFC 4180 parser: quoted fields, "" escapes, commas/newlines inside quotes, CRLF or LF, optional BOM.
 * Detects ; or tab as the delimiter when the header has no commas (European Excel exports).
 * Blank lines are skipped. Throws with a readable message when limits are exceeded or quotes are unbalanced.
 */
export function parseCsv(input: string): ParsedCsv {
  if (input.length > CSV_LIMITS.bytes) throw new Error(`File is larger than ${CSV_LIMITS.bytes / 1_000_000} MB`);
  const text = input.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const delim = firstLine.includes(",") ? "," : firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let i = 0;
  const pushCell = () => {
    if (cell.length > CSV_LIMITS.cell) throw new Error(`A cell on row ${out.length + 1} is longer than ${CSV_LIMITS.cell} characters`);
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    if (row.length > CSV_LIMITS.columns) throw new Error(`More than ${CSV_LIMITS.columns} columns`);
    if (row.some((c) => c.trim() !== "")) out.push(row);
    if (out.length > CSV_LIMITS.rows + 1) throw new Error(`More than ${CSV_LIMITS.rows.toLocaleString("en-IN")} rows`);
    row = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else cell += ch;
      i++;
      continue;
    }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) pushCell();
    else if (ch === "\n" || ch === "\r") {
      pushRow();
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else cell += ch;
    i++;
  }
  if (quoted) throw new Error("A quoted value is never closed");
  if (cell !== "" || row.length) pushRow();
  if (!out.length) throw new Error("The file is empty");
  const headers = out[0].map((h) => h.trim());
  if (headers.some((h) => !h)) throw new Error("Every column needs a header");
  if (new Set(headers.map((h) => h.toLowerCase())).size !== headers.length) throw new Error("Column headers must be unique");
  return { headers, rows: out.slice(1).map((r) => headers.map((_, j) => (r[j] ?? "").trim())) };
}
