/** Synthetic business data for the Autopilot sandbox (fictional companies and people). */

export interface Product {
  key: string;
  name: string;
  unit: string;
  /** "200 …" in messages */
  plural: string;
  rate: number;
  stock: number;
  hsn: string;
  aliases: RegExp[];
}

export const PRODUCTS: Product[] = [
  { key: "carton3", plural: "3-ply cartons (12×10×8 in)", name: "3-ply carton 12×10×8 in", unit: "pcs", rate: 18, stock: 1200, hsn: "4819", aliases: [/\b3\s*-?\s*ply\b/, /\bthree\s*-?\s*ply\b/, /\bsmall (?:carton|box)/] },
  { key: "carton5", plural: "5-ply cartons (18×12×12 in)", name: "5-ply carton 18×12×12 in", unit: "pcs", rate: 42, stock: 340, hsn: "4819", aliases: [/\b5\s*-?\s*ply\b/, /\bfive\s*-?\s*ply\b/, /\bheavy(?:-duty)? (?:carton|box)/, /\bbig (?:carton|box)/] },
  { key: "pizza", plural: "10-inch pizza boxes", name: "Pizza box 10 in", unit: "pcs", rate: 9, stock: 5000, hsn: "4819", aliases: [/\bpizza\b/] },
  { key: "mailer", plural: "e-commerce mailer boxes", name: "E-commerce mailer box", unit: "pcs", rate: 22, stock: 800, hsn: "4819", aliases: [/\bmailers?\b/, /\be-?commerce\b/, /\bcourier box/, /\bshipping box/] },
  { key: "tape", plural: "rolls of 2-inch packing tape", name: "Packing tape 2 in", unit: "rolls", rate: 38, stock: 2400, hsn: "3919", aliases: [/\btapes?\b/] },
];

export const productByKey = (k: string) => PRODUCTS.find((p) => p.key === k);

/** Known WhatsApp numbers → CRM contacts (the preset customer). */
export const KNOWN_CUSTOMER = { name: "Ravi Kumar", company: "Sri Sai Foods", phone: "+91 98450 21734", since: "2024", orders: 6, owner: "Meera (sales)" };

export const LEAD_APPROVAL_OVER = 8000;
export const BULK_QTY = 500;
export const BULK_DISCOUNT = 0.05;

// ---- Clinic (same clinic as Front Desk Voice) ----
export const CLINIC = {
  name: "Lotus Family Clinic",
  doctor: "Dr. Kavya Rao",
  patient: "Ananya",
  slot: { hour: 10, minute: 30 },
  waitlist: [
    { name: "Rahul S.", note: "asked for any morning this week" },
    { name: "Fatima K.", note: "asked for Dr. Rao, Tue or Wed" },
  ],
  /** Tomorrow's list for Dr. Rao (time, patient); the visitor is the 10:30 row */
  tomorrow: [
    ["9:30 am", "Vikram S."],
    ["9:45 am", "Lakshmi P."],
    ["10:00 am", "Arjun M."],
    ["10:15 am", "Neha G."],
    ["10:30 am", "Ananya (you)"],
    ["10:45 am", "Suresh B."],
    ["11:00 am", "Divya N."],
  ] as [string, string][],
  remindersSent: 18,
};

// ---- Accounts payable ----
export const SUPPLIER = {
  name: "Shree Kraft Paper Mills",
  email: "accounts@shreekraft.example",
  gstin: "29AAKCS4471M1Z2",
  po: "PO-0912",
  grn: "GRN-1187",
  item: "Kraft paper 120 GSM",
  hsn: "4804",
  poQty: 2000,
  poRate: 55,
  earlyPayDays: 10,
  earlyPayDiscount: 0.02,
};

// ---- AC service ----
export interface Area {
  name: string;
  x: number;
  y: number;
}

/** Rough positions in km from MG Road. */
export const AREAS: Area[] = [
  { name: "Indiranagar", x: 3, y: 1 },
  { name: "Koramangala", x: 1, y: -4 },
  { name: "HSR Layout", x: 3, y: -7 },
  { name: "Whitefield", x: 13, y: 1 },
  { name: "Jayanagar", x: -2, y: -6 },
  { name: "JP Nagar", x: -2, y: -9 },
  { name: "BTM Layout", x: 0, y: -7 },
  { name: "Marathahalli", x: 8, y: -2 },
  { name: "Malleshwaram", x: -4, y: 3 },
  { name: "Hebbal", x: 0, y: 8 },
  { name: "Electronic City", x: 4, y: -16 },
  { name: "Bellandur", x: 7, y: -6 },
  { name: "Rajajinagar", x: -6, y: 2 },
  { name: "Banashankari", x: -4, y: -8 },
  { name: "Yelahanka", x: 1, y: 14 },
  { name: "MG Road", x: 0, y: 0 },
  { name: "Ulsoor", x: 1, y: 1 },
  { name: "Basavanagudi", x: -3, y: -4 },
  { name: "Sarjapur", x: 9, y: -10 },
  { name: "Domlur", x: 3, y: -1 },
];

export const areaByName = (n: string) => AREAS.find((a) => a.name.toLowerCase() === n.toLowerCase());

export interface Technician {
  name: string;
  base: string;
  x: number;
  y: number;
  rating: string;
  /** Free from (hour, today) */
  freeFrom: number;
}

export const TECHNICIANS: Technician[] = [
  { name: "Imran Pasha", base: "Domlur", x: 3, y: -1, rating: "4.8", freeFrom: 17 },
  { name: "Prakash N.", base: "BTM Layout", x: 0, y: -7, rating: "4.7", freeFrom: 18.5 },
  { name: "Deepa R.", base: "Malleshwaram", x: -4, y: 3, rating: "4.9", freeFrom: 16 },
  { name: "Joseph M.", base: "Whitefield", x: 13, y: 1, rating: "4.6", freeFrom: 15.5 },
];

export const travelMin = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 3.2 + 6);

export const PROBLEMS: Record<string, { label: string; likely: string; parts: [string, number][]; minutes: number }> = {
  cooling: { label: "Not cooling", likely: "gas top-up and filter clean", parts: [["Gas top-up (R32)", 1800], ["Filter and coil clean", 0]], minutes: 60 },
  leak: { label: "Water leaking", likely: "blocked drain pipe", parts: [["Drain pipe flush", 450]], minutes: 45 },
  noise: { label: "Noisy unit", likely: "loose fan mount", parts: [["Fan mount tightened", 350]], minutes: 45 },
  power: { label: "Not turning on", likely: "PCB or capacitor fault", parts: [["Capacitor replaced", 650]], minutes: 60 },
  service: { label: "Routine service", likely: "routine wet service", parts: [["Wet service", 599]], minutes: 45 },
  install: { label: "Installation", likely: "installation with copper kit", parts: [["Installation", 1499], ["Copper pipe kit (3 m)", 1200]], minutes: 120 },
};

export const VISIT_CHARGE = 299;
