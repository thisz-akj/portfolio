"use client";

import { useMemo, useState } from "react";
import { validateCondition } from "../../filters/parse";
import {
  DATE_PRESETS,
  DATE_PRESET_LABELS,
  NULLARY_OPS,
  OPS,
  OP_LABELS,
  fieldOf,
  type Condition,
  type EntityMeta,
  type FieldMeta,
  type Op,
  type Option,
} from "../../filters/types";
import { formatINR, parseAmount } from "../../lib/format";

const DEFAULT_OP: Record<FieldMeta["type"], Op> = {
  text: "contains",
  enum: "in",
  relation: "in",
  tags: "has_any",
  number: "gte",
  money: "gte",
  date: "preset",
  boolean: "is_true",
};

interface Draft {
  field: string;
  op: Op;
  text: string;
  list: string[];
  a: string;
  b: string;
}

const draftFrom = (meta: EntityMeta, c?: Condition): Draft => {
  const field = c?.field ?? meta.fields.find((f) => f.filterable !== false)!.key;
  const type = fieldOf(meta, field)!.type;
  const v = c?.value;
  const pair = Array.isArray(v) && (c?.op === "between") ? v : null;
  return {
    field,
    op: c?.op ?? DEFAULT_OP[type],
    text: typeof v === "string" && !pair ? v : "",
    list: Array.isArray(v) && !pair ? v.map(String) : [],
    a: pair ? String(pair[0]) : typeof v === "number" ? String(v) : type === "date" && typeof v === "string" && c?.op !== "preset" ? v : "",
    // (older_than / within_last store a number of days, handled by the typeof v === "number" branch)
    b: pair ? String(pair[1]) : "",
  };
};

/** Builds a Condition from the editor state, or null when incomplete/invalid. */
function toCondition(meta: EntityMeta, d: Draft): Condition | null {
  const f = fieldOf(meta, d.field);
  if (!f) return null;
  if (NULLARY_OPS.includes(d.op)) return validateCondition(meta, { field: d.field, op: d.op });
  const num = (s: string) => (f.type === "money" ? parseAmount(s) : s.trim() === "" ? null : Number(s));
  let value: Condition["value"];
  switch (f.type) {
    case "text":
      value = d.text;
      break;
    case "enum":
    case "tags":
      value = d.list;
      break;
    case "relation":
      value = d.list.map(Number);
      break;
    case "number":
    case "money": {
      const a = num(d.a);
      const b = num(d.b);
      if (a === null || Number.isNaN(a)) return null;
      if (d.op === "between") {
        if (b === null || Number.isNaN(b)) return null;
        value = [a, b];
      } else value = a;
      break;
    }
    case "date":
      if (d.op === "older_than" || d.op === "within_last") {
        if (!/^\d+$/.test(d.a.trim())) return null;
        value = Number(d.a);
      } else value = d.op === "preset" ? d.text || "last_30_days" : d.op === "between" ? [d.a, d.b] : d.a;
      break;
    default:
      return null;
  }
  return validateCondition(meta, { field: d.field, op: d.op, value });
}

export function ConditionEditor({
  meta,
  initial,
  facets,
  options,
  onApply,
  onRemove,
}: {
  meta: EntityMeta;
  initial?: Condition;
  facets: Record<string, Record<string, number>>;
  options: Record<string, Option[]>;
  onApply: (c: Condition) => void;
  onRemove?: () => void;
}) {
  const [d, setD] = useState<Draft>(() => draftFrom(meta, initial));
  const [search, setSearch] = useState("");
  const field = fieldOf(meta, d.field)!;
  const condition = useMemo(() => toCondition(meta, d), [meta, d]);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  const choices = field.options ?? options[field.key] ?? [];
  const counts = facets[field.key];
  const visibleChoices = search ? choices.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())) : choices;
  const money = field.type === "money";
  const hint = (s: string) => {
    if (!money || !s) return null;
    const n = parseAmount(s);
    return <span className="ops-hint">{n === null ? "Try 5L, 1.2Cr or 50000" : formatINR(n)}</span>;
  };

  return (
    <form
      className="ops-cond"
      onSubmit={(e) => {
        e.preventDefault();
        if (condition) onApply(condition);
      }}
    >
      <div className="ops-cond-row">
        <label className="ops-sr" htmlFor="cond-field">
          Field
        </label>
        <select
          id="cond-field"
          data-autofocus
          value={d.field}
          onChange={(e) => {
            const nf = fieldOf(meta, e.target.value)!;
            setSearch("");
            setD({ field: nf.key, op: DEFAULT_OP[nf.type], text: "", list: [], a: "", b: "" });
          }}
        >
          {meta.fields
            .filter((f) => f.filterable !== false)
            .map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
        </select>
        <label className="ops-sr" htmlFor="cond-op">
          Operator
        </label>
        <select id="cond-op" value={d.op} onChange={(e) => set({ op: e.target.value as Op })}>
          {OPS[field.type].map((op) => (
            <option key={op} value={op}>
              {OP_LABELS[op]}
            </option>
          ))}
        </select>
      </div>

      {!NULLARY_OPS.includes(d.op) && (
        <div className="ops-cond-value">
          {field.type === "text" && (
            <input type="text" aria-label="Value" value={d.text} onChange={(e) => set({ text: e.target.value })} placeholder="Type a value…" maxLength={200} />
          )}

          {(field.type === "enum" || field.type === "relation" || field.type === "tags") && (
            <>
              {choices.length > 8 && <input type="search" aria-label={`Search ${field.label}`} placeholder={`Search ${field.label.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} />}
              <ul className="ops-choices" role="group" aria-label={field.label}>
                {visibleChoices.map((o) => {
                  const checked = d.list.includes(o.value);
                  return (
                    <li key={o.value}>
                      <label>
                        <input type="checkbox" checked={checked} onChange={() => set({ list: checked ? d.list.filter((x) => x !== o.value) : [...d.list, o.value] })} />
                        {o.color && <span className="ops-pill-dot" style={{ background: o.color }} aria-hidden="true" />}
                        <span className="ops-choice-label">{o.label}</span>
                        {counts && <span className="ops-count">{(counts[o.value] ?? 0).toLocaleString("en-IN")}</span>}
                      </label>
                    </li>
                  );
                })}
                {!visibleChoices.length && <li className="ops-null">No matches</li>}
              </ul>
            </>
          )}

          {(field.type === "number" || money) && (
            <div className="ops-cond-pair">
              <div>
                <input inputMode={money ? "text" : "decimal"} aria-label={d.op === "between" ? "Minimum" : "Value"} placeholder={money ? "e.g. 5L" : d.op === "between" ? "Min" : "Value"} value={d.a} onChange={(e) => set({ a: e.target.value })} />
                {hint(d.a)}
              </div>
              {d.op === "between" && (
                <div>
                  <input inputMode={money ? "text" : "decimal"} aria-label="Maximum" placeholder={money ? "e.g. 1Cr" : "Max"} value={d.b} onChange={(e) => set({ b: e.target.value })} />
                  {hint(d.b)}
                </div>
              )}
            </div>
          )}

          {field.type === "date" &&
            (d.op === "older_than" || d.op === "within_last" ? (
              <div className="ops-cond-pair">
                <input inputMode="numeric" aria-label="Number of days" placeholder="e.g. 90" value={d.a} onChange={(e) => set({ a: e.target.value })} />
                <span className="ops-hint" style={{ alignSelf: "center" }}>
                  days{d.op === "older_than" ? " ago" : ""}
                </span>
              </div>
            ) : d.op === "preset" ? (
              <select aria-label="Period" value={d.text || "last_30_days"} onChange={(e) => set({ text: e.target.value })}>
                {DATE_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {DATE_PRESET_LABELS[p]}
                  </option>
                ))}
              </select>
            ) : (
              <div className="ops-cond-pair">
                <input type="date" aria-label={d.op === "between" ? "From" : "Date"} value={d.a} onChange={(e) => set({ a: e.target.value })} />
                {d.op === "between" && <input type="date" aria-label="To" value={d.b} onChange={(e) => set({ b: e.target.value })} />}
              </div>
            ))}
        </div>
      )}

      {field.description && <p className="ops-hint">{field.description}</p>}

      <div className="ops-cond-actions">
        {onRemove && (
          <button type="button" className="ops-btn is-ghost" onClick={onRemove}>
            Remove
          </button>
        )}
        <button type="submit" className="ops-btn is-primary" disabled={!condition}>
          {initial ? "Update" : "Add filter"}
        </button>
      </div>
    </form>
  );
}
