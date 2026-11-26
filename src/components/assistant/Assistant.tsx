"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RotateCcw, X } from "lucide-react";
import { gsap, onLoaderDone, prefersReducedMotion } from "@/lib/motion";
import { sound } from "@/lib/sound";
import { assistantCopy as copy } from "@/content/assistant";
import { AiLimitDialog } from "@/components/shared/AiLimitDialog";
import { ChatThread, Composer, Suggestions } from "./ChatParts";
import { useAssistantChat } from "./useAssistantChat";

/**
 * "Ask about Azad": a floating launcher that opens a chat panel with an iris reveal.
 * Replies stream from /api/assistant (→ Python service in assistant/). The conversation survives
 * client-side navigation (SiteChrome stays mounted) and reloads (sessionStorage, best effort).
 * Hidden on the support demo page, which embeds the same assistant as a console.
 */

// The panel sits above the launcher, so the iris opens from just below its bottom-right corner.
const IRIS_AT = "calc(100% - 2.4rem) calc(100% + 2.2rem)";
export const SUPPORT_DEMO_PATH = "/demos/customer-support";

export function Assistant() {
  const pathname = usePathname();
  const hidden = pathname === SUPPORT_DEMO_PATH;
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [mac, setMac] = useState(true);
  const { messages, mode, busy, send, stop, reset, remaining, freeLimit, limitReached, limitOpen, closeLimit } =
    useAssistantChat("assistant-chat-v1");

  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    return onLoaderDone(() => setReady(true));
  }, []);

  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  useLayoutEffect(() => {
    const el = launcher.current;
    if (!el || !ready || hidden) return;
    if (prefersReducedMotion()) {
      gsap.set(el, { autoAlpha: 1 });
      return;
    }
    const t = gsap.fromTo(el, { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, ease: "expo.out", delay: 0.5 });
    return () => {
      t.kill();
    };
  }, [ready, hidden]);

  // Iris open / close, then stagger the panel's contents in.
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    const reduced = prefersReducedMotion();
    const tl = gsap.timeline();
    if (open) {
      gsap.set(el, { visibility: "visible" });
      if (reduced) tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 });
      else {
        tl.fromTo(
          el,
          { autoAlpha: 1, clipPath: `circle(0% at ${IRIS_AT})` },
          { clipPath: `circle(150% at ${IRIS_AT})`, duration: 0.9, ease: "expo.inOut" },
        ).fromTo(
          el.querySelectorAll(".asst-reveal"),
          { y: 16, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.7, ease: "power3.out", stagger: 0.05 },
          0.35,
        );
      }
      const t = window.setTimeout(() => field.current?.focus({ preventScroll: true }), reduced ? 50 : 450);
      return () => {
        window.clearTimeout(t);
        tl.kill();
      };
    }
    if (el.style.visibility !== "visible") return;
    if (reduced) tl.to(el, { autoAlpha: 0, duration: 0.15 });
    else tl.to(el, { clipPath: `circle(0% at ${IRIS_AT})`, duration: 0.55, ease: "power3.in" });
    tl.set(el, { visibility: "hidden" });
    return () => {
      tl.kill();
    };
  }, [open]);

  const toggle = useCallback((next?: boolean) => {
    setOpen((o) => {
      const v = next ?? !o;
      if (v !== o) sound().tap();
      if (!v) window.setTimeout(() => launcher.current?.focus({ preventScroll: true }), 0);
      return v;
    });
  }, []);

  // ⌘K / Ctrl+K toggles; Esc closes.
  useEffect(() => {
    if (hidden) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape" && open && !limitOpen) toggle(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toggle, hidden, limitOpen]);

  const submit = (text: string) => {
    if (send(text)) setInput("");
  };

  if (hidden) return null;
  const modeLabel = mode ? copy.modes[mode] : null;

  return (
    <>
      <button
        ref={launcher}
        type="button"
        className={`asst-launcher${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-controls="assistant-panel"
        aria-label={open ? "Close assistant" : copy.launcher}
        onClick={() => toggle()}
        onPointerEnter={() => sound().hover(1.2)}
        style={{ visibility: "hidden" }}
      >
        <span className="asst-orb" aria-hidden />
        <span className="asst-launcher-label">{copy.launcher}</span>
        <kbd className="asst-kbd" aria-hidden>
          {mac ? "⌘K" : "Ctrl K"}
        </kbd>
        <X className="asst-launcher-x" size={16} strokeWidth={1.75} aria-hidden />
      </button>

      <div
        ref={panel}
        id="assistant-panel"
        className="asst-panel"
        role="dialog"
        aria-modal="false"
        aria-label="Ask about Azad"
        inert={!open}
        style={{ visibility: "hidden" }}
      >
        <header className="asst-head asst-reveal">
          <div className="asst-title">
            <span className="asst-orb is-lg" aria-hidden />
            <div>
              <h2>
                {copy.title} <em>{copy.titleName}</em>
              </h2>
              <p>
                {copy.subtitle}
                {modeLabel && (
                  <span className={`asst-mode is-${mode === "live" ? "live" : "off"}`}>
                    <i aria-hidden />
                    {modeLabel}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="asst-head-actions">
            {messages.length > 0 && (
              <button
                type="button"
                className="asst-icon-btn"
                onClick={() => {
                  reset();
                  field.current?.focus();
                }}
                aria-label="New conversation"
                title="New conversation"
              >
                <RotateCcw size={15} strokeWidth={1.75} />
              </button>
            )}
            <button type="button" className="asst-icon-btn" onClick={() => toggle(false)} aria-label="Close assistant" title="Close (Esc)">
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <ChatThread
          messages={messages}
          onNavigate={() => window.matchMedia("(max-width: 640px)").matches && toggle(false)}
          empty={
            <div className="asst-empty">
              <p className="asst-greeting asst-reveal">{copy.greeting}</p>
              <p className="asst-greeting-sub asst-reveal">{copy.greetingSub}</p>
              <Suggestions items={copy.suggestions} onPick={submit} />
            </div>
          }
        />

        <Composer
          className="asst-reveal"
          value={input}
          onChange={setInput}
          onSend={() => submit(input)}
          onStop={stop}
          busy={busy}
          fieldRef={field}
          disabled={limitReached}
          placeholder={limitReached ? copy.limit.placeholder : undefined}
          hint={remaining !== null && remaining > 0 ? copy.limit.remaining(remaining, freeLimit) : null}
        />
        <AiLimitDialog open={limitOpen} onClose={closeLimit} limit={freeLimit} />
      </div>
    </>
  );
}
