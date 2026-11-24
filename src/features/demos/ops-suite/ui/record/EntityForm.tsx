"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { saveRecordAction } from "../../data/actions";
import { forms, validateForm, type FormField } from "../../entities/forms";
import type { Option } from "../../filters/types";
import { formatINR, parseAmount } from "../../lib/format";

type Inputs = Record<string, string | boolean>;

const toInputs = (fields: FormField[], initial: Record<string, unknown>): Inputs =>
  Object.fromEntries(fields.map((f) => [f.key, f.input === "checkbox" ? initial[f.key] === true : initial[f.key] === null || initial[f.key] === undefined ? "" : String(initial[f.key])]));

/** Create/edit form for any CRM entity, driven by entities/forms.ts. Validates in the browser, then on the server. */
export function EntityForm({
  entity,
  id,
  initial = {},
  options,
  onSaved,
  onCancel,
}: {
  entity: string;
  id: number | null;
  initial?: Record<string, unknown>;
  options: Record<string, Option[]>;
  onSaved: (id: number) => void;
  onCancel: () => void;
}) {
  const form = forms[entity];
  const [values, setValues] = useState<Inputs>(() => toInputs(form.fields, initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const root = useRef<HTMLFormElement>(null);

  const shown = useMemo(() => form.fields.filter((f) => !f.showWhen || values[f.showWhen.field] === f.showWhen.equals), [form.fields, values]);

  const set = (key: string, v: string | boolean) =>
    setValues((cur) => {
      const next = { ...cur, [key]: v };
      // dependent pickers: clear a child whose option no longer belongs to the chosen parent
      for (const f of form.fields) {
        if (f.dependsOn === key && next[f.key] && !(options[f.optionsKey!] ?? []).some((o) => o.value === next[f.key] && o.group === v)) next[f.key] = "";
      }
      return next;
    });

  const focusFirstError = (errs: Record<string, string>) => {
    const first = form.fields.find((f) => errs[f.key]);
    if (first) root.current?.querySelector<HTMLElement>(`[name="${first.key}"]`)?.focus();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const payload = Object.fromEntries(Object.entries(values).filter(([k]) => shown.some((f) => f.key === k)));
    const check = validateForm({ ...form, fields: shown }, payload);
    if (!check.ok) {
      setErrors(check.errors);
      focusFirstError(check.errors);
      return;
    }
    start(async () => {
      const res = await saveRecordAction(entity, id, payload);
      if (res.ok) onSaved(res.id);
      else {
        setErrors(res.errors ?? {});
        setMessage(res.message ?? (res.errors ? "Please fix the highlighted fields." : null));
        if (res.errors) focusFirstError(res.errors);
      }
    });
  };

  return (
    <form ref={root} className="ops-form" onSubmit={submit} noValidate>
      <div className="ops-form-grid">
        {shown.map((f) => {
          const err = errors[f.key];
          const v = values[f.key];
          const fid = `f-${entity}-${f.key}`;
          const describedBy = [err ? `${fid}-err` : null, f.help ? `${fid}-help` : null].filter(Boolean).join(" ") || undefined;
          const common = { id: fid, name: f.key, "aria-invalid": !!err || undefined, "aria-describedby": describedBy, "aria-required": f.required || undefined };
          let control: React.ReactNode;
          if (f.input === "checkbox") {
            control = (
              <label className="ops-form-check">
                <input type="checkbox" {...common} checked={v === true} onChange={(e) => set(f.key, e.target.checked)} /> {f.label}
              </label>
            );
          } else if (f.input === "select" || f.input === "relation") {
            let opts = f.input === "select" ? f.options ?? [] : options[f.optionsKey!] ?? [];
            if (f.dependsOn) opts = opts.filter((o) => o.group === values[f.dependsOn!]);
            control = (
              <select {...common} value={String(v)} onChange={(e) => set(f.key, e.target.value)} disabled={!!f.dependsOn && !values[f.dependsOn]}>
                <option value="">{f.dependsOn && !values[f.dependsOn] ? "Choose a company first" : f.required ? "Select…" : "—"}</option>
                {opts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
          } else if (f.input === "textarea") {
            control = <textarea {...common} value={String(v)} maxLength={f.maxLength} onChange={(e) => set(f.key, e.target.value)} rows={3} />;
          } else {
            const type = f.input === "money" ? "text" : f.input === "number" ? "text" : f.input;
            control = (
              <input
                {...common}
                type={type}
                inputMode={f.input === "number" ? "numeric" : f.input === "money" ? "decimal" : undefined}
                value={String(v)}
                maxLength={f.maxLength}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
                autoComplete="off"
              />
            );
          }
          const amount = f.input === "money" && v ? parseAmount(String(v)) : null;
          return (
            <div key={f.key} className={`ops-field${f.half ? " is-half" : ""}${err ? " has-error" : ""}`}>
              {f.input !== "checkbox" && (
                <label htmlFor={fid}>
                  {f.label}
                  {f.required && <span aria-hidden="true"> *</span>}
                </label>
              )}
              {control}
              {f.input === "money" && amount !== null && !err && <span className="ops-hint">{formatINR(amount)}</span>}
              {f.help && (
                <span className="ops-hint" id={`${fid}-help`}>
                  {f.help}
                </span>
              )}
              {err && (
                <span className="ops-error" id={`${fid}-err`}>
                  {err}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {message && (
        <p className="ops-error" role="alert">
          {message}
        </p>
      )}
      <div className="ops-form-actions">
        <button type="button" className="ops-btn is-ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className="ops-btn is-primary" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Create"}
        </button>
      </div>
    </form>
  );
}
