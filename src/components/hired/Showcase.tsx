"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Play, RotateCcw } from "lucide-react";
import type { Showcase as ShowcaseData } from "@/types/content";

type Phase = "idle" | "running" | "done";
const STEP_MS = 900;

/**
 * Scripted walkthrough: plays a solution's steps one by one on sample data.
 * It is honest about being a scripted preview — live demos live on /demos/<slug>.
 */
export function Showcase({ data, resetKey }: { data: ShowcaseData; resetKey: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(-1);
  const timer = useRef<number | undefined>(undefined);

  // Reset whenever another solution is opened.
  useEffect(() => {
    window.clearTimeout(timer.current);
    setPhase("idle");
    setStep(-1);
  }, [resetKey]);

  useEffect(() => {
    if (phase !== "running") return;
    if (step >= data.steps.length) {
      setPhase("done");
      return;
    }
    timer.current = window.setTimeout(() => setStep((s) => s + 1), step < 0 ? 250 : STEP_MS);
    return () => window.clearTimeout(timer.current);
  }, [phase, step, data.steps.length]);

  const run = () => {
    setStep(-1);
    setPhase("running");
  };
  const reset = () => {
    window.clearTimeout(timer.current);
    setPhase("idle");
    setStep(-1);
  };

  return (
    <div className="showcase">
      <div className="sc-head">
        <span className="drawer-crumb" style={{ letterSpacing: "0.14em" }}>
          Demo showcase
        </span>
        <span className="sc-badge">Scripted preview · sample data</span>
      </div>
      <div className="sc-body">
        <div>
          <p className="sc-k">{data.inputLabel}</p>
          <p className="sc-input">{data.input}</p>
        </div>

        <ol className="sc-steps" aria-live="polite">
          {data.steps.map((s, i) => {
            const state = phase === "idle" ? "" : i < step ? "on done" : i === step ? "on run" : "";
            const finished = phase === "done";
            return (
              <li key={i} className={`sc-step ${finished ? "on done" : state}`}>
                <span className="sc-dot">{(finished || i < step) && <Check size={10} strokeWidth={3} />}</span>
                <span className="sc-l">{s.label}</span>
                <span className="sc-d">{s.detail}</span>
              </li>
            );
          })}
        </ol>

        {phase === "done" && (
          <div>
            <p className="sc-k">{data.outputLabel}</p>
            <p className="sc-out">{data.output}</p>
          </div>
        )}

        <div className="sc-actions">
          {phase === "idle" && (
            <button type="button" className="btn-pill" onClick={run}>
              <Play size={15} /> Run the sample
            </button>
          )}
          {phase === "running" && (
            <button type="button" className="btn-pill" disabled>
              Running…
            </button>
          )}
          {phase === "done" && (
            <button type="button" className="btn-ghost" onClick={reset}>
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>
        <p className="sc-note">
          This walkthrough replays a typical run on invented sample data to show the flow. It is not a live model call.
        </p>
      </div>
    </div>
  );
}
