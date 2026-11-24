import { and, asc, desc, getTableName, inArray, not, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { addDaysISO, presetRange, todayIST } from "./dates";
import type { Db } from "../db/client";
import { fieldOf, isGroup, type Condition, type DatePreset, type EntityMeta, type Group, type ListQuery, type Option } from "./types";

/**
 * Filter tree → SQL. Server-only. Only fields declared in an entity's server config can reach SQL, and every
 * user value is bound as a parameter (never interpolated), so the client can't inject SQL or touch other columns.
 */

export type Expr = SQL | AnyPgColumn;

export interface ServerField {
  /** Expression for filtering, sorting and selecting. For dates it must be a `date` (use istDate() for timestamps). */
  expr: Expr;
  /** Selected value when it differs from expr (e.g. a timestamp shown raw but filtered as an IST date). */
  select?: Expr;
  /** relation: expression for the display label (selected as meta.labelKey, used for sorting). */
  label?: Expr;
  /** included in free-text search */
  searchable?: boolean;
}

export interface EntityServer {
  meta: EntityMeta;
  table: PgTable;
  id: AnyPgColumn;
  fields: Record<string, ServerField>;
  /** entity name used in entity_tags (tags fields) */
  tagEntity?: string;
  /** options for relation/tags fields (dynamicOptions), keyed by field */
  options?: (db: Db) => Promise<Record<string, Option[]>>;
}

/**
 * A column always rendered as "table"."column". Drizzle omits the table name in single-table queries, which
 * silently rebinds the column inside correlated subqueries (e.g. "id" → the subquery's own id). Use this for
 * every outer-row reference inside a subquery.
 */
export const outer = (col: AnyPgColumn) => sql`${sql.identifier(getTableName(col.table))}.${sql.identifier(col.name)}`;

/** A timestamptz as a calendar date in IST. */
export const istDate = (col: Expr) => sql`((${col}) at time zone 'Asia/Kolkata')::date`;

/** Escapes LIKE wildcards so user text matches literally. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const tagsMatch = (entity: string, id: AnyPgColumn, names: string[]) =>
  sql`select 1 from entity_tags et join tags t on t.id = et.tag_id where et.entity = ${entity} and et.entity_id = ${outer(id)} and t.name in ${names}`;

/** Selected JSON array of tag names for a row. */
export const tagsSelect = (entity: string, id: AnyPgColumn) =>
  sql<string[]>`coalesce((select json_agg(t.name order by t.name) from entity_tags et join tags t on t.id = et.tag_id where et.entity = ${entity} and et.entity_id = ${outer(id)}), '[]'::json)`;

export function conditionToSql(ent: EntityServer, c: Condition, now = new Date()): SQL | undefined {
  const meta = fieldOf(ent.meta, c.field);
  const sf = ent.fields[c.field];
  if (!meta || !sf) return undefined;
  const e = sf.expr;
  const v = c.value;
  const isNull = sql`${e} is null`;
  const notNull = sql`${e} is not null`;

  switch (meta.type) {
    case "text": {
      const s = String(v ?? "");
      switch (c.op) {
        case "contains":
          return sql`${e} ilike ${`%${escapeLike(s)}%`}`;
        case "not_contains":
          return sql`coalesce(${e}, '') not ilike ${`%${escapeLike(s)}%`}`;
        case "starts_with":
          return sql`${e} ilike ${`${escapeLike(s)}%`}`;
        case "eq":
          return sql`lower(${e}) = lower(${s})`;
        case "neq":
          return sql`lower(coalesce(${e}, '')) <> lower(${s})`;
        case "is_empty":
          return sql`(${e} is null or ${e} = '')`;
        case "is_not_empty":
          return sql`(${e} is not null and ${e} <> '')`;
      }
      return undefined;
    }
    case "enum":
    case "relation": {
      const list = (v as (string | number)[]) ?? [];
      switch (c.op) {
        case "in":
          return inArray(e as AnyPgColumn, list);
        case "not_in":
          return or(isNull, not(inArray(e as AnyPgColumn, list)));
        case "is_empty":
          return isNull;
        case "is_not_empty":
          return notNull;
      }
      return undefined;
    }
    case "number":
    case "money": {
      switch (c.op) {
        case "eq":
          return sql`${e} = ${v}`;
        case "neq":
          return sql`(${e} is null or ${e} <> ${v})`;
        case "gt":
          return sql`${e} > ${v}`;
        case "gte":
          return sql`${e} >= ${v}`;
        case "lt":
          return sql`${e} < ${v}`;
        case "lte":
          return sql`${e} <= ${v}`;
        case "between": {
          const [a, b] = v as [number, number];
          return sql`${e} between ${a} and ${b}`;
        }
        case "is_empty":
          return isNull;
        case "is_not_empty":
          return notNull;
      }
      return undefined;
    }
    case "date": {
      switch (c.op) {
        case "preset": {
          const r = presetRange(v as DatePreset, now);
          return and(r.from ? sql`${e} >= ${r.from}::date` : undefined, r.to ? sql`${e} < ${r.to}::date` : undefined);
        }
        case "older_than":
          return sql`${e} < ${addDaysISO(todayIST(now), -Number(v))}::date`;
        case "within_last":
          return sql`${e} >= ${addDaysISO(todayIST(now), -Number(v))}::date`;
        case "on":
          return sql`${e} = ${v}::date`;
        case "before":
          return sql`${e} < ${v}::date`;
        case "after":
          return sql`${e} > ${v}::date`;
        case "between": {
          const [a, b] = v as [string, string];
          return sql`${e} between ${a}::date and ${b}::date`;
        }
        case "is_empty":
          return isNull;
        case "is_not_empty":
          return notNull;
      }
      return undefined;
    }
    case "boolean":
      return c.op === "is_true" ? sql`${e} is true` : sql`${e} is not true`;
    case "tags": {
      if (!ent.tagEntity) return undefined;
      const names = v as string[];
      const match = tagsMatch(ent.tagEntity, ent.id, names);
      switch (c.op) {
        case "has_any":
          return sql`exists (${match})`;
        case "has_none":
          return sql`not exists (${match})`;
        case "has_all":
          return sql`(select count(distinct t.name) from entity_tags et join tags t on t.id = et.tag_id where et.entity = ${ent.tagEntity} and et.entity_id = ${outer(ent.id)} and t.name in ${names}) = ${new Set(names).size}`;
      }
      return undefined;
    }
  }
}

export function groupToSql(ent: EntityServer, g: Group, now = new Date()): SQL | undefined {
  const parts = g.conditions.map((c) => (isGroup(c) ? groupToSql(ent, c, now) : conditionToSql(ent, c, now))).filter((p): p is SQL => !!p);
  if (!parts.length) return undefined;
  return g.combinator === "or" ? or(...parts) : and(...parts);
}

/** Every word must match at least one searchable field. */
export function searchToSql(ent: EntityServer, q: string): SQL | undefined {
  const cols = Object.values(ent.fields).filter((f) => f.searchable).map((f) => f.expr);
  const words = q.split(/\s+/).filter(Boolean).slice(0, 8);
  if (!cols.length || !words.length) return undefined;
  return and(...words.map((w) => or(...cols.map((c) => sql`${c} ilike ${`%${escapeLike(w)}%`}`))));
}

export function whereFor(ent: EntityServer, q: Pick<ListQuery, "q" | "filter">, now = new Date()): SQL | undefined {
  return and(searchToSql(ent, q.q), groupToSql(ent, q.filter, now));
}

export function orderFor(ent: EntityServer, q: Pick<ListQuery, "sort">): SQL[] {
  const keys = q.sort
    .filter((s) => ent.fields[s.field] && fieldOf(ent.meta, s.field)?.sortable !== false)
    .map((s) => {
      const f = ent.fields[s.field];
      const e = f.label ?? f.expr;
      return s.dir === "desc" ? sql`${desc(e)} nulls last` : sql`${asc(e)} nulls last`;
    });
  return [...keys, asc(ent.id)]; // stable pagination
}

/** Column → expression map for the SELECT, including relation labels. */
export function selectionFor(ent: EntityServer, keys: string[]): Record<string, Expr> {
  const sel: Record<string, Expr> = { id: ent.id };
  for (const k of keys) {
    const f = ent.fields[k];
    const m = fieldOf(ent.meta, k);
    if (!f || !m) continue;
    sel[k] = f.select ?? f.expr;
    if (m.labelKey && f.label) sel[m.labelKey] = f.label;
  }
  return sel;
}

/** The filter minus top-level AND conditions on `field` — used for facet counts ("what if I change this filter?"). */
export function withoutField(g: Group, field: string): Group {
  if (g.combinator !== "and") return g;
  return { ...g, conditions: g.conditions.filter((c) => isGroup(c) || c.field !== field) };
}
