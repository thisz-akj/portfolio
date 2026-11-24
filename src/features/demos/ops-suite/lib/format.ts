/** Indian number formatting shared by the seed (audit summaries) and the portal UI. */

const inrFull = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const trim = (n: number) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace(/\.?0+$/, "");

/** ₹12,40,000 · ₹12,40,000.50 (paise) · ₹12.4L / ₹1.25Cr (compact). */
export function formatINR(value: number, opts: { compact?: boolean; paise?: boolean } = {}): string {
  if (opts.compact) {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
    if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
    if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`;
    return `${sign}₹${Math.round(abs)}`;
  }
  return (opts.paise ? inrPaise : inrFull).format(value);
}

/** Parses "12,40,000", "12.4L", "1.25 cr", "45k" or "₹5 lakh" into rupees; null if not a number. */
export function parseAmount(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/[₹,\s]/g, "").replace(/^rs\.?/, "");
  const m = s.match(/^(-?\d+(?:\.\d+)?)(k|l|lac|lakh|lakhs|cr|crore|crores)?$/);
  if (!m) return null;
  const mult = !m[2] ? 1 : m[2] === "k" ? 1e3 : m[2].startsWith("c") ? 1e7 : 1e5;
  return Math.round(Number(m[1]) * mult * 100) / 100;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const dateOnlyFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "24 Nov 2026" from a Date (shown in IST) or a YYYY-MM-DD string (calendar date, no shift). */
export function formatDate(v: Date | string | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return /^\d{4}-\d{2}-\d{2}$/.test(v) ? dateOnlyFmt.format(new Date(`${v}T00:00:00Z`)) : dateFmt.format(new Date(v));
  return dateFmt.format(v);
}
