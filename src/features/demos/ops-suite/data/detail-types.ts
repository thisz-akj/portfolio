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

export interface RecordDetail {
  entity: string;
  id: number;
  title: string;
  row: Record<string, unknown> & { id: number };
  options: Record<string, Option[]>;
  sections: DetailSection[];
  timeline: TimelineItem[];
  /** raw column values for the edit form */
  formValues: Record<string, unknown>;
}
