import { and, count, desc, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { deals } from "../db/schema";
import { selectionFor, whereFor, type EntityServer } from "../filters/toSql";
import type { ListQuery, Option } from "../filters/types";
import type { Row } from "./list";

/** Kanban data: per column of the board's enum field — count, sum and the top cards — under the current search/filter. */

export interface BoardColumn {
  value: string;
  label: string;
  color?: string;
  count: number;
  sum: number;
  cards: Row[];
}

export const BOARD_CARD_LIMIT = 40;
const CARD_FIELDS = ["title", "company", "value", "owner", "expectedClose", "slipped", "probability", "tags", "closedAt"];

export async function loadBoard(ent: EntityServer, query: ListQuery, now = new Date()): Promise<{ columns: BoardColumn[]; options: Record<string, Option[]> }> {
  const board = ent.meta.board;
  if (!board) throw new Error(`${ent.meta.key} has no board`);
  const db = await getDb();
  const field = ent.meta.fields.find((f) => f.key === board.field)!;
  const groupExpr = ent.fields[board.field].expr;
  const sumExpr = ent.fields[board.sum].expr;
  const base = whereFor(ent, query, now);
  const cols = CARD_FIELDS.filter((k) => ent.fields[k]);

  const [totals, options, ...cards] = await Promise.all([
    db.select({ v: groupExpr, n: count(), s: sql<number>`coalesce(sum(${sumExpr}), 0)`.mapWith(Number) }).from(ent.table).where(base).groupBy(groupExpr),
    ent.options ? ent.options(db) : Promise.resolve({}),
    ...(field.options ?? []).map((o) => {
      const closed = board.closed?.includes(o.value);
      return db
        .select(selectionFor(ent, cols))
        .from(ent.table)
        .where(and(base, sql`${groupExpr} = ${o.value}`))
        .orderBy(closed ? sql`${deals.closedAt} desc nulls last` : desc(sumExpr as typeof deals.value), ent.id)
        .limit(BOARD_CARD_LIMIT) as unknown as Promise<Row[]>;
    }),
  ]);
  const byValue = new Map(totals.map((t) => [String(t.v), t]));
  return {
    options,
    columns: (field.options ?? []).map((o, i) => ({ value: o.value, label: o.label, color: o.color, count: byValue.get(o.value)?.n ?? 0, sum: byValue.get(o.value)?.s ?? 0, cards: cards[i] })),
  };
}
