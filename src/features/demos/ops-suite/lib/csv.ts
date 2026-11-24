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
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
