import type { Option } from "../filters/types";

/** Client-safe shape of a record's detail view (drawer + full page). */

export interface DetailItem {
  id: number;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: { label: string; color?: string };
  href?: string;
}

export interface DetailSection {
  key: string;
  title: string;
  items: DetailItem[];
  total: number;
  viewAll?: string;
  empty?: string;
}

export interface TimelineItem {
  id: string;
  at: string; // ISO
  kind: "call" | "email" | "meeting" | "note" | "task" | "audit";
  title: string;
  actor?: string;
  pending?: boolean; // open task
  due?: string;
}

/** A state-dependent action on a record; `input` names the small form the UI shows first. */
export interface RecordAction {
  key: string;
  label: string;
  tone?: "primary" | "danger";
  input?: "payment" | "receive" | "adjust" | "import";
  confirm?: string;
}

export interface LineRow {
  id: number;
  productId: number;
  sku: string;
  name: string;
  qty: number;
  qtyReceived?: number;
  unitPrice: number; // SO: price, PO: unit cost
  discountPct?: number;
  gstRate: number;
  lineTotal: number; // ex-GST
  available?: number; // SO: available at the order's warehouse
}

export interface LinesBlock {
  kind: "so" | "po";
  editable: boolean;
  rows: LineRow[];
  subtotal: number;
  tax: number;
  total: number;
  productOptions?: Option[];
}

export interface RecordDetail {
  entity: string;
  id: number;
  title: string;
  row: Record<string, unknown> & { id: number };
  options: Record<string, Option[]>;
  sections: DetailSection[];
  timeline: TimelineItem[];
  /** raw column values for the edit form (null when the entity has no form) */
  formValues: Record<string, unknown> | null;
  /** false when the record can't be edited right now (e.g. a confirmed order) */
  editable: boolean;
  actions: RecordAction[];
  lines?: LinesBlock;
  /** context for action forms, e.g. invoice balance or issue date */
  context?: Record<string, string | number>;
}
