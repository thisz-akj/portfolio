import type { Option } from "../filters/types";

/** Enum options for CRM fields (client-safe). Colours reuse the portal palette. */
const opt = (value: string, label: string, color?: string): Option => ({ value, label, color });

export const LEAD_SOURCE = [
  opt("indiamart", "Marketplace"),
  opt("website", "Website"),
  opt("referral", "Referral"),
  opt("trade_show", "Trade show"),
  opt("linkedin", "LinkedIn"),
  opt("cold_call", "Cold call"),
  opt("partner", "Partner"),
];

export const LEAD_STATUS = [
  opt("new", "New", "#a0c4ff"),
  opt("contacted", "Contacted", "#e8e0d0"),
  opt("qualified", "Qualified", "#fbbf24"),
  opt("converted", "Converted", "#4ade80"),
  opt("unqualified", "Unqualified", "#6b6b6b"),
];

export const DEAL_STAGE = [
  opt("new", "New", "#a0c4ff"),
  opt("qualified", "Qualified", "#c4b5fd"),
  opt("proposal", "Proposal", "#fbbf24"),
  opt("negotiation", "Negotiation", "#2dd4bf"),
  opt("won", "Won", "#4ade80"),
  opt("lost", "Lost", "#f87171"),
];

/** Default win probability per stage (%). */
export const STAGE_PROBABILITY: Record<string, number> = { new: 10, qualified: 25, proposal: 50, negotiation: 75, won: 100, lost: 0 };

export const LOST_REASONS = [
  "Price too high",
  "Chose competitor",
  "Budget frozen",
  "No decision made",
  "Delivery timeline too long",
  "Stayed with incumbent supplier",
];
