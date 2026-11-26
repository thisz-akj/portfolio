"use client";

import { useEffect, useState } from "react";
import { getQuality } from "../api";
import type { QualityReport } from "../types";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function Quality() {
  const [r, setR] = useState<QualityReport | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    getQuality()
      .then(setR)
      .catch(() => setError(true));
  }, []);

  if (error) return <div className="dd-card dd-empty">The quality report is unavailable right now.</div>;
  if (!r) return <div className="dd-skel" style={{ height: "20rem" }} />;
  if (!r.available || !r.qa || !r.extraction) return <div className="dd-card dd-empty">No quality run has been published yet.</div>;
  const { qa, extraction } = r;
  const answerable = qa.rows.filter((x) => x.kind === "answerable").length;

  return (
    <>
      <div className="dd-kpis">
        <Kpi value={pct(qa.accuracy)} label={`Questions answered correctly (${qa.rows.filter((x) => x.correct).length}/${qa.questions})`} />
        <Kpi value={pct(qa.citationAccuracy)} label="Answers citing the right clause" />
        <Kpi value={pct(qa.notFoundAccuracy)} label={`“Not in the document” when it isn't (${qa.questions - answerable} traps)`} />
        <Kpi value={pct(extraction.accuracy)} label={`Fields extracted correctly (${extraction.correct}/${extraction.fields})`} />
        <Kpi value={`${(qa.latencyP50 / 1000).toFixed(1)} s`} label={`Typical answer time · slowest 5% ≤ ${(qa.latencyP95 / 1000).toFixed(1)} s`} />
      </div>
      <p className="dd-note">
        Run on {r.generatedAt ? new Date(r.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"} against the sample
        library: {qa.questions} fixed questions with known answers, phrased the way people ask (including Hinglish), {qa.questions - answerable} of them about
        things the documents don&apos;t say. Re-run before every change. Extracted fields that couldn&apos;t be confirmed against the text are flagged for
        review, not passed off as right: {extraction.confidentWrong} confident mistakes in this run.
      </p>

      <section className="dd-card">
        <p className="dd-subhead">Every question in the run</p>
        <div className="dd-table-wrap">
          <table className="dd-table">
            <thead>
              <tr>
                <th scope="col">Result</th>
                <th scope="col">Question</th>
                <th scope="col">Answer</th>
                <th scope="col">Document</th>
                <th scope="col" className="dd-num">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {qa.rows.map((x, i) => (
                <tr key={i}>
                  <td className={x.correct ? "dd-ok" : "dd-bad"}>{x.correct ? (x.grounded ? "✓" : "✓ · source off") : "✗"}</td>
                  <td>
                    {x.question}
                    {x.kind !== "answerable" && (
                      <span className="dd-chip" style={{ marginLeft: "0.4rem" }}>
                        trap
                      </span>
                    )}
                  </td>
                  <td className="dd-muted">
                    {x.answer}
                    {x.pages.length > 0 && <span className="dd-check-page"> · p.{x.pages.join(", ")}</span>}
                  </td>
                  <td className="dd-muted">{x.doc}</td>
                  <td className="dd-num">{(x.latencyMs / 1000).toFixed(1)} s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dd-card">
        <p className="dd-subhead">Extraction by document</p>
        <div className="dd-table-wrap">
          <table className="dd-table">
            <thead>
              <tr>
                <th scope="col">Document</th>
                <th scope="col">Type</th>
                <th scope="col" className="dd-num">
                  Fields correct
                </th>
              </tr>
            </thead>
            <tbody>
              {extraction.perDoc.map((d) => (
                <tr key={d.doc}>
                  <td>{d.doc}</td>
                  <td className="dd-muted">{d.type}</td>
                  <td className={`dd-num ${d.correct === d.fields ? "dd-ok" : "dd-bad"}`}>
                    {d.correct}/{d.fields}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="dd-kpi">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
