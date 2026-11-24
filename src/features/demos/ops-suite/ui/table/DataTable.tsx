"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Download,
  Plus,
  RotateCcw,
  Rows3,
  Rows4,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { getEntityMeta } from "../../entities";
import { countConditions, parseListQuery, serializeListQuery } from "../../filters/parse";
import { PAGE_SIZES, defaultQuery, fieldOf, visibleColumns, type EntityMeta, type ListQuery, type Option, type SortKey } from "../../filters/types";
import { PORTAL_BASE } from "../../nav";
import { forms } from "../../entities/forms";
import { RecordDrawer, type DrawerTarget } from "../record/RecordDrawer";
import { BulkBar } from "./BulkBar";
import { Cell } from "./Cell";
import { FilterBar } from "./FilterBar";
import { Popover } from "./Popover";
import { useListQuery } from "./useListQuery";

type Row = Record<string, unknown> & { id: number };

export interface DataTableProps {
  entity: string;
  query: ListQuery;
  rows: Row[];
  total: number;
  facets: Record<string, Record<string, number>>;
  options: Record<string, Option[]>;
}

// Per-viewer conveniences in localStorage (may be unavailable: private mode, blocked storage).
const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

interface UserView {
  id: string;
  label: string;
  params: string;
}

/** Canonical string for a query without paging, to detect which view is active. */
const viewKey = (meta: EntityMeta, q: ListQuery) => serializeListQuery(meta, { ...q, page: 1, pageSize: defaultQuery(meta).pageSize }).toString();

export function DataTable({ entity, query: serverQuery, rows, total, facets, options }: DataTableProps) {
  const meta = getEntityMeta(entity)!;
  const { query, update, replace, isPending } = useListQuery(meta, serverQuery);
  const router = useRouter();
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  const cols = visibleColumns(meta, query.cols);
  const fields = cols.map((k) => fieldOf(meta, k)!);

  // ── search (debounced) ──
  const [text, setText] = useState(query.q);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => setText(serverQuery.q), [serverQuery.q]);
  useEffect(() => {
    if (text.trim() === query.q) return;
    const t = setTimeout(() => update({ q: text.trim() }), 300);
    return () => clearTimeout(t);
  }, [text, query.q, update]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── density ──
  const [dense, setDense] = useState(false);
  useEffect(() => setDense(store.get("ops:dense", false)), []);

  // ── selection (reset when the page of rows changes) ──
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const rowIds = rows.map((r) => r.id).join(",");
  useEffect(() => setSelected(new Set()), [rowIds]);
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  // ── sorting: click cycles asc → desc → off; shift-click adds a secondary key ──
  const sortBy = (field: string, additive: boolean) => {
    const cur = query.sort.find((s) => s.field === field);
    const nextDir: SortKey["dir"] | null = !cur ? "asc" : cur.dir === "asc" ? "desc" : null;
    let sort: SortKey[] = additive ? query.sort.filter((s) => s.field !== field) : [];
    if (nextDir) sort = additive ? [...sort, { field, dir: nextDir }].slice(-3) : [{ field, dir: nextDir }];
    update({ sort: sort.length ? sort : meta.defaultSort });
  };

  // ── views ──
  const [userViews, setUserViews] = useState<UserView[]>([]);
  useEffect(() => setUserViews(store.get(`ops:views:${entity}`, [])), [entity]);
  const currentKey = viewKey(meta, query);
  const builtIn = meta.views.map((v) => ({ id: v.id, label: v.label, query: { ...defaultQuery(meta), ...v.query } }));
  const custom = userViews.map((v) => ({ id: v.id, label: v.label, query: parseListQuery(meta, new URLSearchParams(v.params)) }));
  const active = [...builtIn, ...custom].find((v) => viewKey(meta, v.query) === currentKey);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const saveView = () => {
    const label = viewName.trim().slice(0, 60);
    if (!label) return;
    const next = [...userViews, { id: `u${Date.now()}`, label, params: serializeListQuery(meta, { ...query, page: 1 }).toString() }];
    setUserViews(next);
    store.set(`ops:views:${entity}`, next);
    setViewName("");
  };
  const deleteView = (id: string) => {
    const next = userViews.filter((v) => v.id !== id);
    setUserViews(next);
    store.set(`ops:views:${entity}`, next);
  };

  // ── columns ──
  const [colsOpen, setColsOpen] = useState(false);
  const setCols = (next: string[]) => update({ cols: next.length ? next : null });
  const moveCol = (k: string, dir: -1 | 1) => {
    const i = cols.indexOf(k);
    const j = i + dir;
    if (j < 0 || j >= cols.length) return;
    const next = [...cols];
    [next[i], next[j]] = [next[j], next[i]];
    setCols(next);
  };

  // ── export ──
  const exportHref = useMemo(() => {
    const p = serializeListQuery(meta, { ...query, page: 1 });
    if (selected.size) p.set("ids", [...selected].join(","));
    return `/api/demos/ops-suite/${entity}/export?${p}`;
  }, [meta, query, selected, entity]);

  const lastPage = Math.max(1, Math.ceil(total / query.pageSize));
  const from = total ? (query.page - 1) * query.pageSize + 1 : 0;
  const to = Math.min(total, query.page * query.pageSize);
  const nFilters = countConditions(query.filter);

  return (
    <div className={`ops-table-wrap${isPending ? " is-pending" : ""}${dense ? " is-dense" : ""}`} aria-busy={isPending}>
      <div className="ops-progress" aria-hidden="true" />

      <div className="ops-toolbar">
        <div className="ops-search">
          <Search size={14} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") update({ q: text.trim() });
            }}
            placeholder={`Search ${meta.label.toLowerCase()}…`}
            aria-label={`Search ${meta.label.toLowerCase()}`}
            maxLength={200}
          />
          <kbd aria-hidden="true">/</kbd>
        </div>

        <Popover
          open={viewsOpen}
          onOpenChange={setViewsOpen}
          label="Saved views"
          trigger={(p) => (
            <button type="button" className="ops-btn" {...p}>
              <Bookmark size={14} /> {active?.label ?? "Custom view"}
            </button>
          )}
        >
          <div className="ops-menu">
            <p className="ops-menu-label">Views</p>
            {builtIn.map((v) => (
              <button
                key={v.id}
                type="button"
                className="ops-menu-item"
                aria-current={active?.id === v.id || undefined}
                onClick={() => {
                  replace({ ...v.query, page: 1, pageSize: query.pageSize });
                  setViewsOpen(false);
                }}
              >
                <Check size={13} className="ops-menu-check" /> {v.label}
              </button>
            ))}
            {custom.length > 0 && <p className="ops-menu-label">Saved by you</p>}
            {custom.map((v) => (
              <div key={v.id} className="ops-menu-row">
                <button
                  type="button"
                  className="ops-menu-item"
                  aria-current={active?.id === v.id || undefined}
                  onClick={() => {
                    replace({ ...v.query, page: 1, pageSize: query.pageSize });
                    setViewsOpen(false);
                  }}
                >
                  <Check size={13} className="ops-menu-check" /> {v.label}
                </button>
                <button type="button" className="ops-icon-btn" aria-label={`Delete view ${v.label}`} onClick={() => deleteView(v.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {!active && (
              <form
                className="ops-menu-save"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveView();
                }}
              >
                <input value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="Name this view…" aria-label="View name" maxLength={60} />
                <button type="submit" className="ops-btn is-primary" disabled={!viewName.trim()}>
                  Save
                </button>
              </form>
            )}
            <p className="ops-hint">Saved views live in this browser. Share a view by copying the URL.</p>
          </div>
        </Popover>

        <div className="ops-toolbar-end">
          {forms[entity] && (
            <button type="button" className="ops-btn is-primary" onClick={() => setDrawer({ entity, id: "new" })}>
              <Plus size={14} /> New {meta.singular}
            </button>
          )}
          <Popover
            open={colsOpen}
            onOpenChange={setColsOpen}
            align="end"
            label="Columns"
            trigger={(p) => (
              <button type="button" className="ops-btn" {...p}>
                <Columns3 size={14} /> Columns
              </button>
            )}
          >
            <div className="ops-menu ops-cols">
              <p className="ops-menu-label">Shown</p>
              {fields.map((f, i) => (
                <div key={f.key} className="ops-menu-row">
                  <label className="ops-menu-item">
                    <input type="checkbox" checked disabled={cols.length === 1} onChange={() => setCols(cols.filter((k) => k !== f.key))} /> {f.label}
                  </label>
                  <button type="button" className="ops-icon-btn" aria-label={`Move ${f.label} left`} disabled={i === 0} onClick={() => moveCol(f.key, -1)}>
                    <ArrowUp size={13} />
                  </button>
                  <button type="button" className="ops-icon-btn" aria-label={`Move ${f.label} right`} disabled={i === fields.length - 1} onClick={() => moveCol(f.key, 1)}>
                    <ArrowDown size={13} />
                  </button>
                </div>
              ))}
              <p className="ops-menu-label">Hidden</p>
              {meta.fields
                .filter((f) => !cols.includes(f.key))
                .map((f) => (
                  <label key={f.key} className="ops-menu-item">
                    <input type="checkbox" checked={false} onChange={() => setCols([...cols, f.key])} /> {f.label}
                  </label>
                ))}
              <button type="button" className="ops-link" onClick={() => update({ cols: null })}>
                <RotateCcw size={12} /> Reset columns
              </button>
            </div>
          </Popover>

          <button
            type="button"
            className="ops-btn is-icon"
            aria-label={dense ? "Comfortable rows" : "Compact rows"}
            title={dense ? "Comfortable rows" : "Compact rows"}
            onClick={() => {
              setDense(!dense);
              store.set("ops:dense", !dense);
            }}
          >
            {dense ? <Rows3 size={14} /> : <Rows4 size={14} />}
          </button>

          <a className="ops-btn" href={exportHref} download>
            <Download size={14} /> {selected.size ? `Export ${selected.size}` : "Export CSV"}
          </a>
        </div>
      </div>

      <FilterBar meta={meta} filter={query.filter} facets={facets} options={options} onChange={(filter) => update({ filter })} />

      <div className="ops-summary" aria-live="polite">
        <span>
          <strong>{total.toLocaleString("en-IN")}</strong> {total === 1 ? meta.singular : meta.label.toLowerCase()}
          {(nFilters > 0 || query.q) && " match"}
        </span>
        {selected.size > 0 && (
          <span className="ops-selected">
            {selected.size} selected
            <button type="button" className="ops-link" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </span>
        )}
        {selected.size > 0 && meta.bulk && (
          <BulkBar
            entity={entity}
            meta={meta}
            ids={[...selected]}
            options={options}
            onDone={(text, ok) => {
              setNotice({ text, ok });
              if (ok) {
                setSelected(new Set());
                router.refresh();
              }
            }}
          />
        )}
        {notice && (
          <span className={notice.ok ? "ops-notice" : "ops-error"} role="status">
            {notice.text}
          </span>
        )}
      </div>

      <div className="ops-scroll" tabIndex={0} role="region" aria-label={`${meta.label} table`}>
        <table className="ops-table">
          <thead>
            <tr>
              <th className="ops-check">
                <input
                  type="checkbox"
                  aria-label="Select all rows on this page"
                  checked={allOnPage}
                  onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))}
                />
              </th>
              {fields.map((f) => {
                const sIdx = query.sort.findIndex((s) => s.field === f.key);
                const s = query.sort[sIdx];
                return (
                  <th key={f.key} className={f.align === "end" ? "is-end" : undefined} aria-sort={s ? (s.dir === "asc" ? "ascending" : "descending") : "none"} title={f.description}>
                    {f.sortable === false ? (
                      <span>{f.label}</span>
                    ) : (
                      <button type="button" onClick={(e) => sortBy(f.key, e.shiftKey)} title={`Sort by ${f.label} (shift-click to add)`}>
                        {f.label}
                        {s ? s.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowUpDown size={12} className="ops-sort-idle" />}
                        {s && query.sort.length > 1 && <sup>{sIdx + 1}</sup>}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} aria-selected={selected.has(r.id)}>
                <td className="ops-check">
                  <input
                    type="checkbox"
                    aria-label={`Select row ${r.id}`}
                    checked={selected.has(r.id)}
                    onChange={() => {
                      const next = new Set(selected);
                      if (next.has(r.id)) next.delete(r.id);
                      else next.add(r.id);
                      setSelected(next);
                    }}
                  />
                </td>
                {fields.map((f) => (
                  <td key={f.key} className={f.align === "end" ? "is-end" : undefined}>
                    {f.primary && meta.rowHref ? (
                      meta.rowHref(r) ? (
                        <Link href={meta.rowHref(r)!} className="ops-row-link">
                          <Cell field={f} row={r} options={options[f.key]} />
                        </Link>
                      ) : (
                        <Cell field={f} row={r} options={options[f.key]} />
                      )
                    ) : f.primary ? (
                      <Link
                        href={`${PORTAL_BASE}/${entity}/${r.id}`}
                        className="ops-row-link"
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                          e.preventDefault();
                          setDrawer({ entity, id: r.id });
                        }}
                      >
                        <Cell field={f} row={r} options={options[f.key]} />
                      </Link>
                    ) : (
                      <Cell field={f} row={r} options={options[f.key]} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="ops-empty">
            <p>No {meta.label.toLowerCase()} match these filters.</p>
            <button type="button" className="ops-btn" onClick={() => replace({ ...defaultQuery(meta), cols: query.cols, pageSize: query.pageSize })}>
              <X size={14} /> Clear search and filters
            </button>
          </div>
        )}
      </div>

      {drawer && <RecordDrawer target={drawer} onClose={() => setDrawer(null)} onChanged={() => router.refresh()} />}

      <nav className="ops-pager" aria-label="Pagination">
        <span>
          {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}
        </span>
        <label>
          Rows
          <select value={query.pageSize} onChange={(e) => update({ pageSize: Number(e.target.value) })}>
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="ops-pager-btns">
          <button type="button" className="ops-btn is-icon" aria-label="First page" disabled={query.page <= 1} onClick={() => update({ page: 1 })}>
            <ChevronsLeft size={14} />
          </button>
          <button type="button" className="ops-btn is-icon" aria-label="Previous page" disabled={query.page <= 1} onClick={() => update({ page: query.page - 1 })}>
            <ChevronLeft size={14} />
          </button>
          <span className="ops-page">
            Page {query.page} of {lastPage}
          </span>
          <button type="button" className="ops-btn is-icon" aria-label="Next page" disabled={query.page >= lastPage} onClick={() => update({ page: query.page + 1 })}>
            <ChevronRight size={14} />
          </button>
          <button type="button" className="ops-btn is-icon" aria-label="Last page" disabled={query.page >= lastPage} onClick={() => update({ page: lastPage })}>
            <ChevronsRight size={14} />
          </button>
        </div>
      </nav>
    </div>
  );
}
