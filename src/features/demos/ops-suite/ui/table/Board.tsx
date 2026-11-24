"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { bulkAction } from "../../data/actions";
import type { BoardColumn } from "../../data/board";
import { getEntityMeta } from "../../entities";
import { LOST_REASONS } from "../../entities/crm-options";
import { serializeFilter } from "../../filters/parse";
import type { ListQuery, Option } from "../../filters/types";
import { formatDate, formatINR } from "../../lib/format";
import { PORTAL_BASE } from "../../nav";
import { RecordDrawer, type DrawerTarget } from "../record/RecordDrawer";
import { Pill } from "./Cell";
import { FilterBar } from "./FilterBar";
import { useListQuery } from "./useListQuery";

/** Kanban for entities with `meta.board`. Drag a card (or use its "Move to" picker) to change the stage. */
export function Board({ entity, query: serverQuery, columns: serverColumns, options }: { entity: string; query: ListQuery; columns: BoardColumn[]; options: Record<string, Option[]> }) {
  const meta = getEntityMeta(entity)!;
  const board = meta.board!;
  const router = useRouter();
  const { query, update, isPending } = useListQuery(meta, serverQuery);
  const [columns, setColumns] = useState(serverColumns);
  const [drag, setDrag] = useState<{ id: number; from: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [lost, setLost] = useState<{ id: number; from: string; reason: string } | null>(null);
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, start] = useTransition();
  const [text, setText] = useState(query.q);
  const lostRef = useRef<HTMLSelectElement>(null);

  useEffect(() => setColumns(serverColumns), [serverColumns]);
  useEffect(() => setText(serverQuery.q), [serverQuery.q]);
  useEffect(() => {
    if (text.trim() === query.q) return;
    const t = setTimeout(() => update({ q: text.trim() }), 300);
    return () => clearTimeout(t);
  }, [text, query.q, update]);
  useEffect(() => {
    if (lost) lostRef.current?.focus();
  }, [lost]);

  const sumField = board.sum;
  const move = (id: number, from: string, to: string, lostReason?: string) => {
    if (from === to) return;
    if (to === "lost" && !lostReason) return setLost({ id, from, reason: "" });
    const snapshot = columns;
    const card = columns.find((c) => c.value === from)?.cards.find((c) => c.id === id);
    if (!card) return;
    const amount = Number(card[sumField] ?? 0);
    setColumns((cols) =>
      cols.map((c) =>
        c.value === from
          ? { ...c, count: c.count - 1, sum: c.sum - amount, cards: c.cards.filter((x) => x.id !== id) }
          : c.value === to
            ? { ...c, count: c.count + 1, sum: c.sum + amount, cards: [card, ...c.cards] }
            : c,
      ),
    );
    start(async () => {
      const res = await bulkAction(entity, [id], { kind: "enum", field: board.field, value: to, ...(lostReason ? { lostReason } : {}) });
      if (res.ok) {
        const label = columns.find((c) => c.value === to)?.label ?? to;
        setNotice({ text: `Moved “${card.title}” to ${label}`, ok: true });
        router.refresh();
      } else {
        setColumns(snapshot);
        setNotice({ text: res.message ?? "Couldn't move that deal", ok: false });
      }
    });
  };

  const stageHref = (value: string) =>
    `${PORTAL_BASE}/${entity}?f=${encodeURIComponent(serializeFilter({ ...query.filter, combinator: "and", conditions: [...(query.filter.combinator === "and" ? query.filter.conditions : [query.filter]), { field: board.field, op: "in", value: [value] }] })!)}${query.q ? `&q=${encodeURIComponent(query.q)}` : ""}`;

  return (
    <div className={`ops-table-wrap${isPending || saving ? " is-pending" : ""}`}>
      <div className="ops-progress" aria-hidden="true" />
      <div className="ops-toolbar">
        <div className="ops-search">
          <Search size={14} aria-hidden="true" />
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Search ${meta.label.toLowerCase()}…`} aria-label={`Search ${meta.label.toLowerCase()}`} maxLength={200} />
        </div>
        <div className="ops-toolbar-end">
          <button type="button" className="ops-btn is-primary" onClick={() => setDrawer({ entity, id: "new" })}>
            <Plus size={14} /> New {meta.singular}
          </button>
        </div>
      </div>
      <FilterBar meta={meta} filter={query.filter} facets={{}} options={options} onChange={(filter) => update({ filter })} />
      {notice && (
        <p className={notice.ok ? "ops-notice" : "ops-error"} role="status">
          {notice.text}
        </p>
      )}

      <div className="ops-board" role="list" aria-label={`${meta.label} by ${board.field}`}>
        {columns.map((col) => (
          <section
            key={col.value}
            role="listitem"
            aria-label={`${col.label}: ${col.count}`}
            className={`ops-col${over === col.value && drag && drag.from !== col.value ? " is-over" : ""}${board.closed?.includes(col.value) ? " is-closed" : ""}`}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              setOver(col.value);
            }}
            onDragLeave={() => setOver((o) => (o === col.value ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              if (drag) move(drag.id, drag.from, col.value);
              setDrag(null);
            }}
          >
            <header>
              <Pill option={{ value: col.value, label: col.label, color: col.color }} value={col.label} />
              <span className="ops-count">{col.count.toLocaleString("en-IN")}</span>
              <span className="ops-col-sum">{formatINR(col.sum, { compact: true })}</span>
            </header>
            <ul>
              {col.cards.map((c) => (
                <li
                  key={c.id}
                  className={`ops-card-k${drag?.id === c.id ? " is-dragging" : ""}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(c.id));
                    setDrag({ id: c.id, from: col.value });
                  }}
                  onDragEnd={() => {
                    setDrag(null);
                    setOver(null);
                  }}
                >
                  <Link
                    href={`${PORTAL_BASE}/${entity}/${c.id}`}
                    className="ops-card-title"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                      e.preventDefault();
                      setDrawer({ entity, id: c.id });
                    }}
                  >
                    {String(c.title)}
                  </Link>
                  <p className="ops-card-sub">{String(c.companyName ?? "")}</p>
                  <div className="ops-card-meta">
                    <strong>{formatINR(Number(c.value), { compact: true })}</strong>
                    {c.closedAt ? (
                      <span>Closed {formatDate(c.closedAt as Date)}</span>
                    ) : (
                      <span className={c.slipped ? "is-late" : undefined}>{c.slipped ? "Overdue · " : ""}{formatDate(String(c.expectedClose))}</span>
                    )}
                  </div>
                  <div className="ops-card-foot">
                    <span className="ops-avatar" title={String(c.ownerName ?? "Unassigned")} aria-label={`Owner ${c.ownerName ?? "unassigned"}`}>
                      {String(c.ownerName ?? "?")
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <label className="ops-sr" htmlFor={`mv-${c.id}`}>
                      Move {String(c.title)} to
                    </label>
                    <select id={`mv-${c.id}`} className="ops-card-move" value={col.value} onChange={(e) => move(c.id, col.value, e.target.value)}>
                      {columns.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.value === col.value ? `In ${o.label}` : `Move to ${o.label}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
            {col.count > col.cards.length && (
              <Link className="ops-link ops-col-more" href={stageHref(col.value)}>
                +{(col.count - col.cards.length).toLocaleString("en-IN")} more in table
              </Link>
            )}
            {col.count === 0 && <p className="ops-null ops-col-empty">No {meta.label.toLowerCase()}</p>}
          </section>
        ))}
      </div>

      {lost && (
        <div className="ops-modal-root">
          <div className="ops-drawer-scrim" onClick={() => setLost(null)} aria-hidden="true" />
          <form
            className="ops-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lost-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setLost(null);
              }
            }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!lost.reason) return;
              move(lost.id, lost.from, "lost", lost.reason);
              setLost(null);
            }}
          >
            <h2 id="lost-title">Why was this deal lost?</h2>
            <select ref={lostRef} value={lost.reason} onChange={(e) => setLost({ ...lost, reason: e.target.value })} aria-label="Lost reason">
              <option value="">Choose a reason…</option>
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <div className="ops-form-actions">
              <button type="button" className="ops-btn is-ghost" onClick={() => setLost(null)}>
                Cancel
              </button>
              <button type="submit" className="ops-btn is-primary" disabled={!lost.reason}>
                Mark as lost
              </button>
            </div>
          </form>
        </div>
      )}

      {drawer && <RecordDrawer target={drawer} onClose={() => setDrawer(null)} onChanged={() => router.refresh()} />}
    </div>
  );
}
