"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { ArrowUp, Square } from "lucide-react";
import { sound } from "@/lib/sound";
import { assistantCopy as copy } from "@/content/assistant";
import { MAX_USER_CHARS } from "@/features/assistant/protocol";
import { AssistantMessage, type UiMessage } from "./AssistantMessage";

/** Scrollable message list (or the empty state), pinned to the newest message unless the reader scrolls up. */
export function ChatThread({
  messages,
  empty,
  onNavigate,
  selectedId,
  onSelect,
}: {
  messages: UiMessage[];
  empty: ReactNode;
  onNavigate: () => void;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const count = messages.length;

  useEffect(() => {
    stick.current = true;
  }, [count]);

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={scroller}
      className="asst-scroll"
      data-lenis-prevent
      onScroll={() => {
        const el = scroller.current;
        if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      }}
    >
      {messages.length === 0 ? (
        empty
      ) : (
        <div className="asst-log" role="log" aria-live="polite" aria-relevant="additions">
          {messages.map((m) => (
            <AssistantMessage
              key={m.id}
              message={m}
              onNavigate={onNavigate}
              selected={selectedId === m.id}
              onSelect={onSelect && m.role === "assistant" ? () => onSelect(m.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Suggestions({ items, onPick }: { items: string[]; onPick: (s: string) => void }) {
  return (
    <ul className="asst-suggestions">
      {items.map((s, i) => (
        <li key={s} className="asst-reveal">
          <button type="button" onClick={() => onPick(s)} onPointerEnter={() => sound().hover(1 + i * 0.05)}>
            <span className="asst-sugg-n">{String(i + 1).padStart(2, "0")}</span>
            {s}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Auto-growing textarea + send/stop. Enter sends, Shift+Enter adds a line. */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  fieldRef,
  className = "",
  disabled = false,
  placeholder,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  fieldRef?: RefObject<HTMLTextAreaElement | null>;
  className?: string;
  /** Free questions used: the field is read-only and sending opens the pop-up instead. */
  disabled?: boolean;
  placeholder?: string;
  /** Small note in the footer, e.g. "2 of 3 free questions left". */
  hint?: string | null;
}) {
  const own = useRef<HTMLTextAreaElement>(null);
  const field = fieldRef ?? own;

  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [value, field]);

  return (
    <form
      className={`asst-form ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <div className="asst-field">
        <textarea
          ref={field}
          rows={1}
          value={value}
          maxLength={MAX_USER_CHARS}
          readOnly={disabled}
          placeholder={placeholder ?? copy.placeholder}
          aria-label="Your question"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        {busy ? (
          <button type="button" className="asst-send is-stop" onClick={onStop} aria-label="Stop answer">
            <Square size={12} strokeWidth={2} fill="currentColor" />
          </button>
        ) : (
          <button type="submit" className="asst-send" disabled={!disabled && !value.trim()} aria-label="Send">
            <ArrowUp size={16} strokeWidth={2} />
          </button>
        )}
      </div>
      <p className="asst-foot">
        <span>{hint ?? copy.footnote}</span>
        {value.length > MAX_USER_CHARS * 0.8 && (
          <span className="asst-count">
            {value.length}/{MAX_USER_CHARS}
          </span>
        )}
      </p>
    </form>
  );
}
