import type { DatePreset } from "./types";

/**
 * Date presets resolved in India Standard Time with the Indian financial year (April–March, FY quarters
 * Q1 Apr–Jun … Q4 Jan–Mar). Ranges are half-open: from ≤ d < to, as YYYY-MM-DD strings.
 */

export const TZ = "Asia/Kolkata";
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Today's date in IST as YYYY-MM-DD. */
export const todayIST = (now = new Date()) => ymd.format(now);

const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => fmt(new Date(parse(s).getTime() + n * 86_400_000));
const monthStart = (y: number, m: number) => fmt(new Date(Date.UTC(y, m, 1))); // m may overflow; Date normalises

export interface DateRange {
  from?: string;
  to?: string;
}

export function presetRange(preset: DatePreset, now = new Date()): DateRange {
  const today = todayIST(now);
  const t = parse(today);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth(); // 0 = Jan
  const fyStartYear = m >= 3 ? y : y - 1;
  const qStartMonth = 3 + Math.floor(((m - 3 + 12) % 12) / 3) * 3; // months since Apr, bucketed
  const qStart = monthStart(fyStartYear, qStartMonth);
  switch (preset) {
    case "today":
      return { from: today, to: addDays(today, 1) };
    case "yesterday":
      return { from: addDays(today, -1), to: today };
    case "last_7_days":
      return { from: addDays(today, -6), to: addDays(today, 1) };
    case "last_30_days":
      return { from: addDays(today, -29), to: addDays(today, 1) };
    case "last_90_days":
      return { from: addDays(today, -89), to: addDays(today, 1) };
    case "this_month":
      return { from: monthStart(y, m), to: monthStart(y, m + 1) };
    case "last_month":
      return { from: monthStart(y, m - 1), to: monthStart(y, m) };
    case "this_quarter":
      return { from: qStart, to: monthStart(fyStartYear, qStartMonth + 3) };
    case "last_quarter":
      return { from: monthStart(fyStartYear, qStartMonth - 3), to: qStart };
    case "this_fy":
      return { from: monthStart(fyStartYear, 3), to: monthStart(fyStartYear + 1, 3) };
    case "last_fy":
      return { from: monthStart(fyStartYear - 1, 3), to: monthStart(fyStartYear, 3) };
    case "next_7_days":
      return { from: today, to: addDays(today, 7) };
    case "next_30_days":
      return { from: today, to: addDays(today, 30) };
    case "past":
      return { to: today };
    case "future":
      return { from: addDays(today, 1) };
  }
}

export { addDays as addDaysISO };
