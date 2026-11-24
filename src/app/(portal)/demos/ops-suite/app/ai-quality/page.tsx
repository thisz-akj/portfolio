import type { Metadata } from "next";
import Link from "next/link";
import { aiConfigured } from "@/features/demos/ops-suite/ai/claude.server";
import { PROMPT_VERSION } from "@/features/demos/ops-suite/ai/plan";
import { loadQuality } from "@/features/demos/ops-suite/ai/quality.server";
import { formatDate } from "@/features/demos/ops-suite/lib/format";
import { PORTAL_BASE } from "@/features/demos/ops-suite/nav";
import { BarList, ColumnChart } from "@/features/demos/ops-suite/ui/dashboard/Charts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI quality" };

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const ms = (v: number | null) => (v === null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
const usd = (v: number | null, d = 4) => (v === null ? "—" : `$${v.toFixed(d)}`);

export default async function AiQualityPage() {
  let q: Awaited<ReturnType<typeof loadQuality>>;
  try {
    q = await loadQuality();
  } catch (err) {
    console.error("[ops-suite] ai quality failed:", err);
    return (
      <section className="ops-card" role="alert">
        <p>
          <span className="ops-dot is-down" aria-hidden="true" /> The demo database is unavailable right now.
        </p>
      </section>
    );
  }
  const s = q.stats;
  const answered = s.ok + s.invalid + s.errors;
  return (
    <>
      <div className="ops-head">
        <h1>AI quality</h1>
        <p>
          How well “Ask Ops Suite” works, measured two ways: <strong>live monitoring</strong> of every real question, and <strong>offline evals</strong> on{" "}
          {q.goldenSize} fixed questions with known-correct plans, run by the Python harness. Prompt version {PROMPT_VERSION} ·{" "}
          {aiConfigured() ? "AI is on" : "AI is off on this deployment"}.
        </p>
      </div>

      <section className="ops-kpis" aria-label="Live monitoring, last 7 days">
        <div className="ops-kpi">
          <span className="ops-kpi-label">Questions (7 days)</span>
          <strong className="ops-kpi-value">{s.total.toLocaleString("en-IN")}</strong>
          <span className="ops-kpi-sub">{s.refused} declined by the model</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi-label">Valid plans</span>
          <strong className="ops-kpi-value">{pct(s.ok, answered)}</strong>
          <span className="ops-kpi-sub">
            {s.invalid} rejected by the validator · {s.errors} errors
          </span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi-label">Latency p50 / p95</span>
          <strong className="ops-kpi-value">{ms(s.p50)}</strong>
          <span className="ops-kpi-sub">p95 {ms(s.p95)}</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi-label">Cost (7 days)</span>
          <strong className="ops-kpi-value">{usd(s.cost, 2)}</strong>
          <span className="ops-kpi-sub">{usd(s.avgCost)} per question · {s.fallbacks} served by fallback</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi-label">Helpful</span>
          <strong className="ops-kpi-value">{pct(s.up, s.up + s.down)}</strong>
          <span className="ops-kpi-sub">
            {s.up} 👍 · {s.down} 👎
          </span>
        </div>
      </section>

      <div className="aq-grid">
        <section className="ops-card aq-wide">
          {q.daily.length ? (
            <ColumnChart title="Questions per day" note="last 14 days, excluding examples" unit="count" valueLabel="Questions" points={q.daily.map((d) => ({ label: formatDate(d.day).replace(/ \d{4}$/, ""), value: d.total, detail: `${pct(d.ok, d.total)} valid` }))} />
          ) : (
            <p className="aq-empty">
              No live questions yet. {aiConfigured() ? "Ask something on " : "Add ANTHROPIC_API_KEY, then ask something on "}
              <Link href={`${PORTAL_BASE}/ask`}>Ask Ops Suite</Link> — every question is traced here (latency, tokens, cost, validity, feedback).
            </p>
          )}
        </section>

        <section className="ops-card aq-wide" aria-labelledby="runs-title">
          <h2 id="runs-title" className="viz-title">
            Eval runs <span>golden set of {q.goldenSize} questions · exact-match grading on the plan</span>
          </h2>
          {q.runs.length ? (
            <div className="ops-scroll ops-lines-scroll">
              <table className="ops-table ops-lines">
                <thead>
                  <tr>
                    <th>Configuration</th>
                    <th className="is-end">Accuracy</th>
                    <th className="is-end">p50</th>
                    <th className="is-end">p95</th>
                    <th className="is-end">Cost / run</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {q.runs.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`${PORTAL_BASE}/ai-quality/runs/${r.id}`} className="ops-row-link">
                          <span className="ops-primary">{r.label}</span>
                        </Link>
                      </td>
                      <td className="is-end">
                        {r.finishedAt ? (
                          <>
                            {pct(r.passed, r.cases)} <span className="ops-dim">({r.passed}/{r.cases})</span>
                          </>
                        ) : (
                          "running…"
                        )}
                      </td>
                      <td className="is-end">{ms(r.p50Ms)}</td>
                      <td className="is-end">{ms(r.p95Ms)}</td>
                      <td className="is-end">{usd(r.costUsd)}</td>
                      <td>{formatDate(r.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="aq-empty">
              No eval runs yet. Run the Python harness (it calls Claude, so it needs an API key and costs a few cents per run):
              <code>{`cd ops-ai && python -m ops_ai.eval --effort low --effort medium`}</code>
            </div>
          )}
        </section>

        {q.latest && q.byTag.length > 0 && (
          <section className="ops-card">
            <BarList title="Accuracy by question type" note={q.latest.label} unit="pct" valueLabel="Accuracy" points={q.byTag.map((t) => ({ label: t.tag, value: t.passed / t.total, detail: `${t.passed}/${t.total}` }))} />
          </section>
        )}

        <section className="ops-card" aria-labelledby="problems-title">
          <h2 id="problems-title" className="viz-title">
            Recent failures <span>rejected plans, errors and refusals</span>
          </h2>
          {q.problems.length ? (
            <ul className="ops-feed-list">
              {q.problems.map((t) => (
                <li key={t.id}>
                  <strong>{t.question}</strong>
                  <span className="ops-hint">
                    {t.status} · {t.error ?? "—"} · {formatDate(t.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="aq-empty">Nothing has failed yet.</p>
          )}
        </section>
      </div>
    </>
  );
}
