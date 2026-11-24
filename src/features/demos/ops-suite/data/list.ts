import { and, count, inArray, type SQL } from "drizzle-orm";
import { getDb } from "../db/client";
import { orderFor, selectionFor, whereFor, withoutField, type EntityServer } from "../filters/toSql";
import { visibleColumns, type ListQuery, type Option } from "../filters/types";

/** Server-side list loading for the generic DataTable and CSV export. */

export type Row = Record<string, unknown> & { id: number };

export interface ListResult {
  rows: Row[];
  total: number;
  /** page actually served (clamped to the last page) */
  page: number;
  /** facet counts per field: option value → rows matching the other filters */
  facets: Record<string, Record<string, number>>;
  /** relation/tags options per field */
  options: Record<string, Option[]>;
}

export async function listEntity(ent: EntityServer, query: ListQuery, now = new Date()): Promise<ListResult> {
  const db = await getDb();
  const where = whereFor(ent, query, now);
  const cols = visibleColumns(ent.meta, query.cols);

  const [[{ n: total }], facets, options] = await Promise.all([
    db.select({ n: count() }).from(ent.table).where(where),
    facetCounts(ent, query, now),
    ent.options ? ent.options(db) : Promise.resolve({}),
  ]);

  const lastPage = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, lastPage);
  const rows = (await db
    .select(selectionFor(ent, cols))
    .from(ent.table)
    .where(where)
    .orderBy(...orderFor(ent, query))
    .limit(query.pageSize)
    .offset((page - 1) * query.pageSize)) as Row[];

  return { rows, total, page, facets, options };
}

async function facetCounts(ent: EntityServer, query: ListQuery, now: Date) {
  const db = await getDb();
  const fields = ent.meta.fields.filter((f) => f.facet && (f.type === "enum" || f.type === "relation") && ent.fields[f.key]);
  const results = await Promise.all(
    fields.map(async (f) => {
      const expr = ent.fields[f.key].expr;
      const where = whereFor(ent, { q: query.q, filter: withoutField(query.filter, f.key) }, now);
      const rows = await db.select({ v: expr, n: count() }).from(ent.table).where(where).groupBy(expr);
      return [f.key, Object.fromEntries(rows.map((r) => [String(r.v), r.n]))] as const;
    }),
  );
  return Object.fromEntries(results);
}

export const EXPORT_LIMIT = 10_000;

/** All matching rows (capped) for CSV export; optional explicit ids (selected rows). */
export async function exportRows(ent: EntityServer, query: ListQuery, ids: number[] | null, now = new Date()) {
  const db = await getDb();
  const where: SQL | undefined = and(whereFor(ent, query, now), ids ? inArray(ent.id, ids) : undefined);
  const cols = visibleColumns(ent.meta, query.cols);
  const rows = (await db
    .select(selectionFor(ent, cols))
    .from(ent.table)
    .where(where)
    .orderBy(...orderFor(ent, query))
    .limit(EXPORT_LIMIT)) as Row[];
  return { rows, cols };
}
