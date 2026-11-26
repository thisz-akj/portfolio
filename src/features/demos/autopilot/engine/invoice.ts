import type { Pending } from "../types";
import { SUPPLIER as S } from "./data";
import { Ctx, inr, inr2 } from "./ctx";

export const INVOICE_START = "2026-11-25T09:40:00+05:30"; // Wed

interface Bill {
  no: string;
  qty: number;
  rate: number;
  received: number;
}

const money = (qty: number, rate: number) => {
  const taxable = qty * rate;
  const gst = Math.round(taxable * 0.18 * 100) / 100;
  return { taxable, gst, total: Math.round(taxable + gst) };
};

function bookAndPay(ctx: Ctx, bill: Bill, payQty: number, payRate: number, note: string) {
  const m = money(payQty, payRate);
  const early = Math.round(m.taxable * S.earlyPayDiscount);
  ctx.wait(2);
  ctx.step("sheet", "auto", "Booked in the purchase register", {
    saves: 4,
    card: {
      kind: "table",
      title: "Purchase register (accounts)",
      head: ["Date", "Supplier", "Invoice", "Taxable", "GST", "Payable", "Status"],
      rows: [
        ["18 Nov", S.name, "SKP/2627/0411", "₹1,10,000", "₹19,800", "₹1,29,800", "Paid"],
        ["24 Nov", "Bharat Inks", "BI/1123", "₹18,400", "₹3,312", "₹21,712", "Due 24 Dec"],
        [ctx.day(), S.name, bill.no, inr(m.taxable), inr2(m.gst), inr(m.total - early), note],
      ],
      highlight: [2],
    },
  });
  ctx.step("payments", "auto", "Added to Friday's payment run", {
    saves: 3,
    detail: `Paid within ${S.earlyPayDays} days, the supplier's terms give ${Math.round(S.earlyPayDiscount * 100)}% off: ${inr(early)} saved.`,
    card: { kind: "fields", title: "Payment run, Fri", rows: [["Invoices", "6"], ["This invoice", inr(m.total - early)], ["Early-payment saving", inr(early)], ["Run total", "₹4,12,800"]] },
  });
  const p: Pending = {
    id: "run",
    who: "team",
    tool: "payments",
    prompt: "You're Priya, the accounts manager. Approve Friday's payment run (6 invoices, ₹4,12,800)?",
    options: [
      { id: "ok", label: "Approve the run" },
      { id: "hold", label: "Hold this invoice" },
    ],
  };
  const c = ctx.ask(p);
  ctx.waitUntil(2, 11, 0);
  if ("option" in c && c.option === "hold") {
    ctx.step("payments", "team", "Invoice held from the run", { tone: "warn", detail: "The other 5 invoices were paid. This one moves to next week's run." });
    ctx.outcome = "Checked, booked and held for next week's run";
    return;
  }
  ctx.step("payments", "team", "Payment run approved", { tone: "good" });
  ctx.wait(20);
  ctx.step("payments", "auto", "Paid by bank transfer", { tone: "good", saves: 3, card: { kind: "fields", title: "Payment", rows: [["To", S.name], ["Amount", inr(m.total - early)], ["Reference", "NEFT UTR SBIN0261127448"], ["Invoice", bill.no]] } });
  ctx.send("email", "Remittance advice sent", `Dear ${S.name} team,\n\nWe've paid ${inr(m.total - early)} against invoice ${bill.no} (${S.po}) today, NEFT ref SBIN0261127448. ${Math.round(S.earlyPayDiscount * 100)}% early-payment discount applied as per terms.\n\nAccounts, Kaveri Packaging`, { saves: 3 });
  ctx.outcome = ctx.outcome || `Invoice checked, booked and paid early (saved ${inr(early)})`;
}

export function invoice(ctx: Ctx) {
  const p0: Pending = {
    id: "send",
    who: "customer",
    tool: "email",
    prompt: "As the supplier, which invoice do you email?",
    options: [
      { id: "clean", label: "The correct invoice" },
      { id: "over", label: "Bill 2,000 kg (only 1,950 kg arrived)" },
      { id: "rate", label: "Bill at ₹58/kg (the order says ₹55)" },
      { id: "dup", label: "Last week's invoice again" },
    ],
  };
  const c0 = ctx.ask(p0);
  const kind = "option" in c0 ? c0.option : "clean";
  const bill: Bill =
    kind === "over" ? { no: "SKP/2627/0418", qty: 2000, rate: 55, received: 1950 } : kind === "rate" ? { no: "SKP/2627/0418", qty: 2000, rate: 58, received: 2000 } : kind === "dup" ? { no: "SKP/2627/0411", qty: 2000, rate: 55, received: 2000 } : { no: "SKP/2627/0418", qty: 2000, rate: 55, received: 2000 };
  const m = money(bill.qty, bill.rate);

  ctx.receive("email", "Invoice email arrived", `Dear Sir/Madam,\n\nPlease find attached our invoice ${bill.no} against ${S.po}. Payment terms: 2% off within ${S.earlyPayDays} days, net 30.\n\nRegards,\nAccounts, ${S.name}`, { attachment: `${bill.no.replace(/\//g, "-")}.pdf`, detail: `From ${S.email}` });
  ctx.wait(1);
  ctx.step("docs", "auto", "Invoice read", {
    saves: 6,
    card: {
      kind: "fields",
      title: "Read from the PDF",
      rows: [
        ["Supplier", S.name],
        ["GSTIN", S.gstin],
        ["Invoice", bill.no],
        ["Order", S.po],
        ["Item", `${S.item} (HSN ${S.hsn})`],
        ["Quantity", `${bill.qty.toLocaleString("en-IN")} kg`],
        ["Rate", `${inr(bill.rate)}/kg`],
        ["Taxable", inr(m.taxable)],
        ["CGST + SGST", inr2(m.gst)],
        ["Total", inr(m.total)],
        ["Due", ctx.day(ctx.now + 30 * 1440)],
      ],
    },
  });

  if (kind === "dup") {
    ctx.step("sheet", "auto", "Duplicate caught", {
      tone: "bad",
      saves: 5,
      card: { kind: "table", title: "Purchase register (accounts)", head: ["Date", "Supplier", "Invoice", "Total", "Status"], rows: [["18 Nov", S.name, "SKP/2627/0411", "₹1,29,800", "Paid, NEFT SBIN0261118020"]], flag: [0] },
    });
    ctx.send("email", "Supplier told it's already paid", `Dear ${S.name} team,\n\nInvoice SKP/2627/0411 was paid on 18 Nov (NEFT ref SBIN0261118020), so we won't process it again. Please let us know if it was sent by mistake or if a different invoice was meant.\n\nAccounts, Kaveri Packaging`, { saves: 3 });
    ctx.step("chat", "auto", "Accounts told", { saves: 1, detail: "#accounts: duplicate of SKP/2627/0411 (₹1,29,800, paid 18 Nov) received and stopped." });
    ctx.outcome = "Duplicate caught before it was paid twice";
    return;
  }
  ctx.step("sheet", "auto", "No duplicate in the purchase register", { saves: 2 });

  const po = money(S.poQty, S.poRate);
  const grn = money(bill.received, S.poRate);
  const qtyBad = bill.qty !== bill.received;
  const rateBad = bill.rate !== S.poRate;
  ctx.wait(1);
  ctx.step("stock", "auto", qtyBad || rateBad ? "Mismatch found against the order and goods receipt" : "Matches the order and goods receipt", {
    tone: qtyBad || rateBad ? "warn" : "good",
    saves: 8,
    card: {
      kind: "table",
      title: "Three-way match",
      head: ["", `Order ${S.po}`, `Received ${S.grn}`, `Invoice`],
      rows: [
        ["Quantity", `${S.poQty.toLocaleString("en-IN")} kg`, `${bill.received.toLocaleString("en-IN")} kg`, `${bill.qty.toLocaleString("en-IN")} kg`],
        ["Rate", `${inr(S.poRate)}/kg`, "", `${inr(bill.rate)}/kg`],
        ["Taxable", inr(po.taxable), inr(grn.taxable), inr(m.taxable)],
      ],
      flag: [...(qtyBad ? [0] : []), ...(rateBad ? [1] : []), ...(qtyBad || rateBad ? [2] : [])],
    },
  });

  if (!qtyBad && !rateBad) {
    ctx.step("docs", "auto", "Approved by rule: matched invoices go straight to payment", { tone: "good", saves: 3 });
    bookAndPay(ctx, bill, bill.qty, bill.rate, "Scheduled");
    return;
  }

  const over = m.total - money(bill.received, S.poRate).total;
  const issue = qtyBad
    ? `billed ${bill.qty.toLocaleString("en-IN")} kg, received ${bill.received.toLocaleString("en-IN")} kg (${inr(over)} extra)`
    : `billed at ${inr(bill.rate)}/kg, the order says ${inr(S.poRate)}/kg (${inr(over)} extra)`;
  ctx.step("chat", "auto", "Accounts manager asked to decide", { detail: `#accounts: ${bill.no} from ${S.name}: ${issue}.` });
  const pm: Pending = {
    id: "mismatch",
    who: "team",
    tool: "chat",
    prompt: `You're Priya, the accounts manager. ${bill.no}: ${issue}. What should happen?`,
    options: qtyBad
      ? [
          { id: "ask", label: "Pay for what arrived, ask for a credit note" },
          { id: "full", label: "Pay in full" },
          { id: "hold", label: "Hold and call the supplier" },
        ]
      : [
          { id: "ask", label: "Pay the order rate, ask for a revised invoice" },
          { id: "full", label: "Accept the new rate" },
          { id: "hold", label: "Hold and call the supplier" },
        ],
  };
  const d = ctx.ask(pm);
  const decision = "option" in d ? d.option : "ask";
  ctx.wait(14);

  if (decision === "hold") {
    ctx.step("chat", "team", "Invoice on hold", { tone: "warn", detail: "Call task for Priya; the invoice stays out of the payment run until it's settled." });
    ctx.outcome = `Mismatch caught (${inr(over)}) and held for a call`;
    return;
  }
  if (decision === "full") {
    ctx.step("chat", "team", "Approved in full", { detail: "Priya's approval and reason are saved with the invoice." });
    bookAndPay(ctx, bill, bill.qty, bill.rate, "Scheduled (approved)");
    return;
  }

  const askText = qtyBad
    ? `Dear ${S.name} team,\n\nAgainst ${S.po} we received ${bill.received.toLocaleString("en-IN")} kg (${S.grn}), but invoice ${bill.no} bills ${bill.qty.toLocaleString("en-IN")} kg. Please send a credit note for ${(bill.qty - bill.received).toLocaleString("en-IN")} kg (${inr(over)} incl. GST). We'll pay the balance in Friday's run.\n\nAccounts, Kaveri Packaging`
    : `Dear ${S.name} team,\n\nInvoice ${bill.no} bills ${inr(bill.rate)}/kg, but ${S.po} was agreed at ${inr(S.poRate)}/kg. Please send a revised invoice at the order rate, and we'll pay it in Friday's run.\n\nAccounts, Kaveri Packaging`;
  ctx.send("email", qtyBad ? "Credit note requested" : "Revised invoice requested", askText, { saves: 6 });

  const ps: Pending = {
    id: "supplier",
    who: "customer",
    tool: "email",
    prompt: "As the supplier, how do you reply?",
    options: qtyBad
      ? [
          { id: "fix", label: "Send the credit note" },
          { id: "dispute", label: "We delivered the full 2,000 kg" },
        ]
      : [
          { id: "fix", label: "Send a revised invoice at ₹55/kg" },
          { id: "dispute", label: "Paper prices went up, ₹58 stands" },
        ],
  };
  const r = ctx.ask(ps);
  let reply = "option" in r ? r.option : "fix";
  ctx.wait(95);

  if (reply === "dispute") {
    ctx.receive("email", "Supplier disagreed", qtyBad ? "We dispatched the full 2,000 kg; please check again." : "Paper prices went up this month, so the ₹58 rate stands.");
    if (qtyBad) {
      ctx.step("chat", "auto", "Stores asked to recheck", { saves: 2, detail: `#stores: ${S.name} says 2,000 kg were delivered on ${S.grn}. Please recheck the weighbridge slip.` });
      ctx.wait(40);
      ctx.humans++;
      ctx.step("stock", "team", "Stores confirm 1,950 kg", { detail: "Weighbridge slip attached to the goods receipt." });
      ctx.send("email", "Evidence sent to the supplier", `Our weighbridge slip for ${S.grn} shows 1,950 kg (attached). Please send the credit note for 50 kg.`, { attachment: "weighbridge-GRN-1187.pdf", saves: 3 });
      ctx.wait(120);
      reply = "fix";
    } else {
      const pr: Pending = {
        id: "rate2",
        who: "team",
        tool: "chat",
        prompt: "You're Priya. The supplier insists on ₹58/kg. Accept it?",
        options: [
          { id: "accept", label: "Accept ₹58 and update the order" },
          { id: "refuse", label: "Pay ₹55 this time" },
        ],
      };
      const a = ctx.ask(pr);
      ctx.wait(10);
      if ("option" in a && a.option === "accept") {
        ctx.step("stock", "auto", "Order and rate card updated to ₹58/kg", { saves: 3 });
        bookAndPay(ctx, bill, bill.qty, bill.rate, "Scheduled (new rate)");
      } else {
        ctx.send("email", "Supplier told the order rate applies", `We'll pay this invoice at the agreed ${inr(S.poRate)}/kg. Happy to discuss the new rate for the next order.`, { saves: 2 });
        bookAndPay(ctx, bill, bill.qty, S.poRate, "Scheduled (order rate)");
      }
      return;
    }
  }

  if (qtyBad) {
    ctx.receive("email", "Credit note arrived", "Please find attached credit note CN/2627/0042 for 50 kg.", { attachment: "CN-2627-0042.pdf" });
    ctx.step("docs", "auto", "Credit note read and matched", { tone: "good", saves: 4, card: { kind: "fields", title: "Credit note", rows: [["Number", "CN/2627/0042"], ["Against", bill.no], ["Quantity", "50 kg"], ["Amount", inr(over)]] } });
    bookAndPay(ctx, bill, bill.received, S.poRate, "Scheduled (net of CN)");
  } else {
    ctx.receive("email", "Revised invoice arrived", `Please find attached revised invoice ${bill.no}-R at ₹55/kg.`, { attachment: `${bill.no.replace(/\//g, "-")}-R.pdf` });
    ctx.step("docs", "auto", "Revised invoice read: now matches", { tone: "good", saves: 4 });
    bookAndPay(ctx, { ...bill, no: `${bill.no}-R`, rate: S.poRate }, bill.qty, S.poRate, "Scheduled");
  }
}
