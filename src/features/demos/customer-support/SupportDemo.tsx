"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, FileText, Gauge, GitBranch, MessageSquare, RotateCcw, Send, Sparkles } from "lucide-react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { sound } from "@/lib/sound";
import { assistantCopy as copy } from "@/content/assistant";
import { ChatThread, Composer } from "@/components/assistant/ChatParts";
import { routeLabel, type UiMessage } from "@/components/assistant/AssistantMessage";
import { useAssistantChat } from "@/components/assistant/useAssistantChat";
import { AiLimitDialog } from "@/components/shared/AiLimitDialog";
import "./support.css";

/**
 * /demos/customer-support — the site assistant embedded as a support console.
 * Left: the conversation. Right: what happened behind the selected reply — triage (topic + route),
 * grounding (pages cited), response (mode, latency) and the outcome. Every value comes from the
 * Python service's trace event; nothing in the inspector is scripted.
 */

const d = copy.demo;
type StepState = "done" | "active" | "pending";

const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);

function Step({
  icon,
  title,
  state,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  state: StepState;
  children: React.ReactNode;
}) {
  return (
    <li className={`sd-step is-${state}`}>
      <span className="sd-step-icon" aria-hidden>
        {icon}
      </span>
      <div className="sd-step-body">
        <p className="sd-step-title">
          {title}
          <span className="sd-step-state">{state === "done" ? "done" : state === "active" ? "running" : "waiting"}</span>
        </p>
        <div className="sd-step-content">{children}</div>
      </div>
    </li>
  );
}

function Inspector({ message }: { message: UiMessage | null }) {
  const list = useRef<HTMLOListElement>(null);
  const t = message?.trace;
  const streaming = message?.status === "streaming";
  const failed = message?.status === "error" && !t;

  // Replay the pipeline whenever a new trace lands (or another reply is selected).
  useLayoutEffect(() => {
    if (!list.current || prefersReducedMotion() || !t) return;
    const tw = gsap.fromTo(
      list.current.querySelectorAll(".sd-step"),
      { x: -10, autoAlpha: 0 },
      { x: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out", stagger: 0.08 },
    );
    return () => {
      tw.kill();
    };
  }, [t, message?.id]);

  if (!message) {
    return (
      <div className="sd-inspector is-empty">
        <Sparkles size={22} strokeWidth={1.25} aria-hidden />
        <p>Ask something or run a scenario. The pipeline behind each reply shows up here.</p>
      </div>
    );
  }

  const state = (needsTrace: boolean): StepState => (t || (!needsTrace && !streaming) ? "done" : streaming ? "active" : "pending");
  const progress = t ? 1 : streaming ? (message.content ? 0.6 : 0.3) : 0;

  return (
    <div className="sd-inspector">
      <div className="sd-rail" aria-hidden>
        <span style={{ transform: `scaleY(${progress})` }} />
      </div>
      <ol ref={list} className="sd-steps">
        <Step icon={<MessageSquare size={14} />} title="Question" state="done">
          <q>{message.question}</q>
        </Step>
        <Step icon={<GitBranch size={14} />} title="Triage" state={state(true)}>
          {t ? (
            <>
              <div className="sd-tags">
                <span className="sd-tag">{d.topics[t.topic]}</span>
                <span className={`sd-tag sd-route is-${t.route}`}>
                  <i aria-hidden />
                  {routeLabel[t.route]}
                </span>
              </div>
            </>
          ) : (
            <p className="sd-note">{failed ? "No reply to triage." : "Waiting for the reply…"}</p>
          )}
        </Step>
        <Step icon={<FileText size={14} />} title="Grounding" state={state(true)}>
          <p className="sd-note">{t?.mode === "live" ? d.grounding : t ? d.offlineNote : "Site knowledge loaded"}</p>
          {t && t.sources.length > 0 && (
            <ul className="sd-sources">
              {t.sources.map((s) => (
                <li key={s.path}>
                  <Link href={s.path}>
                    {s.label}
                    <ArrowUpRight size={11} aria-hidden />
                  </Link>
                  <code>{s.path}</code>
                </li>
              ))}
            </ul>
          )}
          {t && t.sources.length === 0 && <p className="sd-note">No pages cited.</p>}
        </Step>
        <Step icon={<Gauge size={14} />} title="Response" state={t ? "done" : streaming ? "active" : failed ? "pending" : "done"}>
          {t ? (
            <dl className="sd-metrics">
              <div>
                <dt>Mode</dt>
                <dd>{t.mode === "live" ? "Live" : t.mode === "limit" ? "Offline (daily limit)" : "Offline"}</dd>
              </div>
              <div>
                <dt>First token</dt>
                <dd>{fmtMs(t.ttft_ms)}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{fmtMs(t.total_ms)}</dd>
              </div>
            </dl>
          ) : (
            <p className="sd-note">{streaming ? (message.content ? "Streaming…" : "Thinking…") : failed ? message.content.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") : "—"}</p>
          )}
        </Step>
        <Step icon={<Send size={14} />} title="Outcome" state={state(true)}>
          <p className="sd-note">{t ? d.outcomes[t.route] : "—"}</p>
        </Step>
      </ol>
    </div>
  );
}

export function SupportDemo() {
  const { messages, mode, busy, send, stop, reset, remaining, freeLimit, limitReached, limitOpen, closeLimit } =
    useAssistantChat("support-demo-v1");
  const [input, setInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const replies = messages.filter((m) => m.role === "assistant");
  const selected = replies.find((m) => m.id === selectedId) ?? replies[replies.length - 1] ?? null;

  const stats = useMemo(() => {
    const traced = replies.flatMap((m) => (m.trace ? [m.trace] : []));
    const count = (r: string) => traced.filter((t) => t.route === r).length;
    const live = traced.filter((t) => t.mode === "live");
    const avg = live.length ? Math.round(live.reduce((a, t) => a + t.ttft_ms, 0) / live.length) : null;
    return [
      { label: "Questions", value: String(replies.length) },
      { label: "Answered", value: String(count("answered")) },
      { label: "Handed off", value: String(count("handoff")) },
      { label: "Out of scope", value: String(count("off_topic")) },
      { label: "Avg first token", value: avg === null ? "—" : fmtMs(avg) },
    ];
  }, [replies]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    // fromTo + revert (not gsap.from): safe when React dev runs this effect twice.
    const tw = gsap.fromTo(
      el.querySelectorAll(".sd-reveal"),
      { y: 18, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.8, ease: "power3.out", stagger: 0.06, clearProps: "transform,opacity,visibility" },
    );
    return () => {
      tw.revert();
    };
  }, []);

  const submit = (text: string) => {
    if (send(text)) {
      setInput("");
      setSelectedId(null); // follow the newest reply
    }
  };

  return (
    <div ref={root} className="sd">
      <div className="sd-intro sd-reveal">
        <p className="eyebrow">{d.eyebrow}</p>
        <h3>{d.title}</h3>
        <p>{d.intro}</p>
      </div>

      <div className="sd-scenarios sd-reveal" role="group" aria-label="Scenarios">
        {d.scenarios.map((s) => (
          <button
            key={s.label}
            type="button"
            disabled={busy}
            onClick={() => submit(s.prompt)}
            onPointerEnter={() => sound().hover(1.1)}
            title={s.prompt}
          >
            <span>{s.label}</span>
            <em>expect: {s.expect}</em>
          </button>
        ))}
      </div>

      <div className="sd-console sd-reveal">
        <div className="sd-bar">
          <span className="sd-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="sd-bar-title">support-console · azad.site</span>
          {mode && (
            <span className={`asst-mode is-${mode === "live" ? "live" : "off"}`}>
              <i aria-hidden />
              {copy.modes[mode]}
            </span>
          )}
          {messages.length > 0 && (
            <button
              type="button"
              className="asst-icon-btn"
              onClick={() => {
                reset();
                setSelectedId(null);
              }}
              aria-label="Clear conversation"
              title="Clear conversation"
            >
              <RotateCcw size={14} strokeWidth={1.75} />
            </button>
          )}
        </div>

        <div className="sd-body">
          <section className="sd-chat" aria-label="Conversation">
            <ChatThread
              messages={messages}
              onNavigate={() => {}}
              selectedId={selected?.id}
              onSelect={(id) => {
                setSelectedId(id);
                sound().tap();
              }}
              empty={
                <div className="asst-empty">
                  <p className="asst-greeting">{copy.greeting}</p>
                  <p className="asst-greeting-sub">Type below, or pick a scenario above.</p>
                </div>
              }
            />
            <Composer
              value={input}
              onChange={setInput}
              onSend={() => submit(input)}
              onStop={stop}
              busy={busy}
              disabled={limitReached}
              placeholder={limitReached ? copy.limit.placeholder : undefined}
              hint={remaining !== null && remaining > 0 ? copy.limit.remaining(remaining, freeLimit) : null}
            />
          </section>

          <section className="sd-side" aria-label="Under the hood">
            <p className="sd-side-label">Under the hood</p>
            <Inspector message={selected} />
          </section>
        </div>

        <AiLimitDialog open={limitOpen} onClose={closeLimit} limit={freeLimit} />

        <dl className="sd-stats">
          {stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
