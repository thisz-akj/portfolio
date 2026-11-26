"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sound } from "@/lib/sound";
import { assistantCopy as copy } from "@/content/assistant";
import {
  MAX_USER_CHARS,
  readEvents,
  type AssistantMode,
  type AssistantTrace,
} from "@/features/assistant/protocol";
import type { UiMessage } from "./AssistantMessage";

/** Give up on a reply when nothing has arrived for this long (the server itself gives up after ~15–20 s). */
const STALL_MS = 30_000;

let seq = 0;
const uid = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

function loadStored(key: string): UiMessage[] {
  try {
    const raw = window.sessionStorage.getItem(key);
    const msgs = raw ? (JSON.parse(raw) as UiMessage[]) : [];
    return Array.isArray(msgs)
      ? msgs
          .filter((m) => m.content)
          .map((m) => ({
            ...m,
            status: m.status === "error" ? "error" : "done",
          }))
      : [];
  } catch {
    return [];
  }
}

// The free-question allowance is shared by the floating panel and the support demo (same assistant).
const LIMIT_KEY = "ai-limit:assistant";
const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const limitReachedToday = () => {
  try {
    return window.localStorage.getItem(LIMIT_KEY) === todayIST();
  } catch {
    return false;
  }
};
const markLimitReached = () => {
  try {
    window.localStorage.setItem(LIMIT_KEY, todayIST());
  } catch {
    /* storage unavailable — the server still enforces the limit */
  }
};

/**
 * One conversation with /api/assistant: streaming, stop, reset and per-tab persistence.
 * Shared by the floating panel and the support-console demo (each with its own storage key).
 * Also tracks the free-question allowance: after the last free answer (or a "quota" reply) the
 * caller shows the AiLimitDialog via `limitOpen`.
 */
export function useAssistantChat(storeKey: string) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [mode, setMode] = useState<AssistantMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [freeLimit, setFreeLimit] = useState(3);
  const [limitReached, setLimitReached] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const limitRef = useRef(false);
  limitRef.current = limitReached;
  const abort = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    setMessages(loadStored(storeKey));
    if (limitReachedToday()) {
      setLimitReached(true);
      setRemaining(0);
    }
  }, [storeKey]);

  const hitLimit = useCallback((showNow: boolean) => {
    markLimitReached();
    setLimitReached(true);
    setRemaining(0);
    if (showNow) setLimitOpen(true);
  }, []);

  useEffect(() => {
    if (busy) return;
    try {
      window.sessionStorage.setItem(
        storeKey,
        JSON.stringify(messages.slice(-30)),
      );
    } catch {
      /* storage unavailable */
    }
  }, [messages, busy, storeKey]);

  useEffect(() => () => abort.current?.abort(), []);

  const patch = (id: string, fn: (m: UiMessage) => UiMessage) =>
    setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));

  /** Starts a reply and returns at once: true if the message was accepted (not empty, not already answering). */
  const send = useCallback((raw: string): boolean => {
    if (limitRef.current) {
      setLimitOpen(true); // allowance used: invite a message instead of asking the model
      return false;
    }
    const text = raw.trim().slice(0, MAX_USER_CHARS);
    if (!text || abort.current) return false;
    const ctrl = new AbortController();
    abort.current = ctrl;
    void run(text, ctrl);
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (text: string, ctrl: AbortController) => {
    sound().tap();
    const history = [
      ...messagesRef.current.filter((m) => m.status === "done" && m.content),
      { role: "user" as const, content: text },
    ]
      .slice(-20)
      .map(({ role, content }) => ({ role, content }));
    const botId = uid();
    setMessages((ms) => [
      ...ms,
      { id: uid(), role: "user", content: text, status: "done" },
      {
        id: botId,
        role: "assistant",
        content: "",
        status: "streaming",
        question: text,
      },
    ]);
    setBusy(true);
    let first = true;
    // Watchdog: if nothing arrives for STALL_MS, stop waiting and say so (never spin forever).
    let stalled = false;
    let watchdog = 0;
    const arm = () => {
      window.clearTimeout(watchdog);
      watchdog = window.setTimeout(() => {
        stalled = true;
        ctrl.abort();
      }, STALL_MS);
    };
    arm();
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: ctrl.signal,
      });
      const left = Number(res.headers.get("x-ai-remaining"));
      const lim = Number(res.headers.get("x-ai-limit"));
      if (lim > 0) setFreeLimit(lim);
      if (res.status === 429 && (await res.clone().json().catch(() => null))?.error === "quota") {
        patch(botId, (m) => ({ ...m, content: copy.limit.inline, status: "error" }));
        hitLimit(true);
        return;
      }
      if (res.ok && res.headers.has("x-ai-remaining") && Number.isFinite(left)) setRemaining(left);
      if (!res.ok || !res.body) {
        const msg =
          res.status === 429
            ? copy.errors.rateLimited
            : res.status === 503
              ? copy.errors.unavailable
              : copy.errors.generic;
        if (res.status === 503) setMode("offline");
        patch(botId, (m) => ({ ...m, content: msg, status: "error" }));
        return;
      }
      await readEvents(res.body, (e) => {
        arm();
        if (e.type === "meta") setMode(e.mode);
        else if (e.type === "delta") {
          if (first) {
            first = false;
            sound().hover(1.4);
          }
          patch(botId, (m) => ({ ...m, content: m.content + e.text }));
        } else if (e.type === "trace") {
          const trace: AssistantTrace = { ...e };
          delete (trace as Partial<typeof e>).type;
          patch(botId, (m) => ({ ...m, trace }));
        } else if (e.type === "error")
          patch(botId, (m) => ({
            ...m,
            // keep whatever was already said, then the note
            content: m.content.trim() ? `${m.content.trim()}\n\n*${e.message}*` : e.message,
            status: "error",
          }));
      });
      if (res.headers.has("x-ai-remaining") && left === 0) hitLimit(true); // that was the last free answer
      patch(botId, (m) =>
        m.status === "streaming"
          ? {
              ...m,
              status: m.content ? "done" : "error",
              content: m.content.trim() || copy.errors.generic,
            }
          : m,
      );
    } catch {
      if (stalled) {
        patch(botId, (m) => ({
          ...m,
          content: m.content.trim() ? `${m.content.trim()}\n\n*${copy.errors.stalled}*` : copy.errors.stalled,
          status: "error",
        }));
      } else if (ctrl.signal.aborted) {
        setMessages((ms) =>
          ms.flatMap((m) =>
            m.id !== botId
              ? [m]
              : m.content
                ? [{ ...m, status: "done" as const }]
                : [],
          ),
        );
      } else
        patch(botId, (m) => ({
          ...m,
          content: copy.errors.unavailable,
          status: "error",
        }));
    } finally {
      window.clearTimeout(watchdog);
      abort.current = null;
      setBusy(false);
    }
  };

  const stop = useCallback(() => abort.current?.abort(), []);

  const reset = useCallback(() => {
    abort.current?.abort();
    setMessages([]);
    sound().tap();
  }, []);

  const closeLimit = useCallback(() => setLimitOpen(false), []);

  return { messages, mode, busy, send, stop, reset, remaining, freeLimit, limitReached, limitOpen, closeLimit };
}
