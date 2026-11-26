import type { Pending } from "../types";
import { minutesUntil, weekday } from "../time";
import { CLINIC } from "./data";
import { Ctx } from "./ctx";
import { dayOffset, readReply } from "./read";
import { readTyped } from "./typed";

export const NOSHOW_START = "2026-11-23T18:00:00+05:30"; // Mon evening

const DOC = CLINIC.doctor;

/** Dr. Rao's list with the visitor's 10:30 row set to `status` (a waitlist patient's name replaces theirs). */
function calendarCard(status: string | null, title = `Tomorrow, ${DOC}`) {
  const rows = CLINIC.tomorrow.map(([t, p], i) => {
    if (i !== 4 || status === null) return [t, p, "Reminder sent"];
    if (status.includes("waitlist")) return [t, status, "Booked"];
    return [t, p, status];
  });
  return { kind: "table" as const, title, head: ["Time", "Patient", "Status"], rows, highlight: [4] };
}

/** Two real slots on the asked day (none on Sundays), or the default Wed/Thu pair. */
function slotOptions(ctx: Ctx, day?: string) {
  const wd = weekday(ctx.start, 0);
  let off = day ? dayOffset(day, wd) : undefined;
  let note = "";
  if (off !== undefined && weekday(ctx.start, off) === 0) {
    note = "We're closed on Sundays, so here are the nearest times. ";
    off += 1;
  }
  if (off === undefined || off <= 1) {
    return { note, options: [{ id: "s1", label: `${ctx.day(minutesUntil(ctx.start, 2, 16, 15))}, 4:15 pm` }, { id: "s2", label: `${ctx.day(minutesUntil(ctx.start, 3, 11))}, 11:00 am` }] };
  }
  return { note, options: [{ id: "s1", label: `${ctx.day(minutesUntil(ctx.start, off, 11))}, 11:00 am` }, { id: "s2", label: `${ctx.day(minutesUntil(ctx.start, off, 16, 15))}, 4:15 pm` }] };
}

function refillFromWaitlist(ctx: Ctx, sameDay: boolean) {
  const when = `${sameDay ? "today" : "tomorrow"} at 10:30 am`;
  const [a, b] = CLINIC.waitlist;
  ctx.wait(2);
  ctx.step("calendar", "auto", "Waitlist checked for the free slot", {
    saves: 3,
    card: { kind: "table", title: `Waitlist, ${DOC}`, head: ["Patient", "Asked for"], rows: CLINIC.waitlist.map((w) => [w.name, w.note]), highlight: [0] },
  });
  ctx.send("whatsapp", `Slot offered to ${a.name}`, `Hi ${a.name.split(" ")[0]}, a slot opened ${when} with ${DOC}. Reply 1 to take it.`, { to: `${a.name} (waitlist)`, saves: 2 });
  ctx.wait(15);
  ctx.step("whatsapp", "auto", `No reply from ${a.name} in 15 min: offered to the next person`, { tone: "warn" });
  ctx.send("whatsapp", `Slot offered to ${b.name}`, `Hi ${b.name.split(" ")[0]}, a slot opened ${when} with ${DOC}. Reply 1 to take it.`, { to: `${b.name} (waitlist)`, saves: 2 });
  ctx.wait(6);
  ctx.receive("whatsapp", `${b.name} took the slot`, "1", { from: `${b.name} (waitlist)` });
  ctx.step("calendar", "auto", "Slot refilled from the waitlist", { tone: "good", saves: 2, card: calendarCard(`${b.name} (from waitlist)`, sameDay ? `Today, ${DOC}` : undefined) });
  ctx.send("whatsapp", `${b.name} confirmed`, `You're booked ${when} with ${DOC}. See you then!`, { to: `${b.name} (waitlist)` });
  ctx.step("chat", "auto", "Front desk told", { saves: 1, detail: `#front-desk: 10:30 ${sameDay ? "today" : "tomorrow"} (${DOC}) is refilled: ${CLINIC.patient} out, ${b.name} in.` });
}

function rebook(ctx: Ctx, day: string | undefined, id: string, ask: string) {
  const { note, options } = slotOptions(ctx, day);
  ctx.send("whatsapp", "New times offered", `${note}${ask} ${options.map((o, i) => `${i + 1}) ${o.label}`).join("  ")}`, { saves: 3 });
  return { options, pending: { id, who: "customer", tool: "whatsapp", prompt: "Pick a new time", options: [...options, { id: "later", label: "I'll book later" }] } as Pending };
}

function finishRebook(ctx: Ctx, options: { id: string; label: string }[], c: ReturnType<Ctx["ask"]>, p: Pending) {
  ctx.wait(4);
  ctx.receive("whatsapp", "Patient replied", ctx.textOf(p, c));
  const pick = "option" in c ? options.find((o) => o.id === c.option) : undefined;
  if (!pick) {
    ctx.send("whatsapp", "Left the door open", "No problem. Reply here any time and we'll find you a slot.");
    ctx.step("crm", "auto", "Reminder to follow up in 3 days", { saves: 1 });
    return false;
  }
  ctx.step("calendar", "auto", "Rebooked", { tone: "good", saves: 2, card: { kind: "fields", title: "Appointment", rows: [["Patient", CLINIC.patient], ["Doctor", DOC], ["When", pick.label], ["Booked via", "WhatsApp"]] } });
  ctx.send("whatsapp", "Booking confirmed", `Done! You're booked with ${DOC} on ${pick.label}. We'll remind you the evening before.`);
  return true;
}

function morningOf(ctx: Ctx) {
  ctx.waitUntil(1, 8, 30);
  ctx.step("maps", "auto", "Directions link added", { saves: 1 });
  ctx.send("whatsapp", "Morning reminder with directions", `Good morning ${CLINIC.patient}! See you at 10:30 with ${DOC}. Directions: maps.example/lotus-clinic. Parking is in the basement.`);
  ctx.waitUntil(1, 10, 22);
  ctx.step("calendar", "auto", "Checked in at the front desk", { tone: "good" });
  ctx.waitUntil(1, 11, 30);
  const pr: Pending = {
    id: "rating",
    who: "customer",
    tool: "whatsapp",
    prompt: "Rate your visit",
    options: [
      { id: "5", label: "★★★★★" },
      { id: "3", label: "★★★" },
      { id: "1", label: "★" },
    ],
  };
  ctx.send("whatsapp", "Feedback requested", `How was your visit with ${DOC} today? Tap a rating.`, { saves: 1 });
  const r = ctx.ask(pr);
  ctx.wait(3);
  const stars = "option" in r ? Number(r.option) : 5;
  ctx.receive("whatsapp", "Patient rated the visit", "★".repeat(stars));
  ctx.step("crm", "auto", `Feedback saved: ${stars}★`, { saves: 1 });
  if (stars >= 4) {
    ctx.send("whatsapp", "Review link sent", "Thank you! If you have a minute, a review helps other families find us: reviews.example/lotus-clinic");
    ctx.outcome = "Patient came, feedback captured, review link sent";
  } else {
    ctx.step("chat", "auto", "Clinic manager alerted", { tone: "warn", saves: 2, detail: `#clinic-manager: ${CLINIC.patient} rated today's visit ${stars}★. Please call back today.` });
    ctx.send("whatsapp", "Apology and call-back promised", "Sorry it wasn't a great visit. Our clinic manager will call you today to put it right.");
    ctx.outcome = `Low rating caught and sent to the clinic manager the same day`;
  }
}

export function noShow(ctx: Ctx) {
  ctx.step("calendar", "auto", "Tomorrow's appointments checked", { saves: 5, card: calendarCard(null) });
  ctx.send("whatsapp", "Reminder sent", `Hi ${CLINIC.patient}, a reminder of your appointment with ${DOC} tomorrow (${ctx.day(ctx.now + 1440)}) at 10:30 am. Reply YES to confirm, or tell us if you need to change it.`, {
    detail: `${CLINIC.remindersSent} reminders sent for tomorrow`,
    saves: CLINIC.remindersSent,
  });

  const p: Pending = {
    id: "reply",
    who: "customer",
    tool: "whatsapp",
    prompt: "Reply to the reminder",
    options: [
      { id: "confirm", label: "Yes, I'll be there" },
      { id: "cancel", label: "Sorry, I can't make it tomorrow" },
      { id: "move", label: "Can we do Thursday instead?" },
      { id: "silent", label: "(Don't reply)" },
    ],
    text: { placeholder: "Or type your own reply" },
  };
  const c = ctx.ask(p);
  let intent = "option" in c ? c.option : "";
  let day: string | undefined;
  if (intent === "move") day = "thursday";
  if (!("option" in c)) {
    const f = readTyped(ctx, "reply", "reply", c);
    intent = f.intent ?? "";
    day = f.day;
  }

  if (intent !== "silent") {
    ctx.wait(9);
    ctx.receive("whatsapp", "Patient replied", ctx.textOf(p, c));
  }

  if (!["confirm", "cancel", "move", "silent"].includes(intent)) {
    ctx.wait(1);
    ctx.send("whatsapp", "Asked to clarify", "Sorry, I didn't catch that. Reply 1 to confirm, 2 to cancel or 3 to move your appointment.");
    const p2: Pending = { id: "reply2", who: "customer", tool: "whatsapp", prompt: "Reply 1, 2 or 3", options: [{ id: "confirm", label: "1" }, { id: "cancel", label: "2" }, { id: "move", label: "3" }] };
    const c2 = ctx.ask(p2);
    intent = "option" in c2 ? c2.option : readReply(c2.text).intent ?? "confirm";
    ctx.wait(3);
    ctx.receive("whatsapp", "Patient replied", ctx.textOf(p2, c2));
  }

  if (intent === "confirm") {
    ctx.step("calendar", "auto", "Appointment confirmed", { tone: "good", saves: 1, card: calendarCard("Confirmed") });
    ctx.send("whatsapp", "Confirmation sent", `Thanks ${CLINIC.patient}, you're confirmed for 10:30 am tomorrow with ${DOC}. Please bring any previous reports.`);
    morningOf(ctx);
    return;
  }

  if (intent === "cancel" || intent === "move") {
    ctx.step("calendar", "auto", "Slot released", { saves: 2, card: calendarCard("Open: cancelled by patient") });
    const r = rebook(ctx, day, "rebook", intent === "move" ? "Sure! These times are free:" : "No problem, it's cancelled. Would you like another time?");
    refillFromWaitlist(ctx, false);
    const cr = ctx.ask(r.pending);
    const booked = finishRebook(ctx, r.options, cr, r.pending);
    ctx.outcome = booked ? "Slot refilled from the waitlist and the patient rebooked, without a phone call" : "Slot refilled from the waitlist; patient will book later";
    return;
  }

  // No reply: automated call in the morning
  ctx.waitUntil(0, 21, 0);
  ctx.step("whatsapp", "auto", "No reply to the reminder", { tone: "warn", detail: "Added to tomorrow's 8 am reminder calls." });
  ctx.waitUntil(1, 8, 0);
  ctx.step("phone", "auto", "Automated reminder call", { saves: 3, detail: `"Hello, this is Lotus Family Clinic with a reminder of your 10:30 appointment with ${DOC} today. Press 1 to confirm or 2 if you can't come."` });
  const pc: Pending = {
    id: "call",
    who: "customer",
    tool: "phone",
    prompt: "Your phone rings at 8 am",
    options: [
      { id: "confirm", label: "Press 1: I'll come" },
      { id: "cancel", label: "Press 2: I can't come" },
      { id: "none", label: "(Don't pick up)" },
    ],
  };
  const cc = ctx.ask(pc);
  const ans = "option" in cc ? cc.option : "none";
  ctx.wait(1);
  if (ans === "confirm") {
    ctx.step("calendar", "auto", "Confirmed on the call", { tone: "good", card: calendarCard("Confirmed", `Today, ${DOC}`) });
    morningOf(ctx);
    return;
  }
  if (ans === "cancel") {
    ctx.step("calendar", "auto", "Late cancellation: slot released", { tone: "warn", saves: 2, card: calendarCard("Open: cancelled on the call", `Today, ${DOC}`) });
    refillFromWaitlist(ctx, true);
    const r = rebook(ctx, undefined, "rebook", `Hi ${CLINIC.patient}, sorry you can't make it today. Want another time?`);
    const cr = ctx.ask(r.pending);
    const booked = finishRebook(ctx, r.options, cr, r.pending);
    ctx.outcome = booked ? "Same-day slot refilled and the patient rebooked" : "Same-day slot refilled from the waitlist";
    return;
  }
  ctx.step("chat", "auto", "Front desk warned: likely no-show", { tone: "warn", saves: 1, detail: `#front-desk: ${CLINIC.patient} (10:30, ${DOC}) hasn't confirmed by message or call.` });
  ctx.waitUntil(1, 10, 45);
  ctx.step("calendar", "auto", "Marked as no-show", { tone: "bad", card: calendarCard("No-show", `Today, ${DOC}`) });
  const r = rebook(ctx, undefined, "rebook", `Hi ${CLINIC.patient}, we missed you today. Would you like another time?`);
  const cr = ctx.ask(r.pending);
  const booked = finishRebook(ctx, r.options, cr, r.pending);
  ctx.outcome = booked ? "No-show recorded and the patient rebooked the same day" : "No-show recorded, rebooking offered";
}
