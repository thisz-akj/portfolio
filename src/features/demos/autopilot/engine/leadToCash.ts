import type { Pending } from "../types";
import { minutesUntil, weekday } from "../time";
import { BULK_DISCOUNT, BULK_QTY, KNOWN_CUSTOMER, LEAD_APPROVAL_OVER, productByKey } from "./data";
import { Ctx, inr, inr2 } from "./ctx";
import { dayOffset, missing, readLead, type Fields } from "./read";
import { clean, readTyped } from "./typed";

export const LEAD_START = "2026-11-24T10:12:00+05:30"; // Tue

const PRESETS: Record<string, string> = {
  ravi: "Hi, need 200 5-ply cartons 18x12x12 by Friday. Price? — Ravi, Sri Sai Foods",
  pizza: "Do you have pizza boxes? Need 1000 pcs tomorrow",
  vague: "Hi, need boxes urgently",
};

const VISITOR_PHONE = "+91 90000 12345";

function quote(qty: number, rate: number, extra = 0) {
  const gross = qty * rate;
  const discountPct = (qty >= BULK_QTY ? BULK_DISCOUNT : 0) + extra;
  const discount = Math.round(gross * discountPct);
  const taxable = gross - discount;
  const gst = Math.round(taxable * 0.18 * 100) / 100;
  return { gross, discountPct, discount, taxable, gst, total: Math.round(taxable + gst) };
}

export function leadToCash(ctx: Ctx) {
  const start = ctx.start;
  const wd = weekday(start, 0);

  // 1. The enquiry
  const p0: Pending = {
    id: "enquiry",
    who: "customer",
    tool: "whatsapp",
    prompt: "Send Kaveri Packaging an enquiry",
    options: [
      { id: "ravi", label: PRESETS.ravi },
      { id: "pizza", label: PRESETS.pizza },
      { id: "vague", label: PRESETS.vague },
    ],
    text: { placeholder: "Or type your own, e.g. 300 mailer boxes by Monday" },
  };
  const c0 = ctx.ask(p0);
  const t0 = ctx.textOf(p0, c0);
  const known = "option" in c0 && c0.option === "ravi";
  ctx.receive("whatsapp", "New enquiry on WhatsApp", t0, { detail: known ? `From ${KNOWN_CUSTOMER.phone}` : `From ${VISITOR_PHONE} (new number)` });
  let fields: Fields = "option" in c0 ? readLead(t0) : clean(readTyped(ctx, "enquiry", "lead", c0));

  // 2. Ask for what's missing (twice at most), then hand over to a person
  for (let i = 0; missing("lead", fields).length && i < 2; i++) {
    const gap = missing("lead", fields);
    const product = fields.product ? productByKey(fields.product) : undefined;
    const q =
      gap.length === 2
        ? "Happy to help! Which box and how many? For example: 300 3-ply cartons. We stock 3-ply and 5-ply cartons, pizza boxes, mailer boxes and packing tape."
        : gap[0] === "product"
          ? "Which box do you need? We stock 3-ply and 5-ply cartons, pizza boxes, mailer boxes and packing tape."
          : `How many ${product?.plural ?? "pieces"} do you need?`;
    ctx.wait(1);
    ctx.step("whatsapp", "auto", "Message read: details missing", { detail: `Missing: ${gap.map((g) => (g === "qty" ? "quantity" : g)).join(" and ")}`, tone: "warn", saves: 2 });
    ctx.send("whatsapp", "Asked the customer for the details", q);
    const p: Pending = {
      id: `more${i}`,
      who: "customer",
      tool: "whatsapp",
      prompt: "Reply with the details",
      options: gap.length === 1 && gap[0] === "qty" ? [{ id: "a", label: "400 please" }, { id: "b", label: "150" }] : [{ id: "a", label: "300 3-ply cartons" }, { id: "b", label: "600 mailer boxes by Monday" }],
      text: { placeholder: "e.g. 200 pizza boxes" },
    };
    const c = ctx.ask(p);
    const t = ctx.textOf(p, c);
    ctx.wait(4);
    ctx.receive("whatsapp", "Customer replied", t);
    const more = "option" in c ? readLead(t) : clean(readTyped(ctx, p.id, "lead", c));
    fields = { ...more, ...fields };
    if (!fields.product && more.product) fields.product = more.product;
    if (!fields.qty && more.qty) fields.qty = more.qty;
  }
  if (missing("lead", fields).length) {
    ctx.wait(1);
    ctx.step("chat", "auto", "Handed to sales", { detail: "#sales: a WhatsApp enquiry needs a person. Conversation attached for Meera.", tone: "warn", saves: 2 });
    ctx.send("whatsapp", "Told the customer a person will call", "Thanks! Meera from our sales team will call you in the next 30 minutes to help you choose.");
    ctx.outcome = "Handed to a salesperson with the conversation attached";
    return;
  }

  const product = productByKey(fields.product)!;
  const qty = Math.min(1_000_000, Number(fields.qty));
  const neededOff = fields.by ? (dayOffset(fields.by, wd, true) ?? 3) : 3;
  const name = known ? KNOWN_CUSTOMER.name : (fields.name ?? "");
  const first = name.split(" ")[0] || "there";
  const company = known ? KNOWN_CUSTOMER.company : (fields.company ?? "");
  const neededLabel = fields.by ? ctx.day(minutesUntil(start, neededOff, 10)) : "Not given (standard 3 days)";

  ctx.wait(1);
  ctx.step("whatsapp", "auto", "Enquiry understood", {
    saves: 3,
    card: { kind: "fields", title: "Read from the message", rows: [["Product", product.name], ["Quantity", `${qty.toLocaleString("en-IN")} ${product.unit}`], ["Needed by", neededLabel], ["From", name ? `${name}${company ? `, ${company}` : ""}` : VISITOR_PHONE]] },
  });

  // 3. CRM
  if (known) {
    ctx.step("crm", "auto", "Matched to an existing customer", {
      saves: 4,
      card: { kind: "fields", title: "Contact", rows: [["Name", KNOWN_CUSTOMER.name], ["Company", KNOWN_CUSTOMER.company], ["Customer since", KNOWN_CUSTOMER.since], ["Past orders", String(KNOWN_CUSTOMER.orders)], ["Owner", KNOWN_CUSTOMER.owner]] },
    });
  } else {
    ctx.step("crm", "auto", "New lead created", {
      saves: 4,
      card: { kind: "fields", title: "Lead", rows: [["Name", name || "Not given yet"], ["Phone", VISITOR_PHONE], ["Source", "WhatsApp"], ["Interested in", product.name], ["Stage", "Quote"], ["Owner", KNOWN_CUSTOMER.owner]] },
    });
  }

  // 4. Stock
  const short = Math.max(0, qty - product.stock);
  const readyOff = short ? (wd + 2 >= 6 ? 4 : 2) : 0; // 2 working days for production
  ctx.step("stock", "auto", short ? "Stock is short: production booked" : "Stock checked: available", {
    saves: 3,
    tone: short ? "warn" : "good",
    card: {
      kind: "table",
      title: "Stock",
      head: ["Item", "Available", "Needed", "Status"],
      rows: [[product.name, product.stock.toLocaleString("en-IN"), qty.toLocaleString("en-IN"), short ? `${short.toLocaleString("en-IN")} from production, ready ${ctx.day(minutesUntil(start, readyOff, 10))}` : "Reserved"]],
      highlight: [0],
    },
  });

  // 5. Quote
  let extra = 0;
  let q = quote(qty, product.rate);
  const quoteNo = "QT-2611-0142";
  const quoteCard = () => ({
    kind: "doc" as const,
    title: "Quotation",
    number: quoteNo,
    lines: [{ item: product.name, qty: `${qty.toLocaleString("en-IN")} ${product.unit}`, rate: inr(product.rate), amount: inr(q.gross) }],
    totals: [
      ...(q.discount ? ([[`Discount ${Math.round(q.discountPct * 100)}%`, `−${inr(q.discount)}`]] as [string, string][]) : []),
      ["Taxable value", inr(q.taxable)] as [string, string],
      ["GST 18%", inr2(q.gst)] as [string, string],
      ["Total", inr(q.total)] as [string, string],
    ],
  });
  ctx.wait(1);
  ctx.step("docs", "auto", "Quote drafted from the rate card", { saves: 10, card: quoteCard() });

  // 6. Approval
  if (q.taxable > LEAD_APPROVAL_OVER || q.discount) {
    ctx.step("chat", "auto", "Approval requested from the sales manager", { detail: `#sales: quote ${quoteNo} for ${company || name || "a new lead"}, ${inr(q.total)}${q.discount ? `, ${Math.round(q.discountPct * 100)}% bulk discount` : ""}. Over the ${inr(LEAD_APPROVAL_OVER)} limit for automatic quotes.` });
    const pa: Pending = {
      id: "approve",
      who: "team",
      tool: "chat",
      prompt: `You're Meera, the sales manager. Approve quote ${quoteNo} for ${inr(q.total)}?`,
      options: [
        { id: "ok", label: "Approve" },
        { id: "less", label: "Approve with 3% extra off" },
        { id: "call", label: "I'll call them first" },
      ],
    };
    const a = ctx.ask(pa);
    ctx.wait(7);
    const choice = "option" in a ? a.option : "ok";
    if (choice === "call") {
      ctx.step("chat", "team", "Meera will call the customer", { detail: "Quote held. A call task is on Meera's list.", tone: "warn" });
      ctx.step("crm", "auto", "Call task created", { saves: 2, card: { kind: "fields", title: "Task", rows: [["For", "Meera"], ["Due", `Today ${ctx.time(ctx.now + 60)}`], ["About", `Quote ${quoteNo}`]] } });
      ctx.send("whatsapp", "Told the customer to expect a call", `Thanks ${first}! Meera from our sales team will call you within the hour to finalise the price.`);
      ctx.outcome = "Quote held for a call by the sales manager";
      return;
    }
    if (choice === "less") {
      extra = 0.03;
      q = quote(qty, product.rate, extra);
      ctx.step("chat", "team", "Approved with 3% extra off", { tone: "good" });
      ctx.step("docs", "auto", "Quote updated", { saves: 3, card: quoteCard() });
    } else {
      ctx.step("chat", "team", "Approved", { tone: "good" });
    }
  }

  // 7. Quote + payment link
  const dispatchOff = Math.max(readyOff, neededOff <= 1 ? neededOff : neededOff - 1);
  const dispatchDay = dispatchOff === 0 ? "today" : ctx.day(minutesUntil(start, dispatchOff, 11));
  const sendQuote = (title: string) => {
    ctx.step("payments", "auto", "Payment link created", { saves: 2, card: { kind: "fields", title: "UPI payment link", rows: [["Amount", inr(q.total)], ["For", quoteNo], ["Link", `pay.kaveripack.example/${quoteNo}`], ["Valid till", ctx.day(ctx.now + 3 * 1440)]] } });
    ctx.send(
      "whatsapp",
      title,
      `Hi ${first}, here's your quote for ${qty.toLocaleString("en-IN")} ${product.plural}: ${inr(q.total)} including GST.${short ? ` ${product.stock.toLocaleString("en-IN")} are in stock now, the rest is ready ${ctx.day(minutesUntil(start, readyOff, 10))}.` : ""} Pay with the link to confirm and we'll dispatch ${dispatchOff === 0 ? "today" : `on ${dispatchDay}`}.`,
      { attachment: `${quoteNo}.pdf`, saves: 3 },
    );
  };
  sendQuote("Quote and payment link sent");

  // 8. Customer: pay / bargain / no reply
  const payOptions = (bargain: boolean) => [
    { id: "pay", label: "Pay now" },
    ...(bargain ? [{ id: "bargain", label: "Can you do a better price?" }] : []),
    { id: "silent", label: "(Don't reply)" },
  ];
  const p1: Pending = { id: "pay1", who: "customer", tool: "whatsapp", prompt: "What do you do with the quote?", options: payOptions(true) };
  const c1 = ctx.ask(p1);
  let decision = "option" in c1 ? c1.option : "pay";

  if (decision === "bargain") {
    ctx.wait(12);
    ctx.receive("whatsapp", "Customer asked for a better price", "Can you do a better price?");
    ctx.step("chat", "auto", "Price request sent to the sales manager", { detail: `#sales: ${company || name || "the lead"} is asking for a better price on ${quoteNo} (${inr(q.total)}).` });
    const pb: Pending = {
      id: "bargain",
      who: "team",
      tool: "chat",
      prompt: "You're Meera. The customer wants a better price. What do you allow?",
      options: [
        { id: "two", label: "Give 2% more" },
        { id: "hold", label: "Hold the price" },
      ],
    };
    const b = ctx.ask(pb);
    ctx.wait(5);
    if ("option" in b && b.option === "two") {
      extra += 0.02;
      q = quote(qty, product.rate, extra);
      ctx.step("docs", "auto", "Quote revised", { saves: 3, card: quoteCard() });
      sendQuote("Revised quote sent");
    } else {
      ctx.step("chat", "team", "Price held", {});
      ctx.send("whatsapp", "Explained the price", `This is already our best rate for ${qty.toLocaleString("en-IN")} ${product.unit}, and it includes delivery anywhere in Bengaluru. The payment link is still open.`, { saves: 2 });
    }
    const p2: Pending = { id: "pay2", who: "customer", tool: "whatsapp", prompt: "Now what?", options: payOptions(false) };
    const c2 = ctx.ask(p2);
    decision = "option" in c2 ? c2.option : "pay";
  }

  if (decision === "silent") {
    ctx.waitUntil(1, 10, 30);
    ctx.send("whatsapp", "Follow-up sent (no reply in 24 h)", `Hi ${first}, just checking on quote ${quoteNo}. The payment link is valid till ${ctx.day(ctx.now + 2 * 1440)}. Reply here if you need any change.`, { saves: 2 });
    const p3: Pending = { id: "pay3", who: "customer", tool: "whatsapp", prompt: "A day later, a follow-up arrives", options: [{ id: "pay", label: "Pay now" }, { id: "silent", label: "(Still no reply)" }] };
    const c3 = ctx.ask(p3);
    decision = "option" in c3 ? c3.option : "pay";
    if (decision === "silent") {
      ctx.waitUntil(2, 10, 30);
      ctx.step("crm", "auto", "Call task for Meera (no reply in 2 days)", { saves: 2, tone: "warn", card: { kind: "fields", title: "Task", rows: [["For", "Meera"], ["Due", `Today ${ctx.time(ctx.now + 120)}`], ["About", `Quote ${quoteNo}, 2 follow-ups unanswered`]] } });
      const pc: Pending = {
        id: "call",
        who: "team",
        tool: "crm",
        prompt: "You're Meera, after the call. What happened?",
        options: [
          { id: "pay", label: "They'll pay today" },
          { id: "lost", label: "Mark as lost" },
        ],
      };
      const cc = ctx.ask(pc);
      ctx.wait(95);
      if (!("option" in cc) || cc.option === "lost") {
        ctx.step("crm", "team", "Lead marked lost", { detail: "Reason: no response after 2 follow-ups and a call. Stock reservation released.", tone: "bad" });
        ctx.step("stock", "auto", "Reservation released", { saves: 1 });
        ctx.outcome = "Lead closed as lost after two follow-ups and a call";
        return;
      }
      ctx.step("crm", "team", "Call logged: customer will pay today", { tone: "good" });
      decision = "pay";
    }
  }

  // 9. Paid → invoice, register, dispatch, delivery
  ctx.wait(decision === "pay" ? 9 : 0);
  ctx.step("payments", "auto", "Payment received", { tone: "good", saves: 3, card: { kind: "fields", title: "UPI payment", rows: [["Amount", inr(q.total)], ["Reference", "UTR 4362 1187 0921"], ["Against", quoteNo]] } });
  const cgst = Math.round(q.gst * 50) / 100;
  ctx.step("docs", "auto", "GST invoice created", {
    saves: 8,
    card: {
      kind: "doc",
      title: "Tax invoice",
      number: "INV-2627-0388",
      lines: [{ item: `${product.name} (HSN ${product.hsn})`, qty: `${qty.toLocaleString("en-IN")} ${product.unit}`, rate: inr(product.rate), amount: inr(q.gross) }],
      totals: [
        ...(q.discount ? ([["Discount", `−${inr(q.discount)}`]] as [string, string][]) : []),
        ["Taxable value", inr(q.taxable)],
        ["CGST 9%", inr2(cgst)],
        ["SGST 9%", inr2(q.gst - cgst)],
        ["Total (paid)", inr(q.total)],
      ],
    },
  });
  ctx.step("sheet", "auto", "Added to the sales register", {
    saves: 3,
    card: {
      kind: "table",
      title: "Sales register (accounts)",
      head: ["Date", "Invoice", "Customer", "Taxable", "GST", "Total"],
      rows: [
        [ctx.day(ctx.now - 1440), "INV-2627-0387", "Annapurna Sweets", "₹14,400", "₹2,592", "₹16,992"],
        [ctx.day(), "INV-2627-0388", company || name || "New customer", inr(q.taxable), inr2(q.gst), inr(q.total)],
      ],
      highlight: [1],
    },
  });
  ctx.step("crm", "auto", "Deal marked won", { saves: 1, tone: "good", card: { kind: "fields", title: "Deal", rows: [["Stage", "Won"], ["Value", inr(q.total)], ["Next", `Dispatch ${dispatchDay}`]] } });
  const dispatchHour = dispatchOff === 0 ? 16 : 11;
  ctx.step("calendar", "auto", "Dispatch booked", {
    saves: 4,
    card: { kind: "fields", title: "Dispatch", rows: [["When", `${dispatchOff === 0 ? "Today" : dispatchDay}, ${dispatchHour === 16 ? "4:00 pm" : "11:00 am"}`], ["Vehicle", "Tata Ace KA-01-AB-4417"], ["Driver", "Suresh"], ["Order", "SO-1042"]] },
  });
  ctx.step("chat", "auto", "Warehouse told what to pack", { saves: 2, detail: `#dispatch: SO-1042 is paid. Pack ${qty.toLocaleString("en-IN")} ${product.plural} for ${dispatchOff === 0 ? "today" : dispatchDay}.` });
  ctx.send("whatsapp", "Invoice sent to the customer", `Payment received, thank you${first !== "there" ? `, ${first}` : ""}! Your invoice is attached. The order leaves ${dispatchOff === 0 ? "today at 4 pm" : `on ${dispatchDay} morning`}; we'll send the driver's details.`, { attachment: "INV-2627-0388.pdf", saves: 2 });

  ctx.waitUntil(dispatchOff, dispatchHour, 5);
  ctx.send("whatsapp", "Delivery update sent", `Out for delivery: Suresh (+91 98860 55210) is on the way and should reach you by ${dispatchHour === 16 ? "6 pm" : "1 pm"}.`, { saves: 2 });
  ctx.wait(dispatchHour === 16 ? 115 : 120);
  ctx.step("crm", "auto", "Delivered: proof of delivery saved", { tone: "good", saves: 2, detail: "Signed delivery note photo attached to SO-1042." });
  ctx.outcome = "Paid, invoiced and delivered";
}
