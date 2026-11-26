"use client";

import { useState } from "react";
import { AlertTriangle, CircleCheck, Info, OctagonX } from "lucide-react";
import type { Check, Extraction, Rect, Severity } from "../types";

export const SEVERITY_ICON: Record<Severity, React.ReactNode> = {
  error: <OctagonX size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
  pass: <CircleCheck size={16} />,
};

export function CheckRow({ c, active, onClick }: { c: Check; active?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <span className="dd-check-icon" aria-label={c.severity}>
        {SEVERITY_ICON[c.severity]}
      </span>
      <span className="dd-check-title">{c.title}</span>
      {c.source ? <span className="dd-check-page">p.{c.source.page}</span> : <span />}
      <span className="dd-check-detail">{c.detail}</span>
    </>
  );
  return onClick && c.source ? (
    <button type="button" className={`dd-check is-${c.severity}${active ? " is-active" : ""}`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={`dd-check is-${c.severity}`}>{body}</div>
  );
}

export function ChecksPanel({ extraction, onSource }: { extraction: Extraction | null; onSource: (rects: Rect[], severity: Severity) => void }) {
  const [active, setActive] = useState<string | null>(null);
  if (!extraction) return <div className="dd-skel" style={{ height: "12rem" }} />;
  const { checks } = extraction;
  const counts = (s: Severity) => checks.filter((c) => c.severity === s).length;
  return (
    <div>
      <div className="dd-toolbar">
        <span className="dd-muted dd-small">Arithmetic, tax and term checks on this {extraction.typeLabel.toLowerCase()}</span>
        <div className="dd-toolbar-actions">
          {counts("error") > 0 && <span className="dd-chip is-error">{counts("error")} error{counts("error") === 1 ? "" : "s"}</span>}
          {counts("warning") > 0 && <span className="dd-chip is-warning">{counts("warning")} to review</span>}
          {counts("pass") > 0 && <span className="dd-chip is-ok">{counts("pass")} passed</span>}
        </div>
      </div>
      {checks.length === 0 ? (
        <div className="dd-card dd-empty">
          <p>No checks apply to this document type yet{extraction.complete ? "" : " — some fields still need the AI step"}.</p>
        </div>
      ) : (
        <div className="dd-checks">
          {checks.map((c) => (
            <CheckRow
              key={c.id}
              c={c}
              active={active === c.id}
              onClick={() => {
                setActive(c.id);
                if (c.source) onSource(c.source.rects, c.severity);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
