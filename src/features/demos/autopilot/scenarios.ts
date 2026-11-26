import type { ScenarioId, Tool } from "./types";

/** Client-safe scenario metadata: who the visitor plays and which tools the business uses. */
export interface ScenarioMeta {
  id: ScenarioId;
  name: string;
  business: string;
  place: string;
  /** What the visitor plays */
  role: string;
  channel: "whatsapp" | "email";
  /** Contact shown at the top of the visitor's phone / inbox */
  contact: string;
  summary: string;
  tools: Tool[];
}

export const SCENARIOS: ScenarioMeta[] = [
  {
    id: "lead-to-cash",
    name: "Enquiry to paid order",
    business: "Kaveri Packaging",
    place: "Peenya, Bengaluru",
    role: "You're a customer asking for boxes on WhatsApp",
    channel: "whatsapp",
    contact: "Kaveri Packaging",
    summary: "A WhatsApp enquiry becomes a quote, a payment, a GST invoice and a booked dispatch, with one approval from the sales manager.",
    tools: ["whatsapp", "crm", "stock", "docs", "chat", "payments", "sheet", "calendar"],
  },
  {
    id: "no-show",
    name: "No-show recovery",
    business: "Lotus Family Clinic",
    place: "Jayanagar, Bengaluru",
    role: "You're a patient with an appointment tomorrow",
    channel: "whatsapp",
    contact: "Lotus Family Clinic",
    summary: "Reminders go out the evening before. Cancel or move, and the slot is offered to the waitlist and refilled before anyone at the desk notices.",
    tools: ["whatsapp", "calendar", "phone", "crm", "chat", "maps"],
  },
  {
    id: "invoice",
    name: "Supplier invoice to payment",
    business: "Kaveri Packaging · accounts",
    place: "Peenya, Bengaluru",
    role: "You're the supplier emailing an invoice",
    channel: "email",
    contact: "accounts@kaveripack.example",
    summary: "An emailed invoice is read, checked against the order and what was actually received, approved, booked and paid, with remittance sent back.",
    tools: ["email", "docs", "sheet", "stock", "chat", "payments"],
  },
  {
    id: "service-job",
    name: "Service request to closed job",
    business: "CoolBreeze AC Care",
    place: "Bengaluru",
    role: "You're a customer whose AC has stopped cooling",
    channel: "whatsapp",
    contact: "CoolBreeze AC Care",
    summary: "A complaint becomes a ticket, the nearest free technician is booked, the job closes with an OTP and the payment, register and next service follow.",
    tools: ["whatsapp", "crm", "maps", "calendar", "stock", "docs", "payments", "sheet", "chat"],
  },
];

export const getScenario = (id: string) => SCENARIOS.find((s) => s.id === id);

export const TOOL_LABEL: Record<Tool, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  phone: "Phone",
  crm: "CRM",
  stock: "Stock",
  docs: "Documents",
  calendar: "Calendar",
  sheet: "Sheet",
  chat: "Team chat",
  payments: "Payments",
  maps: "Maps",
};
