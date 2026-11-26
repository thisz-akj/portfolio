"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Download, Pencil, Undo2 } from "lucide-react";
import { loadLocal, saveLocal } from "../api";
import type { DocDetail, Extraction, Field, Rect } from "../types";
import { csvCell, fieldsExport, money } from "./format";

const CONF: Record<Field["confidence"], { text: string; cls: string }> = {
  high: { text: "Verified", cls: "is-ok" },
  review: { text: "Check", cls: "is-warning" },
  missing: { text: "Not in doc", cls: "" },
  pending: { text: "Needs AI step", cls: "is-info" },
};

interface Local {
  edits: Record<string, string>;
  approved: Record<string, boolean>;
}

export function FieldsPanel({ doc, extraction, onSource }: { doc: DocDetail; extraction: Extraction | null; onSource: (rects: Rect[]) => void }) {
  const key = `fields.${doc.id}`;
  const [local, setLocal] = useState<Local>({ edits: {}, approved: {} });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => setLocal(loadLocal<Local>(key, { edits: {}, approved: {} })), [key]);
  const update = (next: Local) => {
    setLocal(next);
    saveLocal(key, next);
  };

  const fields = extraction?.fields ?? [];
  const present = fields.filter((f) => f.confidence !== "missing");
  const approvedCount = present.filter((f) => local.approved[f.key]).length;
  const exportData = useMemo(() => (extraction ? fieldsExport(doc, extraction, local.edits) : null), [doc, extraction, local.edits]);

  if (!extraction) return <div className="dd-skel" style={{ height: "14rem" }} />;

  const download = (kind: "json" | "csv") => {
    if (!exportData) return;
    const body =
      kind === "json"
        ? JSON.stringify(exportData, null, 2)
        : ["field,label,value,status,page", ...fields.map((f) => [f.key, f.label, local.edits[f.key] ?? f.display, local.approved[f.key] ? "approved" : CONF[f.confidence].text, f.source?.page ?? ""].map(csvCell).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: kind === "json" ? "application/json" : "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.id}-fields.${kind}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      <div className="dd-toolbar">
        <span className="dd-muted dd-small">
          {extraction.typeLabel} · {present.length} fields found · {approvedCount} approved
        </span>
        <div className="dd-toolbar-actions">
          <button
            type="button"
            className="dd-btn"
            onClick={() => update({ ...local, approved: Object.fromEntries(present.filter((f) => f.confidence === "high").map((f) => [f.key, true])) })}
          >
            <Check size={14} /> Approve verified
          </button>
          <button type="button" className="dd-btn" onClick={() => download("json")}>
            <Download size={14} /> JSON
          </button>
          <button type="button" className="dd-btn" onClick={() => download("csv")}>
            <Download size={14} /> CSV
          </button>
        </div>
      </div>
      {!extraction.complete && (
        <p className="dd-note" style={{ marginBottom: "0.75rem" }}>
          Some fields need the AI step, which is busy right now. The values below were read directly from the document.
        </p>
      )}
      <table className="dd-fields">
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Value</th>
            <th scope="col" style={{ textAlign: "right" }}>
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => {
            const edited = local.edits[f.key];
            const isEditing = editing === f.key;
            return (
              <tr key={f.key} className={active === f.key ? "is-active" : undefined}>
                <td className="dd-f-label">{f.label}</td>
                <td className={`dd-f-val${f.confidence === "missing" && !edited ? " is-missing" : ""}`}>
                  {isEditing ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        update({ edits: { ...local.edits, [f.key]: draft }, approved: { ...local.approved, [f.key]: true } });
                        setEditing(null);
                      }}
                    >
                      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => setEditing(null)} aria-label={`Edit ${f.label}`} />
                    </form>
                  ) : f.source ? (
                    <button
                      type="button"
                      className="dd-link-btn"
                      onClick={() => {
                        setActive(f.key);
                        onSource(f.source!.rects);
                      }}
                      title={`Show on page ${f.source.page}`}
                    >
                      {edited ?? f.display}
                    </button>
                  ) : (
                    (edited ?? f.display)
                  )}
                  {edited !== undefined && !isEditing && <span className="dd-edited">edited</span>}
                </td>
                <td className="dd-f-act">
                  <span className={`dd-chip ${local.approved[f.key] ? "is-ok" : CONF[f.confidence].cls}`}>{local.approved[f.key] ? "Approved" : CONF[f.confidence].text}</span>{" "}
                  <button
                    type="button"
                    className="dd-icon-btn"
                    aria-label={`Edit ${f.label}`}
                    onClick={() => {
                      setDraft(edited ?? (f.value === null ? "" : f.display));
                      setEditing(f.key);
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  {edited !== undefined ? (
                    <button
                      type="button"
                      className="dd-icon-btn"
                      aria-label={`Undo edit of ${f.label}`}
                      onClick={() => {
                        const { [f.key]: _drop, ...rest } = local.edits;
                        void _drop;
                        update({ ...local, edits: rest });
                      }}
                    >
                      <Undo2 size={13} />
                    </button>
                  ) : (
                    f.confidence !== "missing" && (
                      <button
                        type="button"
                        className={`dd-icon-btn${local.approved[f.key] ? " is-on" : ""}`}
                        aria-label={`${local.approved[f.key] ? "Unapprove" : "Approve"} ${f.label}`}
                        aria-pressed={!!local.approved[f.key]}
                        onClick={() => update({ ...local, approved: { ...local.approved, [f.key]: !local.approved[f.key] } })}
                      >
                        <Check size={13} />
                      </button>
                    )
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {extraction.lineItems.length > 0 && (
        <div className="dd-items">
          <h3>Line items</h3>
          <div className="dd-table-wrap">
            <table className="dd-table">
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col" className="dd-num">
                    Qty
                  </th>
                  <th scope="col" className="dd-num">
                    Rate
                  </th>
                  <th scope="col" className="dd-num">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {extraction.lineItems.map((it, i) => (
                  <tr key={i}>
                    <td>
                      {it.source ? (
                        <button type="button" className="dd-link-btn" onClick={() => onSource(it.source!.rects)}>
                          {it.description}
                        </button>
                      ) : (
                        it.description
                      )}
                    </td>
                    <td className="dd-num">{it.qty}</td>
                    <td className="dd-num">{money(it.rate)}</td>
                    <td className="dd-num">{money(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
