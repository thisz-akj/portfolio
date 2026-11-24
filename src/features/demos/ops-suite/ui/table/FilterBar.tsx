"use client";

import { useState } from "react";
import { ListFilter, Plus, X } from "lucide-react";
import { describeCondition } from "../../filters/describe";
import { isGroup, type Condition, type EntityMeta, type Group, type Option } from "../../filters/types";
import { ConditionEditor } from "./ConditionEditor";
import { Popover } from "./Popover";

/**
 * Filter chips for the top-level group. Each chip opens an editor; "Add filter" appends one.
 * The top-level combinator toggles between match-all and match-any. Nested groups (from saved views or URLs)
 * show as a single removable chip.
 */
export function FilterBar({
  meta,
  filter,
  facets,
  options,
  onChange,
}: {
  meta: EntityMeta;
  filter: Group;
  facets: Record<string, Record<string, number>>;
  options: Record<string, Option[]>;
  onChange: (g: Group) => void;
}) {
  const [openIdx, setOpenIdx] = useState<number | "new" | null>(null);
  const replaceAt = (i: number, c: Condition | null) =>
    onChange({ ...filter, conditions: c ? filter.conditions.map((x, j) => (j === i ? c : x)) : filter.conditions.filter((_, j) => j !== i) });

  const describeGroup = (g: Group): string =>
    g.conditions
      .map((c) => {
        if (isGroup(c)) return `(${describeGroup(c)})`;
        const d = describeCondition(meta, c, options);
        return `${d.field} ${d.op} ${d.value}`.trim();
      })
      .join(g.combinator === "or" ? " or " : " and ");

  return (
    <div className="ops-filterbar" role="group" aria-label="Filters">
      {filter.conditions.length > 1 && (
        <button
          type="button"
          className="ops-combinator"
          onClick={() => onChange({ ...filter, combinator: filter.combinator === "and" ? "or" : "and" })}
          title="Switch between matching all filters and any filter"
        >
          Match <strong>{filter.combinator === "and" ? "all" : "any"}</strong>
        </button>
      )}

      {filter.conditions.map((c, i) => {
        if (isGroup(c)) {
          return (
            <span key={i} className="ops-chip is-group">
              <span className="ops-chip-text">{describeGroup(c)}</span>
              <button type="button" className="ops-chip-x" aria-label="Remove filter group" onClick={() => replaceAt(i, null)}>
                <X size={12} />
              </button>
            </span>
          );
        }
        const d = describeCondition(meta, c, options);
        return (
          <span key={`${c.field}-${i}`} className="ops-chip">
            <Popover
              open={openIdx === i}
              onOpenChange={(o) => setOpenIdx(o ? i : null)}
              label={`Edit filter on ${d.field}`}
              trigger={(p) => (
                <button type="button" className="ops-chip-text" {...p}>
                  {d.field} <em>{d.op}</em> {d.value && <strong>{d.value}</strong>}
                </button>
              )}
            >
              <ConditionEditor
                meta={meta}
                initial={c}
                facets={facets}
                options={options}
                onApply={(nc) => {
                  replaceAt(i, nc);
                  setOpenIdx(null);
                }}
                onRemove={() => {
                  replaceAt(i, null);
                  setOpenIdx(null);
                }}
              />
            </Popover>
            <button type="button" className="ops-chip-x" aria-label={`Remove filter on ${d.field}`} onClick={() => replaceAt(i, null)}>
              <X size={12} />
            </button>
          </span>
        );
      })}

      <Popover
        open={openIdx === "new"}
        onOpenChange={(o) => setOpenIdx(o ? "new" : null)}
        label="Add filter"
        trigger={(p) => (
          <button type="button" className="ops-btn is-dashed" {...p}>
            {filter.conditions.length ? <Plus size={14} /> : <ListFilter size={14} />} {filter.conditions.length ? "Add filter" : "Filter"}
          </button>
        )}
      >
        <ConditionEditor
          meta={meta}
          facets={facets}
          options={options}
          onApply={(c) => {
            onChange({ ...filter, conditions: [...filter.conditions, c] });
            setOpenIdx(null);
          }}
        />
      </Popover>

      {filter.conditions.length > 0 && (
        <button type="button" className="ops-link" onClick={() => onChange({ combinator: "and", conditions: [] })}>
          Clear all
        </button>
      )}
    </div>
  );
}
