"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { parseMarkdown, type Inline } from "@/features/assistant/markdown";
import type { AssistantRoute, AssistantTrace } from "@/features/assistant/protocol";
import { neutral } from "@/lib/neutral";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "streaming" | "done" | "error";
  /** The visitor question this reply answers (assistant messages). */
  question?: string;
  trace?: AssistantTrace;
}

export const routeLabel: Record<AssistantRoute, string> = {
  answered: "Answered",
  handoff: "Handed to Azad",
  off_topic: "Out of scope",
};

function Inlines({ parts, onNavigate }: { parts: Inline[]; onNavigate: () => void }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === "strong") return <strong key={i}>{p.text}</strong>;
        if (p.kind === "em") return <em key={i}>{p.text}</em>;
        if (p.kind === "link")
          return p.external ? (
            <a key={i} className="asst-link" href={p.href} target={p.href.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer">
              {p.text}
              <ArrowUpRight size={12} strokeWidth={1.75} aria-hidden />
            </a>
          ) : (
            <Link key={i} className="asst-link" href={p.href} onClick={onNavigate}>
              {p.text}
              <ArrowUpRight size={12} strokeWidth={1.75} aria-hidden />
            </Link>
          );
        return <span key={i}>{p.text}</span>;
      })}
    </>
  );
}

export function AssistantMessage({
  message,
  onNavigate,
  selected = false,
  onSelect,
}: {
  message: UiMessage;
  onNavigate: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Replies name Azad instead of he/she even when the model slips (rule from the assistant prompt).
  const blocks = useMemo(() => parseMarkdown(message.role === "assistant" ? neutral(message.content) : message.content), [message.content, message.role]);
  const waiting = message.status === "streaming" && !message.content;

  // Entrance: user bubbles rise and settle; assistant replies fade up.
  // fromTo with explicit end values + revert on cleanup: React dev (StrictMode) runs this effect twice,
  // and a plain gsap.from() would then animate from hidden *to* hidden and the message never appears.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const tween =
      message.role === "user"
        ? gsap.fromTo(
            el,
            { y: 14, scale: 0.96, autoAlpha: 0, transformOrigin: "100% 100%" },
            { y: 0, scale: 1, autoAlpha: 1, duration: 0.55, ease: "expo.out", clearProps: "transform,opacity,visibility" },
          )
        : gsap.fromTo(el, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out", clearProps: "transform,opacity,visibility" });
    return () => {
      tween.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (message.role === "user") {
    return (
      <div ref={ref} className="asst-msg is-user">
        <p>{message.content}</p>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`asst-msg is-bot${message.status === "error" ? " is-error" : ""}${selected ? " is-selected" : ""}`}
      aria-busy={message.status === "streaming"}
    >
      <span className="asst-msg-label" aria-hidden>
        <span className="asst-orb is-mini" />
        Assistant
      </span>
      {waiting ? (
        <div className="asst-thinking" role="status">
          <span />
          <span />
          <span />
          <em>Reading the site</em>
        </div>
      ) : (
        <div className={`asst-md${message.status === "streaming" ? " is-streaming" : ""}`}>
          {blocks.map((b, i) =>
            b.kind === "p" ? (
              <p key={i}>
                <Inlines parts={b.inline} onNavigate={onNavigate} />
              </p>
            ) : b.ordered ? (
              <ol key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inlines parts={it} onNavigate={onNavigate} />
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inlines parts={it} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            ),
          )}
        </div>
      )}
      {onSelect && message.trace && (
        <button type="button" className={`asst-route is-${message.trace.route}`} onClick={onSelect} aria-pressed={selected}>
          <i aria-hidden />
          {routeLabel[message.trace.route]}
          <span>{selected ? "Inspecting" : "Inspect"}</span>
        </button>
      )}
    </div>
  );
}
