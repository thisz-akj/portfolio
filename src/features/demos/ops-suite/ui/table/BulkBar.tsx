"use client";

import { useState, useTransition } from "react";
import { Tag, UserPlus } from "lucide-react";
import { bulkAction } from "../../data/actions";
import type { BulkAction } from "../../data/mutate";
import { LOST_REASONS } from "../../entities/crm-options";
import { forms } from "../../entities/forms";
import { fieldOf, type EntityMeta, type Option } from "../../filters/types";
import { Popover } from "./Popover";

/** Actions on selected rows: assign owner, set an enum (status/stage/lifecycle), add/remove a tag. */
export function BulkBar({
  entity,
  meta,
  ids,
  options,
  onDone,
}: {
  entity: string;
  meta: EntityMeta;
  ids: number[];
  options: Record<string, Option[]>;
  onDone: (message: string, ok: boolean) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [value, setValue] = useState("");
  const [extra, setExtra] = useState("");
  const bulk = meta.bulk ?? {};
  const n = ids.length;

  const run = (action: BulkAction, label: string) =>
    start(async () => {
      const res = await bulkAction(entity, ids, action);
      setOpen(null);
      setValue("");
      setExtra("");
      if (res.ok) onDone(`${label} — ${res.id} of ${n} ${n === 1 ? meta.singular : meta.label.toLowerCase()} changed`, true);
      else onDone(res.message ?? "Couldn't apply that change", false);
    });

  const panel = (key: string, label: string, body: React.ReactNode, apply: () => void, canApply: boolean) => (
    <Popover
      key={key}
      open={open === key}
      onOpenChange={(o) => {
        setOpen(o ? key : null);
        setValue("");
        setExtra("");
      }}
      label={label}
      trigger={(p) => (
        <button type="button" className="ops-btn" disabled={pending} {...p}>
          {key === "owner" ? <UserPlus size={14} /> : key === "tag" ? <Tag size={14} /> : null} {label}
        </button>
      )}
    >
      <form
        className="ops-cond"
        onSubmit={(e) => {
          e.preventDefault();
          if (canApply) apply();
        }}
      >
        {body}
        <div className="ops-cond-actions">
          <button type="submit" className="ops-btn is-primary" disabled={!canApply || pending}>
            {pending ? "Applying…" : `Apply to ${n}`}
          </button>
        </div>
      </form>
    </Popover>
  );

  return (
    <div className="ops-bulk" role="toolbar" aria-label={`Actions for ${n} selected`}>
      {bulk.owner &&
        panel(
          "owner",
          "Assign owner",
          <select aria-label="Owner" value={value} onChange={(e) => setValue(e.target.value)} data-autofocus>
            <option value="">Choose…</option>
            <option value="none">Unassigned</option>
            {(options.owner ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>,
          () => run({ kind: "owner", ownerId: value === "none" ? null : Number(value) }, "Owner updated"),
          !!value,
        )}
      {bulk.enums?.map((key) => {
        const f = fieldOf(meta, key)!;
        const allowed = forms[entity].fields.find((x) => x.key === key)?.options ?? f.options ?? [];
        const needsReason = entity === "deals" && key === "stage" && value === "lost";
        return panel(
          key,
          `Set ${f.label.toLowerCase()}`,
          <>
            <select aria-label={f.label} value={value} onChange={(e) => setValue(e.target.value)} data-autofocus>
              <option value="">Choose…</option>
              {allowed.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {needsReason && (
              <select aria-label="Lost reason" value={extra} onChange={(e) => setExtra(e.target.value)}>
                <option value="">Lost reason…</option>
                {LOST_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}
          </>,
          () => run({ kind: "enum", field: key, value, ...(needsReason ? { lostReason: extra } : {}) }, `${f.label} updated`),
          !!value && (!needsReason || !!extra),
        );
      })}
      {bulk.tags &&
        panel(
          "tag",
          "Tags",
          <>
            <select aria-label="Tag" value={value} onChange={(e) => setValue(e.target.value)} data-autofocus>
              <option value="">Choose a tag…</option>
              {(options.tags ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="ops-seg" role="radiogroup" aria-label="Add or remove">
              {(["add", "remove"] as const).map((m) => (
                <label key={m}>
                  <input type="radio" name="tagmode" value={m} checked={(extra || "add") === m} onChange={() => setExtra(m)} /> {m === "add" ? "Add" : "Remove"}
                </label>
              ))}
            </div>
          </>,
          () => run({ kind: "tag", tag: value, mode: extra === "remove" ? "remove" : "add" }, extra === "remove" ? "Tag removed" : "Tag added"),
          !!value,
        )}
    </div>
  );
}
