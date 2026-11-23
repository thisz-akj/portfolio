"use client";

import { useState } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { PROJECT_TYPES, validateContact, type ContactErrors } from "@/lib/contact";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "ok" } | { kind: "fallback"; mailto: string } | { kind: "error"; msg: string };

export function ContactForm({ email }: { email: string }) {
  const [errors, setErrors] = useState<ContactErrors>({});
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const v = validateContact(raw);
    if (!v.ok) {
      setErrors(v.errors);
      const first = Object.keys(v.errors)[0];
      (e.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    setErrors({});
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(raw),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setState({ kind: "ok" });
        (e.target as HTMLFormElement).reset();
      } else if (res.status === 422 && json.errors) {
        setErrors(json.errors);
        setState({ kind: "idle" });
      } else if (res.status === 503 || res.status === 502) {
        const d = v.data;
        const body = `${d.message}\n\n— ${d.name}${d.company ? `, ${d.company}` : ""}`;
        setState({ kind: "fallback", mailto: `mailto:${email}?subject=${encodeURIComponent(d.type)}&body=${encodeURIComponent(body)}` });
      } else {
        setState({ kind: "error", msg: json.error ?? "Something went wrong. Please email me directly." });
      }
    } catch {
      setState({ kind: "error", msg: "Network error. Please email me directly." });
    }
  }

  const field = (name: keyof ContactErrors, label: string, input: React.ReactNode) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {input}
      {errors[name] && (
        <span className="field-error" id={`${name}-err`} role="alert">
          {errors[name]}
        </span>
      )}
    </div>
  );
  const aria = (name: keyof ContactErrors) => ({
    "aria-invalid": !!errors[name] || undefined,
    "aria-describedby": errors[name] ? `${name}-err` : undefined,
  });

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      {field("name", "Your name", <input id="name" name="name" autoComplete="name" required {...aria("name")} />)}
      {field("email", "Email", <input id="email" name="email" type="email" autoComplete="email" required {...aria("email")} />)}
      {field("company", "Company (optional)", <input id="company" name="company" autoComplete="organization" {...aria("company")} />)}
      {field(
        "type",
        "What do you need?",
        <select id="type" name="type" defaultValue="" required {...aria("type")}>
          <option value="" disabled>
            Choose one…
          </option>
          {PROJECT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>,
      )}
      {field(
        "message",
        "Tell me about the problem",
        <textarea id="message" name="message" required placeholder="What are you building, what's not working, and by when?" {...aria("message")} />,
      )}
      <div className="hp" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div aria-live="polite">
        {state.kind === "ok" && <p className="form-status ok">Thanks — message received. I usually reply within two working days.</p>}
        {state.kind === "fallback" && (
          <p className="form-status">
            The form isn&apos;t connected to delivery yet. <a href={state.mailto}>Open it in your email app instead</a> — your message is
            pre-filled.
          </p>
        )}
        {state.kind === "error" && (
          <p className="form-status err">
            {state.msg} <a href={`mailto:${email}`}>{email}</a>
          </p>
        )}
      </div>

      <div>
        <button type="submit" className="btn-pill" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? (
            <>
              Sending <LoaderCircle size={16} className="spin" />
            </>
          ) : (
            <>
              Send message <ArrowUpRight size={16} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
