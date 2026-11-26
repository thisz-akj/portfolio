/** Shapes returned by the DocDesk service (docintel/), via /api/demos/document-intelligence. */

export interface Rect {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Source {
  quote: string;
  page: number;
  rects: Rect[];
}

export interface DocSummary {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  blurb: string;
  source: "sample" | "upload";
  pages: number;
  examples: string[];
  issues: { error: number; warning: number };
}

export interface DocDetail extends DocSummary {
  pageSizes: { n: number; w: number; h: number }[];
  sections: string[];
}

export interface Citation {
  n: number;
  chunk: string;
  page: number;
  section: string;
  quote: string;
  rects: Rect[];
}

export type AnswerMode = "answer" | "not_found" | "passages" | "example";

export interface Answer {
  mode: AnswerMode;
  answer: string;
  citations: Citation[];
  latencyMs: number;
  cached?: boolean;
  busy?: boolean;
}

export type Confidence = "high" | "review" | "missing" | "pending";

export interface Field {
  key: string;
  label: string;
  kind: "text" | "date" | "money" | "int" | "bool" | "percent" | "list";
  value: string | number | boolean | string[] | null;
  display: string;
  confidence: Confidence;
  source: Source | null;
}

export interface LineItem {
  description: string;
  hsn: string;
  qty: number;
  rate: number | null;
  amount: number | null;
  source: Source | null;
}

export type Severity = "error" | "warning" | "info" | "pass";

export interface Check {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  source: Source | null;
}

export interface Extraction {
  type: string;
  typeLabel: string;
  fields: Field[];
  lineItems: LineItem[];
  complete: boolean;
  checks: Check[];
}

export interface Side {
  page: number;
  rects: Rect[];
}

export interface ClauseChange {
  kind: "changed" | "added" | "removed";
  section: string;
  clause: string;
  ops: ["=" | "+" | "-", string][];
  a: Side | null;
  b: Side | null;
}

export interface MatchLine {
  description: string;
  po: { display: string } | null;
  invoice: { display: string } | null;
  status: "match" | "mismatch";
  issues: string[];
  poSource: Source | null;
  invoiceSource: Source | null;
}

export type Comparison = { a: DocSummary; b: DocSummary; summary: string } & (
  | { mode: "contracts"; changes: ClauseChange[]; terms: { key: string; label: string; a: string; b: string; same: boolean }[] }
  | {
      mode: "po_invoice";
      lines: MatchLine[];
      header: { label: string; po: string; invoice: string; status: "match" | "mismatch" }[];
      overBilledDisplay: string | null;
    }
);

export interface ReviewItem extends Check {
  key: string;
  doc: DocSummary;
}

export interface QualityRow {
  doc: string;
  question: string;
  kind: "answerable" | "not-in-document";
  answer: string;
  pages: number[];
  correct: boolean;
  grounded: boolean;
  latencyMs: number;
}

export interface QualityReport {
  available: boolean;
  generatedAt?: string;
  qa?: {
    questions: number;
    accuracy: number;
    answerableAccuracy: number;
    citationAccuracy: number;
    notFoundAccuracy: number;
    latencyP50: number;
    latencyP95: number;
    latencyMean: number;
    rows: QualityRow[];
  };
  extraction?: {
    fields: number;
    correct: number;
    accuracy: number;
    confidentWrong: number;
    perDoc: { doc: string; type: string; fields: number; correct: number }[];
  };
}

export interface Limits {
  uploadMaxPages: number;
  uploadMaxBytes: number;
  uploadTtlMinutes: number;
}
