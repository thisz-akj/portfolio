"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef } from "react";
import { ArrowUpRight, MessageSquareText, X } from "lucide-react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { sound } from "@/lib/sound";
import { assistantCopy } from "@/content/assistant";
import "@/styles/ai-limit.css";

/**
 * Shown once a visitor has used their free AI questions (site assistant, support demo, Ask Ops Suite).
 * Renders as an overlay inside its nearest positioned parent, so it sits over the tool it belongs to.
 */
/** `copy` overrides the default "free questions used" wording (e.g. the voice demo's "build this" pitch). */
export function AiLimitDialog({
  open,
  onClose,
  limit = 3,
  message,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  limit?: number;
  message?: string;
  copy?: { eyebrow?: string; title?: string; cta?: string; href?: string };
}) {
  const root = useRef<HTMLDivElement>(null);
  const cta = useRef<HTMLAnchorElement>(null);
  const c = assistantCopy.limit;

  // fromTo + revert: safe when React dev runs the effect twice.
  useLayoutEffect(() => {
    const el = root.current;
    if (!open || !el) return;
    sound().tap();
    if (prefersReducedMotion()) return;
    const tl = gsap
      .timeline()
      .fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: "power2.out" })
      .fromTo(
        el.querySelector(".ai-limit-card"),
        { y: 28, scale: 0.96, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.7, ease: "expo.out" },
        0.05,
      )
      .fromTo(el.querySelectorAll(".ai-limit-reveal"), { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out", stagger: 0.06 }, 0.2);
    return () => {
      tl.revert();
    };
  }, [open]);

  // Esc closes the pop-up wherever focus is (capture phase, so the chat panel behind it stays open);
  // focus moves to the button once the fade-in has made it visible.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    const t = window.setTimeout(() => cta.current?.focus({ preventScroll: true }), prefersReducedMotion() ? 30 : 450);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      ref={root}
      className="ai-limit"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ai-limit-title"
      aria-describedby="ai-limit-body"
    >
      <div className="ai-limit-card">
        <button type="button" className="ai-limit-close" onClick={onClose} aria-label="Close">
          <X size={15} strokeWidth={1.75} />
        </button>
        <span className="ai-limit-icon ai-limit-reveal" aria-hidden>
          <MessageSquareText size={20} strokeWidth={1.5} />
        </span>
        <p className="ai-limit-eyebrow ai-limit-reveal">{copy?.eyebrow ?? c.eyebrow}</p>
        <h2 id="ai-limit-title" className="ai-limit-reveal">
          {copy?.title ?? c.title}
        </h2>
        <p id="ai-limit-body" className="ai-limit-body ai-limit-reveal">
          {message ?? c.body(limit)}
        </p>
        <div className="ai-limit-actions ai-limit-reveal">
          <Link ref={cta} href={copy?.href ?? c.href} className="ai-limit-cta" onClick={() => sound().tap()}>
            {copy?.cta ?? c.cta} <ArrowUpRight size={15} strokeWidth={1.75} />
          </Link>
          <button type="button" className="ai-limit-dismiss" onClick={onClose}>
            {c.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
