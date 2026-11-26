"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { askAction, feedbackAction, runExampleAction } from "../../ai/actions";
import type { AskResult } from "../../ai/types";
import { BarList, ColumnChart, fmtValue } from "../dashboard/Charts";
import { AiLimitDialog } from "@/components/shared/AiLimitDialog";
import { assistantCopy } from "@/content/assistant";

const LIMIT_KEY = "ai-limit:ops-ask";
const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

type Ok = Extract<AskResult, { ok: true }>;
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

function Answer({ r }: { r: Ok }) {
  const [vote, setVote] = useState<1 | -1 | null>(null);
  const a = r.answer;
  let body: React.ReactNode = null;

  if (a.kind === "metric") {
    if (!a.groupLabel) {
      const change = a.previousTotal ? ((a.total ?? 0) - a.previousTotal) / Math.abs(a.previousTotal) : null;
      body = (
        <div className="ai-hero">
          <strong>{fmtValue(a.total ?? 0, a.unit)}</strong>
          <span>
            {a.metricLabel} · {a.periodLabel}
          </span>
          {a.previousTotal !== null && (
            <span className={change !== null && change < 0 ? "ops-error" : "ops-notice"}>
              {change === null ? "no previous value" : `${change >= 0 ? "+" : "−"}${Math.abs(Math.round(change * 100))}%`} vs {a.previousLabel} ({fmtValue(a.previousTotal, a.unit)})
            </span>
          )}
        </div>
      );
    } else if (a.timeSeries) {
      body = (
        <ColumnChart
          title={`${a.metricLabel} by month`}
          note={a.periodLabel}
          unit={a.unit}
          valueLabel={a.metricLabel}
          points={a.rows.map((x) => ({ label: monthFmt.format(new Date(`${x.key}-01T00:00:00Z`)), value: x.value }))}
        />
      );
    } else {
      body = (
        <BarList
          title={`${a.metricLabel} by ${a.groupLabel.toLowerCase()}`}
          note={`${a.periodLabel}${a.previousLabel ? ` · ranked by change vs ${a.previousLabel}` : ""}`}
          unit={a.unit}
          valueLabel={a.metricLabel}
          points={a.rows.map((x) => ({
            label: x.label,
            value: x.value,
            detail:
              x.previous !== undefined
                ? x.change === null || x.change === undefined
                  ? `was ${fmtValue(x.previous ?? 0, a.unit, true)}`
                  : `${x.change >= 0 ? "+" : "−"}${Math.abs(Math.round(x.change * 100))}% (was ${fmtValue(x.previous ?? 0, a.unit, true)})`
                : undefined,
          }))}
        />
      );
    }
  } else if (a.kind === "list") {
    body = (
      <div className="ai-list">
        <p>
          <strong>{a.total.toLocaleString("en-IN")}</strong> {a.entityLabel.toLowerCase()} match.
        </p>
        <ul>
          {a.preview.map((p) => (
            <li key={p.id}>{p.href ? <Link href={p.href}>{p.title}</Link> : p.title}</li>
          ))}
        </ul>
        <Link className="ops-btn is-primary" href={a.href}>
          Open all {a.total.toLocaleString("en-IN")} in {a.entityLabel} <ArrowRight size={14} />
        </Link>
      </div>
    );
  } else {
    body = <p className="ai-unsupported">{r.explanation}</p>;
  }

  return (
    <article className="ops-card ai-answer">
      <header>
        {r.title.trim().toLowerCase() !== r.question.trim().toLowerCase() && <p className="ops-eyebrow">{r.question}</p>}
        <h2>{r.title}</h2>
        {a.kind !== "unsupported" && <p className="ai-explain">{r.explanation}</p>}
        {r.notes.map((n) => (
          <p key={n} className="ops-hint">
            Note: {n}
          </p>
        ))}
      </header>
      {body}
      <footer className="ai-meta">
        {r.mode === "example" ? (
          <span className="ai-badge is-example">Example answer · pre-written</span>
        ) : (
          r.usage && (
            <span className="ai-badge">
              <Sparkles size={12} aria-hidden="true" /> AI answer · {(r.usage.latencyMs / 1000).toFixed(1)} s
            </span>
          )
        )}
        {r.mode === "ai" && r.traceId && (
          <span className="ai-vote" role="group" aria-label="Was this helpful?">
            {vote ? (
              <span className="ops-hint">Thanks — logged for the AI quality report</span>
            ) : (
              <>
                <button type="button" className="ops-icon-btn" aria-label="Helpful" onClick={() => feedbackAction(r.traceId, 1).then(() => setVote(1))}>
                  <ThumbsUp size={14} />
                </button>
                <button type="button" className="ops-icon-btn" aria-label="Not helpful" onClick={() => feedbackAction(r.traceId, -1).then(() => setVote(-1))}>
                  <ThumbsDown size={14} />
                </button>
              </>
            )}
          </span>
        )}
      </footer>
    </article>
  );
}

export function AskPanel({ configured, examples, freeLimit = 3 }: { configured: boolean; examples: { id: string; question: string }[]; freeLimit?: number }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Ok[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  // Free-question allowance (server-enforced in askAction; mirrored here for the pop-up).
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(LIMIT_KEY) === todayIST()) setLimitReached(true);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const closeLimit = useCallback(() => setLimitOpen(false), []);

  const hitLimit = () => {
    try {
      window.localStorage.setItem(LIMIT_KEY, todayIST());
    } catch {
      /* storage unavailable */
    }
    setLimitReached(true);
    setRemaining(0);
    setLimitOpen(true);
  };

  const run = (fn: () => Promise<AskResult>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) {
        setResults((r) => [res, ...r].slice(0, 6));
        setQ("");
        if (res.remaining !== null) {
          setRemaining(res.remaining);
          if (res.remaining === 0) hitLimit(); // that was the last free question
        }
      } else if (res.reason === "quota") hitLimit();
      else setError(res.message);
    });

  const ask = (text: string) => {
    if (limitReached) setLimitOpen(true);
    else if (text.trim()) run(() => askAction(text));
  };

  return (
    <div className="ai-panel">
      {!configured && (
        <p className="ai-banner" role="note">
          <strong>Free-form questions are off in this preview.</strong> The example questions below still work — they show pre-written
          answers, labelled as such.
        </p>
      )}
      <form
        className="ai-ask"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <label htmlFor="ai-q" className="ops-sr">
          Ask a question about the business
        </label>
        <textarea
          id="ai-q"
          ref={box}
          rows={2}
          maxLength={300}
          value={q}
          disabled={!configured || pending}
          readOnly={limitReached}
          placeholder={
            !configured
              ? "Free-form questions are off in this preview — try an example"
              : limitReached
                ? assistantCopy.limit.placeholder
                : "e.g. Which region's orders dropped the most last month?"
          }
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(q);
            }
          }}
        />
        <button type="submit" className="ops-btn is-primary" disabled={!configured || pending || (!limitReached && !q.trim())}>
          <Sparkles size={14} /> {pending ? "Thinking…" : "Ask"}
        </button>
      </form>
      <div className="ai-examples" aria-label="Example questions">
        {examples.map((x) => (
          <button
            key={x.id}
            type="button"
            className="ops-chip ai-chip"
            disabled={pending}
            // Examples always use their pre-written answers: instant, zero tokens, and they don't use a free question.
            onClick={() => run(() => runExampleAction(x.id))}
          >
            <span className="ops-chip-text">{x.question}</span>
          </button>
        ))}
      </div>
      {configured && remaining !== null && remaining > 0 && <p className="ops-hint ai-remaining">{assistantCopy.limit.remaining(remaining, freeLimit)}</p>}
      <div aria-live="polite">
        {error && (
          <p className="ops-error ai-error" role="alert">
            {error}
          </p>
        )}
        {pending && <p className="ops-hint">Reading the question, planning, running the query…</p>}
      </div>
      {results.map((r, i) => (
        <Answer key={`${r.traceId ?? "x"}-${i}`} r={r} />
      ))}
      <AiLimitDialog open={limitOpen} onClose={closeLimit} limit={freeLimit} />
    </div>
  );
}
