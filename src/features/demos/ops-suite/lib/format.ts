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
