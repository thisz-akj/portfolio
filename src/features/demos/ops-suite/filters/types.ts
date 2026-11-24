/**
 * Filter engine vocabulary — shared by server (SQL building) and client (filter UI). No DB imports here.
 * A list view is described by a ListQuery; its filter is a tree of conditions combined with and/or.
 */

export type FieldType = "text" | "enum" | "number" | "money" | "date" | "boolean" | "relation" | "tags";

export const OPS = {
  text: ["contains", "not_contains", "eq", "neq", "starts_with", "is_empty", "is_not_empty"],
  enum: ["in", "not_in", "is_empty", "is_not_empty"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "is_empty", "is_not_empty"],
  money: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "is_empty", "is_not_empty"],
  date: ["preset", "older_than", "within_last", "on", "before", "after", "between", "is_empty", "is_not_empty"],
  boolean: ["is_true", "is_false"],
  relation: ["in", "not_in", "is_empty", "is_not_empty"],
  tags: ["has_any", "has_all", "has_none"],
} as const satisfies Record<FieldType, readonly string[]>;

export type Op = (typeof OPS)[FieldType][number];

/** Operators that take no value. */
export const NULLARY_OPS: readonly Op[] = ["is_empty", "is_not_empty", "is_true", "is_false"];

export const OP_LABELS: Record<Op, string> = {
  contains: "contains",
  not_contains: "does not contain",
  eq: "is",
  neq: "is not",
  starts_with: "starts with",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  in: "is any of",
  not_in: "is none of",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  between: "between",
  preset: "in",
  older_than: "more than … days ago",
  within_last: "in the last … days",
  on: "on",
  before: "before",
  after: "after",
  is_true: "is yes",
  is_false: "is no",
  has_any: "has any of",
  has_all: "has all of",
  has_none: "has none of",
};

export const DATE_PRESETS = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "this_month",
  "last_month",
  "this_quarter",
  "last_quarter",
  "this_fy",
  "last_fy",
  "next_7_days",
  "next_30_days",
  "past",
  "future",
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: "today",
  yesterday: "yesterday",
  last_7_days: "last 7 days",
  last_30_days: "last 30 days",
  last_90_days: "last 90 days",
  this_month: "this month",
  last_month: "last month",
  this_quarter: "this quarter (FY)",
  last_quarter: "last quarter (FY)",
  this_fy: "this financial year",
  last_fy: "last financial year",
  next_7_days: "next 7 days",
  next_30_days: "next 30 days",
  past: "the past",
  future: "the future",
};

export type FilterValue = string | number | (string | number)[] | [number, number] | [string, string] | null;

export interface Condition {
  field: string;
  op: Op;
  value?: FilterValue;
}

export interface Group {
  combinator: "and" | "or";
  conditions: (Condition | Group)[];
}

export const isGroup = (c: Condition | Group): c is Group => "conditions" in c;

export interface SortKey {
  field: string;
  dir: "asc" | "desc";
}

export const PAGE_SIZES = [25, 50, 100] as const;

export interface ListQuery {
  q: string;
  filter: Group;
  sort: SortKey[];
  page: number; // 1-based
  pageSize: number;
  cols: string[] | null; // null = entity defaults
}

export interface Option {
  value: string;
  label: string;
  color?: string;
  /** parent key for dependent pickers, e.g. a contact's company id */
  group?: string;
}

/** Client-safe description of one field of an entity. */
export interface FieldMeta {
  key: string;
  label: string;
  type: FieldType;
  options?: Option[]; // enum: fixed options
  /** relation/tags: options are loaded by the server and passed to the UI */
  dynamicOptions?: boolean;
  /** relation: row key holding the display label */
  labelKey?: string;
  sortable?: boolean;
  filterable?: boolean;
  /** show a facet count next to options in the filter editor */
  facet?: boolean;
  /** visible by default */
  visible?: boolean;
  align?: "start" | "end";
  /** render hint for numbers */
  unit?: string;
  /** cell is the record's primary label */
  primary?: boolean;
  description?: string;
}

export interface SavedView {
  id: string;
  label: string;
  query: Partial<Pick<ListQuery, "q" | "filter" | "sort" | "cols">>;
}

export interface EntityMeta {
  key: string;
  label: string; // plural, e.g. "Companies"
  singular: string;
  fields: FieldMeta[];
  defaultSort: SortKey[];
  views: SavedView[];
  /** bulk actions offered on selected rows */
  bulk?: { owner?: boolean; enums?: string[]; tags?: boolean };
  /** rows link here instead of opening the record drawer (e.g. audit entries → the record they describe) */
  rowHref?: (row: Record<string, unknown>) => string | null;
  /** fields always selected even when their columns are hidden (e.g. keys rowHref needs) */
  alwaysSelect?: string[];
  /** enum shown as the status pill in record headers (defaults to the first bulk enum) */
  statusField?: string;
  /** Kanban board grouped by an enum field, summing a money field */
  board?: { field: string; sum: string; closed?: string[] };
}

export const emptyGroup = (): Group => ({ combinator: "and", conditions: [] });

export const defaultQuery = (meta: EntityMeta): ListQuery => ({
  q: "",
  filter: emptyGroup(),
  sort: meta.defaultSort,
  page: 1,
  pageSize: 25,
  cols: null,
});

export const fieldOf = (meta: EntityMeta, key: string) => meta.fields.find((f) => f.key === key);
export const visibleColumns = (meta: EntityMeta, cols: string[] | null) =>
  cols ? cols.filter((k) => fieldOf(meta, k)) : meta.fields.filter((f) => f.visible).map((f) => f.key);
