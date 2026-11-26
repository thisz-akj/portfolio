import { AREAS, PRODUCTS, PROBLEMS } from "./data";

/**
 * Rules that read a customer's message into fields (0 tokens). The model is only asked when these
 * miss a required field in text the visitor typed themselves.
 */

export type Fields = Record<string, string>;

const norm = (t: string) => t.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

const DAY_WORDS: [RegExp, string][] = [
  [/\bday after tomorrow\b/, "dayafter"],
  [/\b(?:today|tonight|this evening|this afternoon|asap|urgent(?:ly)?|right now)\b/, "today"],
  [/\b(?:tomorrow|tmrw|tmr|kal)\b/, "tomorrow"],
  [/\bmon(?:day)?\b/, "monday"],
  [/\btue(?:s|sday)?\b/, "tuesday"],
  [/\bwed(?:nesday)?\b/, "wednesday"],
  [/\bthu(?:r|rs|rsday)?\b/, "thursday"],
  [/\bfri(?:day)?\b/, "friday"],
  [/\bsat(?:urday)?\b/, "saturday"],
  [/\bsun(?:day)?\b/, "sunday"],
  [/\bnext week\b/, "nextweek"],
];

export function readDay(text: string): string | undefined {
  const t = norm(text);
  for (const [re, v] of DAY_WORDS) if (re.test(t)) return v;
  return undefined;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Day word → offset in days from a start weekday (0 = Sun). Weekdays mean the next one (today counts if `allowToday`). */
export function dayOffset(word: string, startWeekday: number, allowToday = false): number | undefined {
  if (word === "today") return 0;
  if (word === "tomorrow") return 1;
  if (word === "dayafter") return 2;
  if (word === "nextweek") return 7 - startWeekday + 1; // next Monday
  const i = WEEKDAYS.indexOf(word);
  if (i < 0) return undefined;
  const d = (i - startWeekday + 7) % 7;
  return d === 0 && !allowToday ? 7 : d;
}

// ---- Lead (packaging enquiry) ----

const NUMBER_WORDS: Record<string, number> = { hundred: 100, thousand: 1000, "one thousand": 1000, "two hundred": 200, "five hundred": 500 };

export function readLead(text: string): Fields {
  const t = norm(text);
  const f: Fields = {};
  const p = PRODUCTS.find((x) => x.aliases.some((re) => re.test(t)));
  if (p) f.product = p.key;

  // Remove sizes, ply counts, GSM, phone numbers and prices before looking for a quantity.
  const q = t
    .replace(/\+?\d[\d\s-]{8,}\d/g, " ")
    .replace(/\d+(?:\.\d+)?\s*[x×*]\s*\d+(?:\.\d+)?(?:\s*[x×*]\s*\d+(?:\.\d+)?)?/g, " ")
    .replace(/\d+\s*-?\s*ply\b/g, " ")
    .replace(/\d+\s*(?:in|inch|inches|"|cm|mm|gsm)\b/g, " ")
    .replace(/(?:₹|rs\.?|inr)\s*\d[\d,]*/g, " ")
    .replace(/\d[\d,]*\s*(?:rs|rupees|\/-)/g, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/g, " ")
    .replace(/\b\d{1,2}(?:st|nd|rd|th)\b/g, " ");
  const m = q.match(/\b(\d{1,3}(?:,\d{3})+|\d{1,6})(\s*k\b)?/);
  if (m) {
    let n = Number(m[1].replace(/,/g, ""));
    if (m[2]) n *= 1000;
    if (n > 0) f.qty = String(n);
  } else {
    for (const [w, n] of Object.entries(NUMBER_WORDS).sort((a, b) => b[0].length - a[0].length)) {
      if (t.includes(w)) {
        f.qty = String(n);
        break;
      }
    }
  }
  const day = readDay(t);
  if (day) f.by = day;

  const sig = text.match(/(?:[-—–]\s*|this is |i am |i'm |my name is )([A-Z][a-z]+(?: [A-Z][a-z]+)?)(?:,\s*([A-Z][\w&.]*(?: [A-Z][\w&.]*){0,3}))?/);
  if (sig) {
    f.name = sig[1];
    if (sig[2]) f.company = sig[2];
  }
  return f;
}

// ---- Service request (AC) ----

const PROBLEM_RULES: [RegExp, string][] = [
  [/\b(?:not|no|isn't|isnt|stopped|less|poor|weak)\b.{0,15}\bcool|\bwarm air\b|\bhot air\b|\bnot cold\b/, "cooling"],
  [/\bleak|\bwater\b|\bdrip/, "leak"],
  [/\bnois|\bsound|\brattl|\bvibrat/, "noise"],
  [/\b(?:not|won't|wont|doesn't|doesnt)\b.{0,12}\b(?:turn|switch|start|power)|\bdead\b|\bno power\b/, "power"],
  [/\binstall|\bfit(?:ting)? a new|\bshift(?:ing)?\b/, "install"],
  [/\bservic|\bclean|\bmaintenance|\bamc\b/, "service"],
];

const WHEN_RULES: [RegExp, string][] = [
  [/\btomorrow morning\b|\bkal subah\b/, "tomorrow-morning"],
  [/\btomorrow evening\b/, "tomorrow-evening"],
  [/\btomorrow\b|\btmrw\b|\bkal\b/, "tomorrow-morning"],
  [/\bevening\b|\btonight\b|\bafter (?:5|6|five|six)\b|\bafter office\b/, "today-evening"],
  [/\bafternoon\b/, "today-afternoon"],
  [/\btoday\b|\basap\b|\burgent|\bright now\b|\bimmediately\b/, "today-asap"],
];

export function readService(text: string): Fields {
  const t = norm(text);
  const f: Fields = {};
  for (const [re, v] of PROBLEM_RULES) {
    if (re.test(t)) {
      f.problem = v;
      break;
    }
  }
  const area = AREAS.find((a) => t.includes(a.name.toLowerCase()) || (a.name === "HSR Layout" && /\bhsr\b/.test(t)) || (a.name === "BTM Layout" && /\bbtm\b/.test(t)) || (a.name === "Electronic City" && /\be-?city\b/.test(t)));
  if (area) f.area = area.name;
  for (const [re, v] of WHEN_RULES) {
    if (re.test(t)) {
      f.when = v;
      break;
    }
  }
  return f;
}

// ---- Short replies (confirm / cancel / move) ----

export function readReply(text: string): Fields {
  const t = norm(text);
  const day = readDay(t);
  const f: Fields = {};
  const move = /\b(?:reschedul|move|shift|change|another (?:day|time)|different (?:day|time)|postpone|later|instead|prepone)/.test(t);
  const cancel = /\b(?:can't|cant|cannot|won't|wont|unable|not (?:able|coming|come)|cancel|skip|sick|out of town|travel(?:l)?ing)\b/.test(t);
  const confirm = /^(?:y|yes|yeah|yep|ok|okay|sure|confirm(?:ed)?|done|haan|ha|👍)\b|\b(?:i'll be there|will be there|i will come|see you|coming)\b/.test(t);
  if (move || (cancel && day && day !== "tomorrow")) f.intent = "move";
  else if (cancel) f.intent = "cancel";
  else if (confirm) f.intent = "confirm";
  else if (day && day !== "tomorrow") f.intent = "move";
  if (day && day !== "today") f.day = day;
  return f;
}

export const REQUIRED: Record<"lead" | "service" | "reply", string[]> = {
  lead: ["product", "qty"],
  service: ["problem", "area"],
  reply: ["intent"],
};

export const missing = (kind: "lead" | "service" | "reply", f: Fields) => REQUIRED[kind].filter((k) => !f[k]);

/** Drops values the engine can't use (fields come back from the browser, so they are re-checked). */
export function valid(kind: "lead" | "service" | "reply", f: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(f)) {
    if (!v || k.startsWith("_")) continue;
    if (kind === "lead" && k === "product" && !PRODUCTS.some((p) => p.key === v)) continue;
    if (kind === "lead" && k === "qty" && !(Number.isInteger(Number(v)) && Number(v) > 0)) continue;
    if (kind === "lead" && k === "by" && !DAY_WORDS.some(([, d]) => d === v)) continue;
    if (kind === "service" && k === "problem" && !(v in PROBLEMS)) continue;
    if (kind === "service" && k === "area" && !AREAS.some((a) => a.name === v)) continue;
    if (kind === "service" && k === "when" && !WHEN_RULES.some(([, w]) => w === v)) continue;
    if (kind === "reply" && k === "intent" && !["confirm", "cancel", "move"].includes(v)) continue;
    if (kind === "reply" && k === "day" && !DAY_WORDS.some(([, d]) => d === v)) continue;
    out[k] = v;
  }
  return out;
}
