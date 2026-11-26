"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, CircleCheck, OctagonX } from "lucide-react";
import { compareDocs, getDoc, listDocs, rememberedUploads } from "../api";
import { DOCDESK_BASE } from "../nav";
import type { ClauseChange, Comparison, DocDetail, DocSummary, MatchLine, Rect } from "../types";
import { Viewer, type Highlight } from "./Viewer";

const PRESETS = [
  { a: "msa-kestrel-v1", b: "msa-kestrel-v2", label: "Contract v1 ↔ redline v2" },
  { a: "po-saffron-0932", b: "invoice-kaveri-1187", label: "Purchase order ↔ its invoice" },
];

export function Compare() {
  const router = useRouter();
  const params = useSearchParams();
  const a = params.get("a") ?? "";
  const b = params.get("b") ?? "";
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [result, setResult] = useState<Comparison | null>(null);
  const [details, setDetails] = useState<{ a: DocDetail; b: DocDetail } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hl, setHl] = useState<{ a: Highlight | null; b: Highlight | null }>({ a: null, b: null });
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    listDocs()
      .then((d) => setDocs([...rememberedUploads(), ...d]))
      .catch(() => setError("DocDesk is unavailable right now."));
  }, []);

  useEffect(() => {
    if (!a || !b) return;
    let live = true;
    setLoading(true);
    setError(null);
    setResult(null);
    setActive(null);
    setHl({ a: null, b: null });
    compareDocs(a, b)
      .then(async (r) => {
        const [da, db] = await Promise.all([getDoc(r.a.id), getDoc(r.b.id)]);
        if (!live) return;
        setResult(r);
        setDetails({ a: da, b: db });
      })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [a, b]);

  const pick = (na: string, nb: string) => router.replace(`${DOCDESK_BASE}/compare?a=${encodeURIComponent(na)}&b=${encodeURIComponent(nb)}`, { scroll: false });
  const focus = (i: number, ra: Rect[] | undefined, rb: Rect[] | undefined, toneA: Highlight["tone"], toneB: Highlight["tone"]) => {
    setActive(i);
    const nonce = Date.now();
    setHl({ a: ra?.length ? { rects: ra, tone: toneA, nonce } : null, b: rb?.length ? { rects: rb, tone: toneB, nonce } : null });
  };

  const options = useMemo(
    () =>
      docs.map((d) => (
        <option key={d.id} value={d.id}>
          {d.source === "upload" ? "Upload · " : ""}
          {d.title}
        </option>
      )),
    [docs],
  );

  return (
    <>
      <div className="dd-card">
        <div className="dd-compare-pick">
          <label>
            <span className="dd-label">First document</span>
            <select className="dd-select" value={a} onChange={(e) => pick(e.target.value, b)}>
              <option value="">Choose…</option>
              {options}
            </select>
          </label>
          <button type="button" className="dd-icon-btn" aria-label="Swap documents" onClick={() => pick(b, a)} disabled={!a || !b}>
            <ArrowLeftRight size={16} />
          </button>
          <label>
            <span className="dd-label">Second document</span>
            <select className="dd-select" value={b} onChange={(e) => pick(a, e.target.value)}>
              <option value="">Choose…</option>
              {options}
            </select>
          </label>
        </div>
        <div className="dd-suggest" style={{ marginTop: "0.8rem" }}>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => pick(p.a, p.b)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="dd-error" role="alert">
          {error}
        </p>
      )}
      {loading && <div className="dd-skel" style={{ height: "18rem" }} />}
      {!a || !b ? (
        !error && <p className="dd-note">Pick two versions of a contract, or a purchase order and its invoice. Comparisons are rule-based and instant — no AI call.</p>
      ) : null}

      {result && details && !loading && (
        <div className="dd-compare">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}>
            {result.mode === "contracts" ? (
              <ContractResult r={result} active={active} onFocus={focus} />
            ) : (
              <PoResult r={result} active={active} onFocus={focus} />
            )}
          </div>
          <div className="dd-compare-views">
            <div className="dd-compare-view">
              <p>{details.a.title}</p>
              <Viewer docId={details.a.id} title={details.a.title} pageSizes={details.a.pageSizes} highlight={hl.a} compact />
            </div>
            <div className="dd-compare-view">
              <p>{details.b.title}</p>
              <Viewer docId={details.b.id} title={details.b.title} pageSizes={details.b.pageSizes} highlight={hl.b} compact />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type Focus = (i: number, ra: Rect[] | undefined, rb: Rect[] | undefined, toneA: Highlight["tone"], toneB: Highlight["tone"]) => void;

function ContractResult({ r, active, onFocus }: { r: Extract<Comparison, { mode: "contracts" }>; active: number | null; onFocus: Focus }) {
  const diffTerms = r.terms.filter((t) => !t.same);
  return (
    <>
      <div className="dd-card">
        <p className="dd-verdict">{r.summary}</p>
        {diffTerms.length > 0 && (
          <table className="dd-terms" style={{ marginTop: "0.8rem" }}>
            <thead>
              <tr>
                <th scope="col">Key term</th>
                <th scope="col">First</th>
                <th scope="col">Second</th>
              </tr>
            </thead>
            <tbody>
              {diffTerms.map((t) => (
                <tr key={t.key} className="is-diff">
                  <td>{t.label}</td>
                  <td>{t.a}</td>
                  <td>{t.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="dd-subhead">Clause by clause · click to see it on both pages</p>
      <div className="dd-changes">
        {r.changes.map((c, i) => (
          <ChangeRow key={i} c={c} active={active === i} onClick={() => onFocus(i, c.a?.rects, c.b?.rects, "del", "add")} />
        ))}
      </div>
    </>
  );
}

function ChangeRow({ c, active, onClick }: { c: ClauseChange; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`dd-change${active ? " is-active" : ""}`} onClick={onClick}>
      <span className="dd-change-head">
        <span className={`dd-chip ${c.kind === "added" ? "is-ok" : c.kind === "removed" ? "is-error" : "is-warning"}`}>{c.kind}</span>
        {c.clause ? `§${c.clause} · ` : ""}
        {c.section}
      </span>
      <span>
        {c.ops.map(([op, t], i) =>
          op === "+" ? (
            <ins key={i}>{t} </ins>
          ) : op === "-" ? (
            <del key={i}>{t} </del>
          ) : (
            <span key={i} className="dd-eq">
              {t.length > 140 ? `${t.slice(0, 60)} … ${t.slice(-60)}` : t}{" "}
            </span>
          ),
        )}
      </span>
    </button>
  );
}

function PoResult({ r, active, onFocus }: { r: Extract<Comparison, { mode: "po_invoice" }>; active: number | null; onFocus: Focus }) {
  const ok = !r.lines.some((l) => l.status === "mismatch") && !r.header.some((h) => h.status === "mismatch" && !["Taxable value", "Grand total"].includes(h.label));
  return (
    <>
      <div className="dd-card">
        <p className={`dd-verdict ${ok ? "is-ok" : "is-bad"}`}>
          {ok ? <CircleCheck size={18} /> : <OctagonX size={18} />} {r.summary}
        </p>
        {r.overBilledDisplay && <p className="dd-muted" style={{ marginTop: "0.35rem" }}>Billed above the order: {r.overBilledDisplay} before tax.</p>}
        <table className="dd-terms" style={{ marginTop: "0.8rem" }}>
          <thead>
            <tr>
              <th scope="col">Term</th>
              <th scope="col">Purchase order</th>
              <th scope="col">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {r.header.map((h) => (
              <tr key={h.label} className={h.status === "mismatch" ? "is-bad" : undefined}>
                <td>{h.label}</td>
                <td>{h.po}</td>
                <td>{h.invoice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dd-subhead">Line by line · click to see both documents</p>
      <div className="dd-changes">
        {r.lines.map((l, i) => (
          <LineRow key={i} l={l} active={active === i} onClick={() => onFocus(i, l.poSource?.rects, l.invoiceSource?.rects, l.status === "match" ? "cite" : "warn", l.status === "match" ? "cite" : "warn")} />
        ))}
      </div>
    </>
  );
}

function LineRow({ l, active, onClick }: { l: MatchLine; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`dd-change${active ? " is-active" : ""}`} onClick={onClick}>
      <span className="dd-change-head">
        <span className={`dd-chip ${l.status === "match" ? "is-ok" : "is-error"}`}>{l.status}</span>
        {l.description}
      </span>
      <span className="dd-small" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.1rem 0.8rem" }}>
        <span className="dd-muted">Ordered</span>
        <span>{l.po?.display ?? "—"}</span>
        <span className="dd-muted">Invoiced</span>
        <span>{l.invoice?.display ?? "—"}</span>
      </span>
      {l.issues.length > 0 && <span className="dd-error" style={{ display: "block" }}>{l.issues.join(" · ")}</span>}
    </button>
  );
}
