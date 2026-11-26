import type { Pending } from "../types";
import { minutesUntil } from "../time";
import { PROBLEMS, TECHNICIANS, VISIT_CHARGE, areaByName, travelMin } from "./data";
import { Ctx, inr, inr2 } from "./ctx";
import { missing, readService, type Fields } from "./read";
import { clean, readTyped } from "./typed";

export const SERVICE_START = "2026-11-24T14:05:00+05:30"; // Tue

const PRESETS: Record<string, string> = {
  cool: "My AC isn't cooling, I'm in Indiranagar. Can someone come this evening?",
  leak: "AC leaking water in HSR Layout, tomorrow morning please",
  vague: "Need AC service",
};

const KNOWN = { name: "Nisha Verma", unit: "LG 1.5 t split AC (2023)", amcTill: "Mar 2027" };
const LAST_SLOT = 19 * 60 + 30;
const roundUp30 = (m: number) => Math.ceil(m / 30) * 30;

/** Earliest slot (minute of the day) per technician for the asked window; picks the earliest, then the shortest drive. */
function plan(ctx: Ctx, areaName: string, when: string) {
  const area = areaByName(areaName)!;
  const startOfDay = -minutesUntil(ctx.start, 0, 0); // minute of day at start
  const tomorrow = when.startsWith("tomorrow");
  const windowStart = tomorrow ? (when.endsWith("evening") ? 17 * 60 : 9 * 60) : when === "today-evening" ? 17 * 60 : startOfDay + 60;
  const rows = TECHNICIANS.map((t) => {
    const travel = travelMin(t, area);
    const free = tomorrow ? 9 * 60 : t.freeFrom * 60;
    let slot = roundUp30(Math.max(free + travel, windowStart, tomorrow ? 0 : startOfDay + travel + 20));
    let day = tomorrow ? 1 : 0;
    if (slot > LAST_SLOT) {
      day = 1;
      slot = roundUp30(9 * 60 + travel);
    }
    return { t, travel, free, slot, day };
  });
  const best = [...rows].sort((a, b) => a.day * 1440 + a.slot - (b.day * 1440 + b.slot) || a.travel - b.travel)[0];
  return { rows, best };
}

const clock = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

export function serviceJob(ctx: Ctx) {
  const p0: Pending = {
    id: "request",
    who: "customer",
    tool: "whatsapp",
    prompt: "Message CoolBreeze AC Care",
    options: [
      { id: "cool", label: PRESETS.cool },
      { id: "leak", label: PRESETS.leak },
      { id: "vague", label: PRESETS.vague },
    ],
    text: { placeholder: "Or type your own, e.g. AC making noise in Jayanagar" },
  };
  const c0 = ctx.ask(p0);
  const t0 = ctx.textOf(p0, c0);
  const known = "option" in c0 && c0.option === "cool";
  ctx.receive("whatsapp", "New service request on WhatsApp", t0);
  let f: Fields = "option" in c0 ? readService(t0) : clean(readTyped(ctx, "request", "service", c0));

  for (let i = 0; missing("service", f).length && i < 2; i++) {
    const gap = missing("service", f);
    const q =
      gap.length === 2
        ? "Sorry to hear that! What's the problem with the AC, and which area are you in?"
        : gap[0] === "area"
          ? "Sure! Which area of Bengaluru are you in? (e.g. Koramangala, Whitefield)"
          : "What's happening with the AC? Not cooling, leaking, noisy, not turning on, or just due for a service?";
    ctx.wait(1);
    ctx.step("whatsapp", "auto", "Message read: details missing", { tone: "warn", saves: 2, detail: `Missing: ${gap.join(" and ")}` });
    ctx.send("whatsapp", "Asked for the details", q);
    const p: Pending = {
      id: `more${i}`,
      who: "customer",
      tool: "whatsapp",
      prompt: "Reply with the details",
      options: gap.includes("area") ? [{ id: "a", label: "Koramangala" }, { id: "b", label: "Whitefield, today if possible" }] : [{ id: "a", label: "It's not cooling" }, { id: "b", label: "Routine service" }],
      text: { placeholder: "e.g. Jayanagar" },
    };
    const c = ctx.ask(p);
    const t = ctx.textOf(p, c);
    ctx.wait(3);
    ctx.receive("whatsapp", "Customer replied", t);
    const more = "option" in c ? readService(t) : clean(readTyped(ctx, p.id, "service", c));
    f = { ...more, ...f };
  }
  if (missing("service", f).length) {
    ctx.step("chat", "auto", "Handed to the service desk", { tone: "warn", saves: 2, detail: "#service-desk: a WhatsApp request needs a person. Conversation attached." });
    ctx.send("whatsapp", "Told the customer a person will call", "Thanks! Someone from our service desk will call you in 15 minutes.");
    ctx.outcome = "Handed to the service desk with the conversation attached";
    return;
  }

  const problem = PROBLEMS[f.problem] ?? PROBLEMS.service;
  const when = f.when ?? "today-asap";
  const whenLabel: Record<string, string> = { "today-asap": "Today, earliest", "today-evening": "Today evening", "today-afternoon": "Today afternoon", "tomorrow-morning": "Tomorrow morning", "tomorrow-evening": "Tomorrow evening" };
  ctx.wait(1);
  ctx.step("whatsapp", "auto", "Request understood", { saves: 3, card: { kind: "fields", title: "Read from the message", rows: [["Problem", problem.label], ["Area", f.area], ["When", whenLabel[when] ?? "Today, earliest"]] } });

  const visit = known ? 0 : VISIT_CHARGE;
  ctx.step("crm", "auto", known ? "Matched: AMC customer" : "New customer added", {
    saves: 3,
    card: known
      ? { kind: "fields", title: "Customer", rows: [["Name", KNOWN.name], ["Unit", KNOWN.unit], ["AMC", `Active till ${KNOWN.amcTill}`], ["Visit charge", "Waived"]] }
      : { kind: "fields", title: "Customer", rows: [["Phone", "+91 90000 12345"], ["Area", f.area], ["AMC", "None"], ["Visit charge", inr(VISIT_CHARGE)]] },
  });
  ctx.step("crm", "auto", "Ticket SR-24117 opened", { saves: 2, card: { kind: "fields", title: "Ticket", rows: [["Number", "SR-24117"], ["Problem", problem.label], ["Likely fix", problem.likely], ["Priority", f.problem === "cooling" || f.problem === "power" ? "High" : "Normal"]] } });

  const planned = plan(ctx, f.area, when);
  const rows = planned.rows;
  let best = planned.best;
  ctx.wait(1);
  ctx.step("maps", "auto", "Nearest free technician found", {
    saves: 8,
    card: {
      kind: "table",
      title: `Technicians → ${f.area}`,
      head: ["Technician", "Now at", "Drive", "Free from", "Earliest visit"],
      rows: rows.map((r) => [`${r.t.name} ${r.t.rating}★`, r.t.base, `${r.travel} min`, r.day && !when.startsWith("tomorrow") ? "Tomorrow" : clock(r.free), `${r.day ? "Tomorrow " : ""}${clock(r.slot)}`]),
      highlight: [rows.indexOf(best)],
    },
  });
  const dayWord = (d: number) => (d ? `tomorrow (${ctx.day(minutesUntil(ctx.start, 1, 9))})` : "today");
  const book = () => {
    ctx.step("calendar", "auto", "Visit booked", { saves: 3, card: { kind: "fields", title: "Visit", rows: [["Technician", best.t.name], ["When", `${best.day ? ctx.day(minutesUntil(ctx.start, 1, 9)) : "Today"}, ${clock(best.slot)}–${clock(best.slot + 60)}`], ["Ticket", "SR-24117"]] } });
  };
  book();
  ctx.step("stock", "auto", "Van stock checked", { saves: 2, card: { kind: "table", title: `${best.t.name.split(" ")[0]}'s van`, head: ["Part", "In van"], rows: problem.parts.map(([p]) => [p, "Yes"]) } });
  ctx.send(
    "whatsapp",
    "Booking sent to the customer",
    `Booked! ${best.t.name} (${best.t.rating}★) will visit ${dayWord(best.day)} between ${clock(best.slot)} and ${clock(best.slot + 60)}. Visit charge ${known ? "waived under your AMC" : inr(VISIT_CHARGE)}. You'll get a live location link when the technician sets off.`,
    { saves: 2 },
  );

  const pc: Pending = {
    id: "slot",
    who: "customer",
    tool: "whatsapp",
    prompt: "Does the time work?",
    options: [
      { id: "ok", label: "👍 Great" },
      { id: "later", label: "Can it be later?" },
    ],
  };
  const sc = ctx.ask(pc);
  ctx.wait(2);
  ctx.receive("whatsapp", "Customer replied", ctx.textOf(pc, sc));
  if ("option" in sc && sc.option === "later") {
    const later = best.slot + 90 <= LAST_SLOT ? { ...best, slot: best.slot + 90 } : { ...best, day: best.day + 1, slot: 10 * 60 };
    best = later;
    book();
    ctx.send("whatsapp", "New time sent", `Done, moved to ${dayWord(best.day)} ${clock(best.slot)}–${clock(best.slot + 60)} with ${best.t.name}.`, { saves: 2 });
  }

  // Visit
  const slotAt = minutesUntil(ctx.start, best.day, 0) + best.slot;
  ctx.now = Math.max(ctx.now, slotAt - best.travel - 5);
  ctx.step("maps", "auto", `${best.t.name.split(" ")[0]} started: about ${best.travel} min away`, { saves: 1 });
  ctx.send("whatsapp", "Live location and job OTP sent", `${best.t.name.split(" ")[0]} is on the way, arriving around ${clock(best.slot)}. Live location: maps.example/t/SR-24117. Your job OTP is 4821: share it only when you're happy the job is done.`);
  ctx.wait(best.travel + 5);
  ctx.step("crm", "auto", "Technician reached", { detail: "Check-in location matches the customer's address." });
  ctx.wait(problem.minutes);

  const lines = [...(visit ? [{ item: "Visit charge", qty: "1", rate: inr(visit), amount: inr(visit) }] : []), ...problem.parts.map(([item, amt]) => ({ item, qty: "1", rate: inr(amt), amount: amt ? inr(amt) : "Included" }))];
  const taxable = visit + problem.parts.reduce((s, [, a]) => s + a, 0);
  const gst = Math.round(taxable * 0.18 * 100) / 100;
  const total = Math.round(taxable + gst);
  ctx.step("docs", "auto", "Job card filled from the technician's notes", {
    saves: 6,
    card: { kind: "doc", title: "Job card", number: "SR-24117", lines, totals: [["Taxable", inr(taxable)], ["GST 18%", inr2(gst)], ["Total", inr(total)]] },
  });
  ctx.send("whatsapp", "Job summary sent", `Job done: ${problem.likely}. Total ${inr(total)} incl. GST. If the AC is working well, share OTP 4821 with ${best.t.name.split(" ")[0]} to close the job.`);

  const po: Pending = {
    id: "otp",
    who: "customer",
    tool: "whatsapp",
    prompt: "Is the AC fixed?",
    options: [
      { id: "otp", label: "Share OTP 4821" },
      { id: "no", label: "It's still not working" },
    ],
  };
  const oc = ctx.ask(po);
  ctx.wait(2);
  if ("option" in oc && oc.option === "no") {
    ctx.receive("whatsapp", "Customer: not fixed", "It's still not working properly");
    ctx.step("chat", "auto", "Supervisor alerted", { tone: "warn", saves: 2, detail: "#service-supervisor: SR-24117 not fixed on the first visit. Senior technician revisit booked." });
    ctx.step("calendar", "auto", "Free revisit booked with a senior technician", { saves: 3, card: { kind: "fields", title: "Revisit", rows: [["Technician", "Deepa R. (senior)"], ["When", `${ctx.day(ctx.now + 1440)}, 10:00 am`], ["Charge", "None"]] } });
    ctx.send("whatsapp", "Apology and revisit sent", `Sorry about that. Deepa, our senior technician, will come ${ctx.day(ctx.now + 1440)} at 10 am at no charge, and today's visit won't be billed.`);
    ctx.outcome = "Not fixed: free revisit booked with a senior technician, nothing billed";
    return;
  }
  ctx.step("crm", "auto", "Job closed with the customer's OTP", { tone: "good", saves: 1 });
  ctx.step("payments", "auto", "UPI payment link created", { saves: 2 });
  ctx.send("whatsapp", "Payment link sent", `Thanks! Pay ${inr(total)} here: pay.coolbreeze.example/SR-24117. Invoice follows on payment.`);
  const pp: Pending = {
    id: "pay",
    who: "customer",
    tool: "payments",
    prompt: "Pay for the job",
    options: [
      { id: "upi", label: "Pay by UPI" },
      { id: "cash", label: "Pay cash to the technician" },
    ],
  };
  const pc2 = ctx.ask(pp);
  ctx.wait(3);
  const cash = "option" in pc2 && pc2.option === "cash";
  ctx.step("payments", "auto", cash ? "Cash recorded against the technician" : "UPI payment received", { tone: "good", saves: 2, detail: cash ? `${inr(total)} with ${best.t.name}, to deposit by tomorrow.` : `${inr(total)}, UTR 4362 2201 7765.` });
  ctx.send("whatsapp", "Invoice sent", `Payment received, thank you! Your invoice is attached.`, { attachment: "INV-SR-24117.pdf", saves: 2 });
  ctx.step("sheet", "auto", "Added to the daily service register", {
    saves: 3,
    card: {
      kind: "table",
      title: `Service register, ${ctx.day()}`,
      head: ["Ticket", "Area", "Technician", "Work", "Amount", "Paid by"],
      rows: [
        ["SR-24112", "Jayanagar", "Deepa R.", "Wet service", "₹707", "UPI"],
        ["SR-24117", f.area, best.t.name, problem.label, inr(total), cash ? "Cash" : "UPI"],
      ],
      highlight: [1],
    },
  });
  ctx.step("calendar", "auto", known ? "Next AMC service booked in 90 days" : "Service reminder set for 6 months", { saves: 1 });

  ctx.wait(60);
  ctx.send("whatsapp", "Feedback requested", `How did ${best.t.name.split(" ")[0]} do today? Tap a rating.`, { saves: 1 });
  const pr: Pending = { id: "rating", who: "customer", tool: "whatsapp", prompt: "Rate the visit", options: [{ id: "5", label: "★★★★★" }, { id: "3", label: "★★★" }, { id: "1", label: "★" }] };
  const rc = ctx.ask(pr);
  ctx.wait(4);
  const stars = "option" in rc ? Number(rc.option) : 5;
  ctx.receive("whatsapp", "Customer rated the visit", "★".repeat(stars));
  if (stars >= 4) {
    ctx.step("crm", "auto", `Rating saved: ${stars}★ for ${best.t.name}`, { saves: 1, tone: "good" });
    ctx.outcome = "Fixed, paid, invoiced and rated, with the next service already booked";
  } else {
    ctx.step("chat", "auto", "Service manager alerted", { tone: "warn", saves: 2, detail: `#service-manager: SR-24117 rated ${stars}★. Call the customer today.` });
    ctx.send("whatsapp", "Apology and call-back promised", "Sorry it wasn't great. Our service manager will call you today.");
    ctx.outcome = "Job closed; low rating sent to the service manager the same day";
  }
}
