import { z } from "zod";
import {
  DATE_PRESETS,
  NULLARY_OPS,
  OPS,
  PAGE_SIZES,
  defaultQuery,
  fieldOf,
  isGroup,
  type Condition,
  type EntityMeta,
  type FieldMeta,
  type Group,
  type ListQuery,
  type Op,
  type SortKey,
} from "./types";

/**
 * ListQuery ⇄ URL search params. Shared by server (page + export route) and client (filter UI).
 *
 *   ?q=steel
 *   &f=[["lifecycle","in",["customer"]],["annualRevenue","gte",50000000]]   (array = AND; {"or":[…]} = OR group)
 *   &sort=-annualRevenue,name   &page=2   &size=50   &cols=name,industry,owner
 *
 * Every condition is validated against the entity's field metadata with zod; invalid ones are dropped,
 * so a hand-edited or stale URL degrades to a looser filter instead of an error.
 */

export const LIMITS = { conditions: 20, depth: 2, sortKeys: 3, text: 200, list: 100, maxPage: 10_000 } as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(s)), "invalid date");
const num = z.number().finite();
const ordered = <T extends number | string>(t: [T, T]) => t[0] <= t[1];

/** zod schema for a condition's value, given the field and operator. */
export function valueSchema(field: FieldMeta, op: Op): z.ZodType | null {
  if (!(OPS[field.type] as readonly string[]).includes(op)) return null;
  if (NULLARY_OPS.includes(op)) return z.union([z.undefined(), z.null()]);
  switch (field.type) {
    case "text":
      return z.string().trim().min(1).max(LIMITS.text);
    case "enum": {
      const values = (field.options ?? []).map((o) => o.value);
      if (!values.length) return null;
      return z.array(z.enum(values as [string, ...string[]])).min(1).max(LIMITS.list);
    }
    case "number":
    case "money":
      return op === "between" ? z.tuple([num, num]).refine(ordered, "min must be ≤ max") : num;
    case "date":
      if (op === "preset") return z.enum(DATE_PRESETS);
      return op === "between" ? z.tuple([isoDate, isoDate]).refine(ordered, "start must be ≤ end") : isoDate;
    case "relation":
      return z.array(z.number().int().positive()).min(1).max(LIMITS.list);
    case "tags":
      return z.array(z.string().min(1).max(50)).min(1).max(LIMITS.list);
    case "boolean":
      return null;
  }
}

/** Validates one condition; returns a clean copy or null. */
export function validateCondition(meta: EntityMeta, c: Condition): Condition | null {
  const field = fieldOf(meta, c.field);
  if (!field || field.filterable === false) return null;
  const schema = valueSchema(field, c.op);
  if (!schema) return null;
  const parsed = schema.safeParse(c.value ?? undefined);
  if (!parsed.success) return null;
  return parsed.data === undefined || parsed.data === null ? { field: c.field, op: c.op } : { field: c.field, op: c.op, value: parsed.data as Condition["value"] };
}

// ── compact JSON form ────────────────────────────────────────────────────────
type CompactCondition = [string, string] | [string, string, unknown];
type CompactNode = CompactCondition | { and: CompactNode[] } | { or: CompactNode[] };

function toCompact(node: Condition | Group): CompactNode {
  if (isGroup(node)) {
    const children = node.conditions.map(toCompact);
    return node.combinator === "or" ? { or: children } : { and: children };
  }
  return node.value === undefined ? [node.field, node.op] : [node.field, node.op, node.value];
}

function fromCompact(meta: EntityMeta, node: unknown, depth: number, budget: { left: number }): Condition | Group | null {
  if (budget.left <= 0) return null;
  if (Array.isArray(node)) {
    if (typeof node[0] !== "string" || typeof node[1] !== "string") return null;
    budget.left--;
    return validateCondition(meta, { field: node[0], op: node[1] as Op, value: node[2] as Condition["value"] });
  }
  if (node && typeof node === "object" && depth < LIMITS.depth) {
    const combinator = "or" in node ? "or" : "and" in node ? "and" : null;
    const children = combinator ? (node as Record<string, unknown>)[combinator] : null;
    if (!combinator || !Array.isArray(children)) return null;
    const conditions = children.map((c) => fromCompact(meta, c, depth + 1, budget)).filter((c): c is Condition | Group => c !== null && (!isGroup(c) || c.conditions.length > 0));
    return { combinator, conditions };
  }
  return null;
}

export function parseFilter(meta: EntityMeta, raw: string | null | undefined): Group {
  if (!raw) return { combinator: "and", conditions: [] };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { combinator: "and", conditions: [] };
  }
  const root = fromCompact(meta, Array.isArray(json) && (json.length === 0 || Array.isArray(json[0]) || typeof json[0] === "object") ? { and: json } : json, 0, { left: LIMITS.conditions });
  return root && isGroup(root) ? root : root ? { combinator: "and", conditions: [root] } : { combinator: "and", conditions: [] };
}

export function serializeFilter(filter: Group): string | null {
  if (!filter.conditions.length) return null;
  if (filter.combinator === "and") return JSON.stringify(filter.conditions.map(toCompact));
  return JSON.stringify(toCompact(filter));
}

// ── whole query ──────────────────────────────────────────────────────────────
export type ParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;
const getParam = (p: ParamsLike, k: string) => {
  const v = p instanceof URLSearchParams ? p.get(k) : p[k];
  return Array.isArray(v) ? v[0] : (v ?? null);
};

export function parseSort(meta: EntityMeta, raw: string | null): SortKey[] | null {
  if (!raw) return null;
  const keys: SortKey[] = [];
  for (const part of raw.split(",").slice(0, LIMITS.sortKeys)) {
    const desc = part.startsWith("-");
    const field = fieldOf(meta, desc ? part.slice(1) : part);
    if (field && field.sortable !== false && !keys.some((k) => k.field === field.key)) keys.push({ field: field.key, dir: desc ? "desc" : "asc" });
  }
  return keys.length ? keys : null;
}

export const serializeSort = (sort: SortKey[]) => sort.map((s) => (s.dir === "desc" ? "-" : "") + s.field).join(",");

export function parseListQuery(meta: EntityMeta, params: ParamsLike): ListQuery {
  const d = defaultQuery(meta);
  const page = Number(getParam(params, "page"));
  const size = Number(getParam(params, "size"));
  const cols = getParam(params, "cols")
    ?.split(",")
    .filter((k, i, a) => fieldOf(meta, k) && a.indexOf(k) === i);
  return {
    q: (getParam(params, "q") ?? "").trim().slice(0, LIMITS.text),
    filter: parseFilter(meta, getParam(params, "f")),
    sort: parseSort(meta, getParam(params, "sort")) ?? d.sort,
    page: Number.isInteger(page) && page >= 1 && page <= LIMITS.maxPage ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : d.pageSize,
    cols: cols?.length ? cols : null,
  };
}

/** Serialises only what differs from the entity defaults, so URLs stay short. */
export function serializeListQuery(meta: EntityMeta, q: ListQuery): URLSearchParams {
  const d = defaultQuery(meta);
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  const f = serializeFilter(q.filter);
  if (f) p.set("f", f);
  if (serializeSort(q.sort) !== serializeSort(d.sort)) p.set("sort", serializeSort(q.sort));
  if (q.page > 1) p.set("page", String(q.page));
  if (q.pageSize !== d.pageSize) p.set("size", String(q.pageSize));
  if (q.cols) p.set("cols", q.cols.join(","));
  return p;
}

/** Number of leaf conditions in a filter tree. */
export const countConditions = (g: Group): number => g.conditions.reduce((n, c) => n + (isGroup(c) ? countConditions(c) : 1), 0);
