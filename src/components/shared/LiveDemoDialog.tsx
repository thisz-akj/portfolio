"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, LoaderCircle, MonitorPlay, X } from "lucide-react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { sound } from "@/lib/sound";
import { LIVE_DEMO_EVENT, type LiveDemoRequest } from "@/lib/liveDemo";
import { LIVE_DEMO_TYPE, validateContact, type ContactErrors } from "@/lib/contact";
import { liveDemoCopy as c, site } from "@/content/site";
import "@/styles/ai-limit.css";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error" };

/**
 * Site-wide "let's run it live" pop-up. Mounted once in the root layout; opened by `openLiveDemo(demo)`
 * when a live feature's service is offline. The request goes through /api/contact (same email delivery
 * and checks as the contact page), typed as a live demo request with the demo's name in the message.
 */
export function LiveDemoDialog() {
  const [demo, setDemo] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [errors, setErrors] = useState<ContactErrors>({});
  const root = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      opener.current = document.activeElement;
      setDemo((e as CustomEvent<LiveDemoRequest>).detail.demo);
      setState({ kind: "idle" });
      setErrors({});
    };
    window.addEventListener(LIVE_DEMO_EVENT, onOpen);
    return () => window.removeEventListener(LIVE_DEMO_EVENT, onOpen);
  }, []);

  const close = useCallback(() => {
    setDemo(null);
    (opener.current as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, []);

  // fromTo + revert: safe when React dev runs the effect twice.
  useLayoutEffect(() => {
    const el = root.current;
    if (!demo || !el) return;
    sound().tap();
    if (prefersReducedMotion()) return;
    const tl = gsap
      .timeline()
      .fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: "power2.out" })
      .fromTo(el.querySelector(".ai-limit-card"), { y: 28, scale: 0.96, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.7, ease: "expo.out" }, 0.05)
      .fromTo(el.querySelectorAll(".ai-limit-reveal"), { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out", stagger: 0.05 }, 0.2);
    return () => {
      tl.revert();
    };
  }, [demo]);

  // Esc closes (capture phase, so panels behind it stay open); focus the first field once visible.
  useEffect(() => {
    if (!demo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    const t = window.setTimeout(() => first.current?.focus({ preventScroll: true }), prefersReducedMotion() ? 30 : 450);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.clearTimeout(t);
    };
  }, [demo, close]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!demo) return;
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const note = (f.note ?? "").trim();
    const raw = {
      name: f.name,
      email: f.email,
      company: f.company,
      website: f.website,
      type: LIVE_DEMO_TYPE,
      message: `Live demo request: ${demo}.\n\n${note || "No note added."}\n\nPage: ${window.location.pathname}`,
    };
    const v = validateContact(raw);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    setErrors({});
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(raw) });
      const json = (await res.json().catch(() => ({}))) as { errors?: ContactErrors };
      if (res.ok) {
        sound().tap();
        setState({ kind: "sent" });
      } else if (res.status === 422 && json.errors) {
        setErrors(json.errors);
        setState({ kind: "idle" });
      } else setState({ kind: "error" });
    } catch {
      setState({ kind: "error" });
    }
  }

  if (!demo) return null;
  const err = (k: keyof ContactErrors) =>
    errors[k] ? (
      <span className="field-error" id={`ld-${k}-err`} role="alert">
        {errors[k]}
      </span>
    ) : null;
  const aria = (k: keyof ContactErrors) => ({ "aria-invalid": !!errors[k] || undefined, "aria-describedby": errors[k] ? `ld-${k}-err` : undefined });

  return (
    <div
      ref={root}
      className="ai-limit live-demo"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-demo-title"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="ai-limit-card">
        <button type="button" className="ai-limit-close" onClick={close} aria-label="Close">
          <X size={15} strokeWidth={1.75} />
        </button>
        <span className="ai-limit-icon ai-limit-reveal" aria-hidden>
          {state.kind === "sent" ? <Check size={20} strokeWidth={1.75} /> : <MonitorPlay size={20} strokeWidth={1.5} />}
        </span>

        {state.kind === "sent" ? (
          <div aria-live="polite">
            <p className="ai-limit-eyebrow">{c.eyebrow}</p>
            <h2 id="live-demo-title">{c.sent.title}</h2>
            <p className="ai-limit-body">{c.sent.body}</p>
            <div className="ai-limit-actions">
              <button type="button" className="ai-limit-cta" onClick={close}>
                {c.dismiss} <ArrowUpRight size={15} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="ai-limit-eyebrow ai-limit-reveal">{c.eyebrow}</p>
            <h2 id="live-demo-title" className="ai-limit-reveal">
              {c.title}
            </h2>
            <p className="ai-limit-body ai-limit-reveal">{c.body(demo)}</p>
            <form className="live-demo-form ai-limit-reveal" onSubmit={onSubmit} noValidate>
              <label>
                <span>{c.fields.name}</span>
                <input ref={first} name="name" autoComplete="name" required maxLength={100} {...aria("name")} />
                {err("name")}
              </label>
              <label>
                <span>{c.fields.email}</span>
                <input name="email" type="email" autoComplete="email" required maxLength={200} {...aria("email")} />
                {err("email")}
              </label>
              <label>
                <span>{c.fields.company}</span>
                <input name="company" autoComplete="organization" maxLength={120} {...aria("company")} />
              </label>
              <label>
                <span>{c.fields.note}</span>
                <textarea name="note" rows={2} maxLength={1000} placeholder={c.notePlaceholder} />
                {err("message")}
              </label>
              <div className="hp" aria-hidden="true">
                <input name="website" tabIndex={-1} autoComplete="off" />
              </div>
              {state.kind === "error" && (
                <p className="live-demo-status" role="alert">
                  {c.error} <a href={`mailto:${site.email}?subject=${encodeURIComponent(`Live demo: ${demo}`)}`}>{site.email}</a>
                </p>
              )}
              <div className="ai-limit-actions">
                <button type="submit" className="ai-limit-cta" disabled={state.kind === "sending"}>
                  {state.kind === "sending" ? (
                    <>
                      {c.sending} <LoaderCircle size={15} className="spin" />
                    </>
                  ) : (
                    <>
                      {c.submit} <ArrowUpRight size={15} strokeWidth={1.75} />
                    </>
                  )}
                </button>
                <button type="button" className="ai-limit-dismiss" onClick={close}>
                  {c.dismiss}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
