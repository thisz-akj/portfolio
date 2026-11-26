"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookUser,
  CalendarDays,
  FileText,
  IndianRupee,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Package,
  Paperclip,
  Phone,
  RotateCcw,
  Send,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { AiLimitDialog } from "@/components/shared/AiLimitDialog";
import { prefersReducedMotion } from "@/lib/motion";
import { runScenario } from "./api";
import { SCENARIOS, TOOL_LABEL, getScenario } from "./scenarios";
import { elapsedLabel, stamp } from "./time";
import type { Card, Choice, Pending, RunEvent, RunResult, ScenarioId, Tool } from "./types";

const ICONS: Record<Tool, LucideIcon> = {
  whatsapp: MessageCircle,
  email: Mail,
  phone: Phone,
  crm: BookUser,
  stock: Package,
  docs: FileText,
  calendar: CalendarDays,
  sheet: Table2,
  chat: MessagesSquare,
  payments: IndianRupee,
  maps: MapPin,
};

const STEP_MS = 520;

type View = "customer" | "run" | "tools";

export function AutopilotApp({ initial }: { initial?: ScenarioId }) {
  const [scenario, setScenario] = useState<ScenarioId>(initial ?? "lead-to-cash");
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [run, setRun] = useState<RunResult | null>(null);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [view, setView] = useState<View>("customer");
  const reqId = useRef(0);
  const meta = getScenario(scenario)!;

  const load = useCallback(async (s: ScenarioId, c: Record<string, Choice>) => {
    const id = ++reqId.current;
    setBusy(true);
    setError(null);
    try {
      const r = await runScenario(s, c);
      if (id !== reqId.current) return;
      setRun(r);
      setChoices(r.choices);
      if (r.notice === "limit") {
        setLimitOpen(true);
        setNotice("You've used today's free typed messages, so the automation asked a follow-up instead. Tapping the suggested replies still works.");
      } else setNotice(r.notice ?? null);
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }, []);

  // New scenario → fresh run
  useEffect(() => {
    setRun(null);
    setShown(0);
    setChoices({});
    setNotice(null);
    setView("customer");
    void load(scenario, {});
  }, [scenario, load]);

  // Reveal new steps one by one
  const total = run?.events.length ?? 0;
  useEffect(() => {
    if (shown >= total) return;
    if (prefersReducedMotion()) {
      setShown(total);
      return;
    }
    const t = window.setTimeout(() => setShown((n) => Math.min(total, n + 1)), shown === 0 ? 120 : STEP_MS);
    return () => window.clearTimeout(t);
  }, [shown, total]);

  const revealing = shown < total;
  const events = useMemo(() => run?.events.slice(0, shown) ?? [], [run, shown]);
  const pending = !revealing && !busy ? run?.pending : undefined;
  const done = !revealing && run?.done;

  // Follow the action on phones
  useEffect(() => {
    if (pending) setView(pending.who === "customer" ? "customer" : "run");
    else if (revealing) setView((v) => (v === "customer" && events[events.length - 1]?.msg ? "customer" : "run"));
  }, [pending, revealing, events]);

  const answer = (p: Pending, c: Choice) => {
    const next = { ...choices, [p.id]: c };
    setChoices(next);
    void load(scenario, next);
  };

  const restart = () => {
    setRun(null);
    setShown(0);
    setChoices({});
    setNotice(null);
    void load(scenario, {});
  };

  const savedSoFar = events.reduce((s, e) => s + (e.saves ?? 0), 0);
  const autoSoFar = events.filter((e) => e.actor === "auto").length;
  const nextScenario = SCENARIOS[(SCENARIOS.findIndex((s) => s.id === scenario) + 1) % SCENARIOS.length];

  return (
    <div className="ap">
      <header className="ap-top">
        <Link href="/demos/autopilot" className="ap-back">
          <ArrowLeft size={14} /> Autopilot
        </Link>
        <nav className="ap-tabs" aria-label="Scenarios">
          {SCENARIOS.map((s) => (
            <button key={s.id} type="button" className="ap-tab" aria-pressed={s.id === scenario} onClick={() => s.id !== scenario && setScenario(s.id)}>
              <span>{s.name}</span>
              <small>{s.business}</small>
            </button>
          ))}
        </nav>
        <button type="button" className="ap-restart" onClick={restart} disabled={busy && !run}>
          <RotateCcw size={14} /> Restart
        </button>
      </header>

      <section className="ap-intro">
        <div>
          <p className="ap-eyebrow">
            {meta.business} · {meta.place}
          </p>
          <h1>{meta.name}</h1>
          <p className="ap-summary">{meta.summary}</p>
        </div>
        <dl className="ap-live">
          <div>
            <dt>Steps done automatically</dt>
            <dd>{autoSoFar}</dd>
          </div>
          <div>
            <dt>Desk work saved (est.)</dt>
            <dd>{savedSoFar} min</dd>
          </div>
          <div>
            <dt>Clock</dt>
            <dd>{run && events.length ? stamp(run.start, events[events.length - 1].at) : "–"}</dd>
          </div>
        </dl>
      </section>

      <div className="ap-switch" role="tablist" aria-label="Panels">
        {(["customer", "run", "tools"] as View[]).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}>
            {v === "customer" ? (meta.channel === "email" ? "Supplier's inbox" : "Customer's phone") : v === "run" ? "What happened" : "Business tools"}
            {v === "customer" && pending?.who === "customer" ? <i className="ap-dot" /> : null}
            {v === "run" && pending?.who === "team" ? <i className="ap-dot" /> : null}
          </button>
        ))}
      </div>

      <div className="ap-grid" data-view={view}>
        <CustomerSide channel={meta.channel} contact={meta.contact} role={meta.role} events={events} pending={pending?.who === "customer" ? pending : undefined} onAnswer={answer} busy={busy || revealing} />

        <main className="ap-run" aria-live="polite">
          <h2 className="ap-panel-title">What happened</h2>
          {error ? (
            <div className="ap-error">
              <p>{error}</p>
              <button type="button" className="ap-btn" onClick={() => void load(scenario, choices)}>
                Try again
              </button>
            </div>
          ) : null}
          {!run && !error ? <p className="ap-muted">Setting up the business…</p> : null}
          <ol className="ap-steps">
            {run
              ? events.map((e, i) => (
                  <Step key={e.id} e={e} start={run.start} gap={i > 0 ? e.at - events[i - 1].at : 0} fresh={i === events.length - 1 && revealing} />
                ))
              : null}
          </ol>
          {revealing ? <p className="ap-working">Working…</p> : null}
          {pending?.who === "team" ? <TeamPrompt p={pending} onAnswer={answer} busy={busy} /> : null}
          {pending?.who === "customer" ? (
            <p className="ap-waiting">
              Waiting for the {meta.channel === "email" ? "supplier" : "customer"}: answer on the {meta.channel === "email" ? "inbox" : "phone"}.
            </p>
          ) : null}
          {notice ? <p className="ap-notice">{notice}</p> : null}
          {done && run?.report ? (
            <section className="ap-report" aria-label="Run report">
              <p className="ap-eyebrow">Outcome</p>
              <h3>{run.report.outcome}</h3>
              <dl>
                <div>
                  <dt>Steps done automatically</dt>
                  <dd>{run.report.automatic}</dd>
                </div>
                <div>
                  <dt>Times a person stepped in</dt>
                  <dd>{run.report.humanTouches}</dd>
                </div>
                <div>
                  <dt>First message to done</dt>
                  <dd>{elapsedLabel(run.report.elapsedMin)}</dd>
                </div>
                <div>
                  <dt>Desk work saved (est.)</dt>
                  <dd>{run.report.savedMin} min</dd>
                </div>
              </dl>
              <p className="ap-tools-used">
                {run.report.tools.map((t) => {
                  const I = ICONS[t];
                  return (
                    <span key={t}>
                      <I size={13} /> {TOOL_LABEL[t]}
                    </span>
                  );
                })}
              </p>
              <p className="ap-muted">Time saved is a rough estimate of the desk work each step replaces. Times are on the business&apos;s clock, not real time.</p>
              <div className="ap-report-actions">
                <button type="button" className="ap-btn" onClick={restart}>
                  <RotateCcw size={14} /> Try another path
                </button>
                <button type="button" className="ap-btn ap-btn-solid" onClick={() => setScenario(nextScenario.id)}>
                  Next: {nextScenario.name} <ArrowRight size={14} />
                </button>
                <Link href="/contact" className="ap-btn">
                  Automate your own workflow
                </Link>
              </div>
            </section>
          ) : null}
        </main>

        <ToolsSide tools={meta.tools} events={events} />
      </div>

      <footer className="ap-foot">Fictional businesses and people. Nothing is really sent: every message, payment and booking here is a simulation.</footer>
      <AiLimitDialog open={limitOpen} onClose={() => setLimitOpen(false)} message="You've used today's free typed messages for Autopilot. The suggested replies still work, or tell me about the workflow you'd like to automate." />
    </div>
  );
}

function Step({ e, start, gap, fresh }: { e: RunEvent; start: string; gap: number; fresh: boolean }) {
  const I = ICONS[e.tool];
  return (
    <>
      {gap >= 45 ? <li className="ap-gap">{elapsedLabel(gap)} later</li> : null}
      <li className={`ap-step is-${e.actor}${e.tone ? ` tone-${e.tone}` : ""}${fresh ? " is-fresh" : ""}`}>
        <span className="ap-step-icon" aria-hidden="true">
          <I size={15} />
        </span>
        <div className="ap-step-body">
          <p className="ap-step-meta">
            <span>{stamp(start, e.at).split(" · ")[1]}</span>
            <span>{TOOL_LABEL[e.tool]}</span>
            <span>{e.actor === "auto" ? "Automatic" : e.actor === "team" ? "Team" : e.msg?.to ? e.msg.to : "Customer"}</span>
          </p>
          <p className="ap-step-title">{e.title}</p>
          {e.detail ? <p className="ap-step-detail">{e.detail}</p> : null}
          {e.msg ? <p className="ap-step-quote">“{e.msg.text.split("\n").filter(Boolean).slice(0, 2).join(" ")}”</p> : null}
          {e.card ? <CardView c={e.card} /> : null}
        </div>
      </li>
    </>
  );
}

function CardView({ c }: { c: Card }) {
  if (c.kind === "fields")
    return (
      <div className="ap-card">
        <p className="ap-card-title">{c.title}</p>
        <dl className="ap-fields">
          {c.rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  if (c.kind === "doc")
    return (
      <div className="ap-card ap-doc">
        <p className="ap-card-title">
          {c.title} <span>{c.number}</span>
        </p>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {c.lines.map((l) => (
              <tr key={l.item}>
                <td>{l.item}</td>
                <td>{l.qty}</td>
                <td>{l.rate}</td>
                <td>{l.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ap-totals">
          {c.totals.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  return (
    <div className="ap-card">
      <p className="ap-card-title">{c.title}</p>
      <div className="ap-table-wrap">
        <table>
          <thead>
            <tr>
              {c.head.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r, i) => (
              <tr key={i} className={c.flag?.includes(i) ? "is-flag" : c.highlight?.includes(i) ? "is-hi" : undefined}>
                {r.map((v, j) => (
                  <td key={j}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerSide({
  channel,
  contact,
  role,
  events,
  pending,
  onAnswer,
  busy,
}: {
  channel: "whatsapp" | "email";
  contact: string;
  role: string;
  events: RunEvent[];
  pending?: Pending;
  onAnswer: (p: Pending, c: Choice) => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const thread = useRef<HTMLDivElement>(null);
  const items = events.filter((e) => (e.msg && !e.msg.to && (e.tool === "whatsapp" || e.tool === "email")) || e.tool === "phone");

  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [items.length, pending]);

  useEffect(() => setText(""), [pending?.id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!pending || !t || busy) return;
    onAnswer(pending, { text: t.slice(0, 500) });
  };

  return (
    <aside className={`ap-customer is-${channel}`} aria-label={channel === "email" ? "Supplier's inbox" : "Customer's phone"}>
      <p className="ap-role">{role}</p>
      <div className="ap-device">
        <div className="ap-device-head">
          {channel === "email" ? <Mail size={15} /> : <MessageCircle size={15} />}
          <span>{contact}</span>
        </div>
        <div className="ap-thread" ref={thread}>
          {items.length === 0 ? <p className="ap-muted ap-empty">{channel === "email" ? "No emails yet." : "No messages yet."}</p> : null}
          {items.map((e) =>
            !e.msg ? (
              <div key={e.id} className="ap-call">
                <Phone size={14} /> {e.title}
              </div>
            ) : (
            <div key={e.id} className={`ap-msg is-${e.msg.side}`}>
              {channel === "email" ? <p className="ap-msg-subject">{e.title}</p> : null}
              <p>{e.msg!.text}</p>
              {e.msg!.attachment ? (
                <p className="ap-attach">
                  <Paperclip size={12} /> {e.msg!.attachment}
                </p>
              ) : null}
            </div>
            ),
          )}
        </div>
        {pending ? (
          <div className="ap-reply">
            <p className="ap-reply-prompt">{pending.prompt}</p>
            <div className="ap-options">
              {pending.options.map((o) => (
                <button key={o.id} type="button" className="ap-option" disabled={busy} onClick={() => onAnswer(pending, { option: o.id })}>
                  {o.label}
                </button>
              ))}
            </div>
            {pending.text ? (
              <form className="ap-compose" onSubmit={submit}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder={pending.text.placeholder} maxLength={500} aria-label="Type your own message" disabled={busy} />
                <button type="submit" aria-label="Send" disabled={busy || !text.trim()}>
                  <Send size={15} />
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function TeamPrompt({ p, onAnswer, busy }: { p: Pending; onAnswer: (p: Pending, c: Choice) => void; busy: boolean }) {
  const I = ICONS[p.tool];
  return (
    <div className="ap-team" role="group" aria-label="Your decision">
      <p className="ap-eyebrow">
        <I size={13} /> Your call
      </p>
      <p className="ap-team-prompt">{p.prompt}</p>
      <div className="ap-options">
        {p.options.map((o) => (
          <button key={o.id} type="button" className="ap-option" disabled={busy} onClick={() => onAnswer(p, { option: o.id })}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToolsSide({ tools, events }: { tools: Tool[]; events: RunEvent[] }) {
  const last = events[events.length - 1];
  return (
    <aside className="ap-tools" aria-label="Business tools">
      <h2 className="ap-panel-title">Business tools</h2>
      <ul>
        {tools.map((t) => {
          const mine = events.filter((e) => e.tool === t && e.actor !== "customer");
          const latest = mine[mine.length - 1];
          const I = ICONS[t];
          return (
            <li key={t} className={`ap-tool${last?.tool === t ? " is-active" : ""}${mine.length ? " is-used" : ""}`}>
              <span className="ap-tool-icon">
                <I size={16} />
              </span>
              <div>
                <p className="ap-tool-name">
                  {TOOL_LABEL[t]} {mine.length ? <span>{mine.length}</span> : null}
                </p>
                <p className="ap-tool-last">{latest ? latest.title : "Idle"}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
