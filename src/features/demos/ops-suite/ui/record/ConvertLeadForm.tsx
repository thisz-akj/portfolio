"use client";

import { useState, useTransition } from "react";
import { convertLeadAction } from "../../data/actions";
import { INDUSTRY, SIZE } from "../../entities/companies";
import { formatINR, parseAmount } from "../../lib/format";

/** Lead → company + primary contact (+ optional deal). */
export function ConvertLeadForm({ leadId, companyName, onDone, onCancel }: { leadId: number; companyName: string; onDone: (companyId: number) => void; onCancel: () => void }) {
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [createDeal, setCreateDeal] = useState(true);
  const [dealTitle, setDealTitle] = useState(`First order — ${companyName}`.slice(0, 140));
  const [dealValue, setDealValue] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const amount = dealValue ? parseAmount(dealValue) : null;

  return (
    <form
      className="ops-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        start(async () => {
          const res = await convertLeadAction(leadId, { industry, size, createDeal, dealTitle, dealValue });
          if (res.ok && "companyId" in res && typeof res.companyId === "number") onDone(res.companyId);
          else {
            setErrors(("errors" in res && res.errors) || {});
            setMessage(("message" in res && res.message) || "Please fix the highlighted fields.");
          }
        });
      }}
    >
      <p className="ops-hint">Creates the company “{companyName}” as a prospect with this lead as its primary contact.</p>
      <div className="ops-form-grid">
        <div className={`ops-field is-half${errors.industry ? " has-error" : ""}`}>
          <label htmlFor="cv-industry">Industry *</label>
          <select id="cv-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} aria-invalid={!!errors.industry || undefined}>
            <option value="">Select…</option>
            {INDUSTRY.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {errors.industry && <span className="ops-error">{errors.industry}</span>}
        </div>
        <div className={`ops-field is-half${errors.size ? " has-error" : ""}`}>
          <label htmlFor="cv-size">Size *</label>
          <select id="cv-size" value={size} onChange={(e) => setSize(e.target.value)} aria-invalid={!!errors.size || undefined}>
            <option value="">Select…</option>
            {SIZE.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {errors.size && <span className="ops-error">{errors.size}</span>}
        </div>
        <div className="ops-field">
          <label className="ops-form-check">
            <input type="checkbox" checked={createDeal} onChange={(e) => setCreateDeal(e.target.checked)} /> Also create a deal
          </label>
        </div>
        {createDeal && (
          <>
            <div className={`ops-field is-half${errors.dealTitle ? " has-error" : ""}`}>
              <label htmlFor="cv-title">Deal title *</label>
              <input id="cv-title" value={dealTitle} maxLength={140} onChange={(e) => setDealTitle(e.target.value)} />
              {errors.dealTitle && <span className="ops-error">{errors.dealTitle}</span>}
            </div>
            <div className={`ops-field is-half${errors.dealValue ? " has-error" : ""}`}>
              <label htmlFor="cv-value">Deal value (₹) *</label>
              <input id="cv-value" inputMode="decimal" placeholder="e.g. 5L" value={dealValue} onChange={(e) => setDealValue(e.target.value)} />
              {amount !== null && !errors.dealValue && <span className="ops-hint">{formatINR(amount)}</span>}
              {errors.dealValue && <span className="ops-error">{errors.dealValue}</span>}
            </div>
          </>
        )}
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
          {pending ? "Converting…" : "Convert"}
        </button>
      </div>
    </form>
  );
}
