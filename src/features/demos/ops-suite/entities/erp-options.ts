import type { Option } from "../filters/types";

/** Enum options for ERP fields (client-safe). */
const opt = (value: string, label: string, color?: string): Option => ({ value, label, color });

export const CATEGORY = [
  opt("fasteners", "Fasteners"),
  opt("bearings", "Bearings"),
  opt("electrical", "Electrical"),
  opt("hydraulics", "Hydraulics"),
  opt("safety", "Safety gear"),
  opt("packaging", "Packaging"),
  opt("tools", "Tools"),
  opt("pipes_fittings", "Pipes & fittings"),
  opt("lubricants", "Lubricants"),
  opt("adhesives", "Adhesives & sealants"),
];
export const UNIT = ["pcs", "box", "kg", "litre", "metre", "set", "roll"].map((u) => opt(u, u));
export const GST_RATE = ["5", "12", "18", "28"].map((g) => opt(g, `${g}%`));

export const SO_STATUS = [opt("draft", "Draft", "#6b6b6b"), opt("confirmed", "Confirmed", "#fbbf24"), opt("fulfilled", "Fulfilled", "#4ade80"), opt("cancelled", "Cancelled", "#f87171")];
export const PO_STATUS = [
  opt("draft", "Draft", "#6b6b6b"),
  opt("sent", "Sent", "#a0c4ff"),
  opt("partially_received", "Part received", "#fbbf24"),
  opt("received", "Received", "#4ade80"),
  opt("cancelled", "Cancelled", "#f87171"),
];
export const INVOICE_STATUS = [opt("draft", "Draft", "#6b6b6b"), opt("sent", "Sent", "#a0c4ff"), opt("partially_paid", "Part paid", "#fbbf24"), opt("paid", "Paid", "#4ade80"), opt("void", "Void", "#555")];
export const ORDER_INVOICE = [opt("none", "Not invoiced", "#555"), ...INVOICE_STATUS];
export const AGING = [opt("not_due", "Not yet due", "#a0c4ff"), opt("1_30", "1–30 days", "#fbbf24"), opt("31_60", "31–60 days", "#fb923c"), opt("61_90", "61–90 days", "#f87171"), opt("90_plus", "90+ days", "#dc2626")];
export const STOCK_STATUS = [opt("ok", "In stock", "#4ade80"), opt("low", "Below reorder", "#fbbf24"), opt("out", "Out of stock", "#f87171")];
export const PAYMENT_METHOD = [opt("neft", "NEFT"), opt("rtgs", "RTGS"), opt("upi", "UPI"), opt("cheque", "Cheque"), opt("card", "Card")];
