"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { AiLimitDialog } from "@/components/shared/AiLimitDialog";
import { openLiveDemo } from "@/lib/liveDemo";
import { ApiError, askDoc, type Quota } from "../api";
import type { Answer, DocDetail, Rect } from "../types";

type Msg = { role: "user"; text: string } | { role: "answer"; answer: Answer } | { role: "error"; text: string };

/** Starter questions for uploads (samples come with pre-written examples). */
const STARTERS: Record<string, string[]> = {
  invoice: ["What is the total payable and when is it due?", "Who is the supplier and what's their GSTIN?", "List the line items"],
  purchase_order: ["What was ordered and at what price?", "What are the delivery and payment terms?"],
  contract: ["Who are the parties?", "How can either side end this agreement?", "Is there a liability cap?"],
  lease: ["What is the rent and how does it change?", "What's the lock-in period?"],
  policy: ["Summarise the main entitlements", "Who does this policy apply to?"],
  other: ["What is this document about?", "Are there any dates or deadlines?", "What amounts are mentioned?"],
};

const MODE_LABEL: Record<Answer["mode"], { text: string; cls: string }> = {
  answer: { text: "Answer · sources checked", cls: "is-ok" },
  example: { text: "Example answer · sources checked", cls: "is-ok" },
  not_found: { text: "Not in this document", cls: "is-warning" },
  passages: { text: "Closest passages", cls: "is-info" },
};

export function AskPanel({ doc, docType, onCite }: { doc: DocDetail; docType: string; onCite: (rects: Rect[]) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<Quota>({ remaining: null, limit: null });
  const [limitOpen, setLimitOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs, busy]);

  const cite = (key: string, rects: Rect[]) => {
    setActive(key);
    onCite(rects);
  };

  const run = async (question: string, example?: number) => {
    if (busy || (!question.trim() && example === undefined)) return;
    const history = msgs
      .filter((m) => m.role !== "error")
      .slice(-4)
      .map((m) => (m.role === "user" ? { role: "user", content: m.text } : { role: "assistant", content: m.role === "answer" ? m.answer.answer : "" }));
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setText("");
    setBusy(true);
    try {
      const { data, quota: q } = await askDoc(doc.id, example !== undefined ? { example } : { question, history });
      if (q.remaining !== null) setQuota(q);
      setMsgs((m) => [...m, { role: "answer", answer: data }]);
      const first = data.citations[0];
      if (first) cite(`${msgs.length + 1}-1`, first.rects);
    } catch (e) {
      const err = e as ApiError & { quota?: Quota };
      if (err.code === "quota") {
        setQuota({ remaining: 0, limit: err.quota?.limit ?? 3 });
        setLimitOpen(true);
        setMsgs((m) => m.slice(0, -1));
        setText(question);
      } else {
        if (err.code === "offline") openLiveDemo("DocDesk");
        setMsgs((m) => [...m, { role: "error", text: err.message || "Something went wrong. Please try again." }]);
      }
    } finally {
      setBusy(false);
    }
  };

  const outOfQuestions = quota.remaining === 0;
  const starters = doc.examples.length ? null : (STARTERS[docType] ?? STARTERS.other);

  return (
    <div className="dd-ask">
      <div className="dd-thread" aria-live="polite">
        {msgs.length === 0 && (
          <div>
            <p className="dd-subhead">{doc.examples.length ? "Try an example (instant, no AI call)" : "Ask anything about this document"}</p>
            <div className="dd-suggest">
              {doc.examples.map((q, i) => (
                <button key={q} type="button" onClick={() => void run(q, i)}>
                  {q}
                </button>
              ))}
              {starters?.map((q) => (
                <button key={q} type="button" onClick={() => void run(q)}>
                  {q}
                </button>
              ))}
            </div>
            <p className="dd-note" style={{ marginTop: "0.9rem", lineHeight: 1.55 }}>
              Every answer links to the exact passage it came from. If the document doesn&apos;t say, DocDesk tells you instead of guessing.
            </p>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="dd-msg-q">
              {m.text}
            </p>
          ) : m.role === "error" ? (
            <p key={i} className="dd-error" role="alert">
              {m.text}
            </p>
          ) : (
            <AnswerView key={i} index={i} answer={m.answer} active={active} onCite={cite} />
          ),
        )}
        {busy && (
          <span className="dd-typing" aria-label="Reading the document">
            <i />
            <i />
            <i />
          </span>
        )}
        {msgs.length > 0 && doc.examples.length > 0 && !busy && (
          <div className="dd-suggest">
            {doc.examples.map((q, i) => (
              <button key={q} type="button" onClick={() => void run(q, i)}>
                {q}
              </button>
            ))}
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="dd-composer">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (outOfQuestions) setLimitOpen(true);
            else void run(text);
          }}
        >
          <textarea
            rows={1}
            value={text}
            maxLength={500}
            placeholder={outOfQuestions ? "Free questions used — examples still work" : `Ask about ${doc.title.split("—")[0].trim()}…`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            aria-label="Your question"
          />
          <button type="submit" className="dd-btn is-primary" disabled={busy || !text.trim()} aria-label="Ask">
            <ArrowUp size={15} />
          </button>
        </form>
        <div className="dd-composer-foot">
          <span>AI can be wrong — check the highlighted source.</span>
          {quota.remaining !== null && quota.limit !== null && <span>{quota.remaining} of {quota.limit} free questions left today</span>}
        </div>
      </div>
      <AiLimitDialog open={limitOpen} onClose={() => setLimitOpen(false)} limit={quota.limit ?? 3} />
    </div>
  );
}

function AnswerView({ index, answer, active, onCite }: { index: number; answer: Answer; active: string | null; onCite: (key: string, rects: Rect[]) => void }) {
  const mode = MODE_LABEL[answer.mode];
  const parts = answer.answer.split(/(\[\d+\])/g);
  return (
    <div className="dd-msg-a">
      <div className="dd-mode">
        <span className={`dd-chip ${mode.cls}`}>{mode.text}</span>
      </div>
      <p>
        {parts.map((p, i) => {
          const m = /^\[(\d+)\]$/.exec(p);
          const c = m ? answer.citations.find((x) => x.n === Number(m[1])) : null;
          return c ? (
            <button key={i} type="button" className="dd-sup" onClick={() => onCite(`${index}-${c.n}`, c.rects)} aria-label={`Show source ${c.n} on page ${c.page}`}>
              {c.n}
            </button>
          ) : (
            <Fragment key={i}>{m ? "" : p}</Fragment>
          );
        })}
      </p>
      {answer.citations.length > 0 && (
        <div className="dd-cites">
          {answer.citations.map((c) => (
            <button key={c.n} type="button" className={`dd-cite${active === `${index}-${c.n}` ? " is-active" : ""}`} onClick={() => onCite(`${index}-${c.n}`, c.rects)}>
              <span className="dd-cite-n">{c.n}</span>
              <span className="dd-cite-where">
                Page {c.page}
                {c.section ? ` · ${c.section}` : ""}
              </span>
              <span className="dd-cite-q">“{c.quote.length > 220 ? `${c.quote.slice(0, 220)}…` : c.quote}”</span>
            </button>
          ))}
        </div>
      )}
      <p className="dd-meta">
        {answer.mode === "example" ? "Pre-written example" : answer.cached ? "Answered before · instant" : answer.latencyMs ? `${(answer.latencyMs / 1000).toFixed(1)} s` : ""}
        {answer.busy ? " · answers are busy, showing the closest passages" : ""}
      </p>
    </div>
  );
}
