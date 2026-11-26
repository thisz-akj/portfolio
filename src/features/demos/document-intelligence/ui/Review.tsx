"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { getReview, loadLocal, rememberedUploads, saveLocal } from "../api";
import { docHref } from "../nav";
import type { ReviewItem } from "../types";
import { SEVERITY_ICON } from "./ChecksPanel";

type Decision = "resolved" | "dismissed";
type Filter = "open" | "done" | "all";

export function Review() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [filter, setFilter] = useState<Filter>("open");

  useEffect(() => {
    setDecisions(loadLocal<Record<string, Decision>>("review", {}));
    getReview(rememberedUploads().map((d) => d.id))
      .then(setItems)
      .catch(() => setError(true));
  }, []);

  const decide = (key: string, d: Decision | null) => {
    const next = { ...decisions };
    if (d) next[key] = d;
    else delete next[key];
    setDecisions(next);
    saveLocal("review", next);
  };

  if (error) return <div className="dd-card dd-empty">The review queue is unavailable right now.</div>;
  if (!items) return <div className="dd-skel" style={{ height: "20rem" }} />;

  const open = items.filter((i) => !decisions[i.key]);
  const shown = filter === "open" ? open : filter === "done" ? items.filter((i) => decisions[i.key]) : items;

  return (
    <>
      <div className="dd-toolbar">
        <div className="dd-filter" role="tablist" aria-label="Filter">
          {(
            [
              ["open", `Open (${open.length})`],
              ["done", `Done (${items.length - open.length})`],
              ["all", `All (${items.length})`],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="tab" className="dd-tab" aria-selected={filter === k} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
        <span className="dd-note">Decisions are saved in this browser.</span>
      </div>
      {shown.length === 0 ? (
        <div className="dd-card dd-empty">
          <p>{filter === "open" ? "Queue clear — nothing waiting for review." : "Nothing here yet."}</p>
        </div>
      ) : (
        <div className="dd-review">
          {shown.map((it) => {
            const d = decisions[it.key];
            return (
              <div key={it.key} className={`dd-review-item dd-check is-${it.severity}${d ? " is-done" : ""}`}>
                <span className="dd-check-icon" aria-label={it.severity}>
                  {SEVERITY_ICON[it.severity]}
                </span>
                <span className="dd-check-title">{it.title}</span>
                <span className="dd-review-actions">
                  {d ? (
                    <>
                      <span className="dd-chip">{d}</span>
                      <button type="button" className="dd-icon-btn" aria-label="Reopen" onClick={() => decide(it.key, null)}>
                        <RotateCcw size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="dd-btn" onClick={() => decide(it.key, "resolved")}>
                        <Check size={14} /> Resolve
                      </button>
                      <button type="button" className="dd-icon-btn" aria-label="Dismiss" title="Dismiss" onClick={() => decide(it.key, "dismissed")}>
                        <X size={14} />
                      </button>
                    </>
                  )}
                </span>
                <span className="dd-check-detail">{it.detail}</span>
                <span className="dd-review-doc">
                  <Link href={docHref(it.doc.id, it.id.startsWith("field-") ? "fields" : "checks")}>{it.doc.title}</Link>
                  {it.source ? ` · page ${it.source.page}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
