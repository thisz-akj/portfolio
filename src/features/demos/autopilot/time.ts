/** IST clock helpers for the simulated runs (no time-zone dependence: everything is shifted to IST and read as UTC). */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const IST = 5.5 * 3600_000;

/** A Date whose UTC fields read as IST wall-clock time. */
export const istAt = (startIso: string, minutes: number) => new Date(Date.parse(startIso) + minutes * 60_000 + IST);

export const hhmm = (d: Date) => {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

export const dayLabel = (d: Date) => `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;

/** "Tue 24 Nov · 10:12 am" */
export const stamp = (startIso: string, minutes: number) => {
  const d = istAt(startIso, minutes);
  return `${dayLabel(d)} · ${hhmm(d)}`;
};

/** Minutes from start until the given IST wall-clock time on day offset `dayOffset` (0 = start day). */
export const minutesUntil = (startIso: string, dayOffset: number, hour: number, minute = 0) => {
  const s = istAt(startIso, 0);
  const startMin = s.getUTCHours() * 60 + s.getUTCMinutes();
  return dayOffset * 1440 + hour * 60 + minute - startMin;
};

export const weekday = (startIso: string, dayOffset: number) => istAt(startIso, dayOffset * 1440).getUTCDay();

export const elapsedLabel = (min: number) => {
  if (min < 60) return `${Math.max(1, Math.round(min))} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d} d ${rh} h` : `${d} d`;
};

export const DAY_NAMES = DAYS;
