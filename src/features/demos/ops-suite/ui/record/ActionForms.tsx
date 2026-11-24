"use client";

import { useState } from "react";
import type { LinesBlock, RecordAction } from "../../data/detail-types";
import { PAYMENT_METHOD } from "../../entities/erp-options";
import { todayIST } from "../../filters/dates";
import { formatINR, parseAmount } from "../../lib/format";

const REASONS = ["Cycle count", "Damaged", "Found in stock", "Returned to supplier", "Other"];

/** Inputs for actions that need data first: record payment, receive goods, adjust stock. */
export function ActionForm({
  action,
  context = {},
  lines,
  pending,
  onSubmit,
  onCancel,
}: {
  action: RecordAction;
  context?: Record<string, string | number>;
  lines?: LinesBlock;
  pending: boolean;
  onSubmit: (input: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const balance = Number(context.balance ?? 0);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState("neft");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(todayIST());
  const [counted, setCounted] = useState(String(context.qtyOnHand ?? ""));
  const [reason, setReason] = useState("Cycle count");
  const remaining = (lines?.rows ?? []).map((r) => ({ id: r.id, sku: r.sku, name: r.name, left: r.qty - (r.qtyReceived ?? 0) }));
  const [receive, setReceive] = useState<Record<number, string>>(() => Object.fromEntries(remaining.map((r) => [r.id, String(r.left)])));

  const parsed = parseAmount(amount);
  let body: React.ReactNode = null;
  let payload: Record<string, unknown> | null = null;

  if (action.input === "payment") {
    payload = parsed !== null && parsed > 0 && parsed <= balance ? { amount: parsed, method, reference, paidOn } : null;
    body = (
      <div className="ops-form-grid">
        <div className="ops-field is-half">
          <label htmlFor="pay-amount">Amount (₹)</label>
          <input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className={parsed !== null && parsed > balance ? "ops-error" : "ops-hint"}>
            {parsed === null ? "Enter an amount" : parsed > balance ? `More than the balance (${formatINR(balance, { paise: true })})` : `${formatINR(parsed, { paise: true })} of ${formatINR(balance, { paise: true })} due`}
          </span>
        </div>
        <div className="ops-field is-half">
          <label htmlFor="pay-date">Received on</label>
          <input id="pay-date" type="date" value={paidOn} min={String(context.issueDate ?? "")} max={todayIST()} onChange={(e) => setPaidOn(e.target.value)} />
        </div>
        <div className="ops-field is-half">
          <label htmlFor="pay-method">Method</label>
          <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHOD.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ops-field is-half">
          <label htmlFor="pay-ref">Reference (UTR / cheque no.)</label>
          <input id="pay-ref" value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} />
        </div>
      </div>
    );
  } else if (action.input === "receive") {
    const rows = remaining.filter((r) => r.left > 0);
    const valid = rows.every((r) => /^\d+$/.test(receive[r.id] ?? "0") && Number(receive[r.id]) <= r.left) && rows.some((r) => Number(receive[r.id]) > 0);
    payload = valid ? { lines: rows.map((r) => ({ lineId: r.id, qty: Number(receive[r.id] || 0) })) } : null;
    body = (
      <ul className="ops-receive">
        {rows.map((r) => (
          <li key={r.id}>
            <label htmlFor={`rcv-${r.id}`}>
              <span className="ops-primary">{r.sku}</span> {r.name}
            </label>
            <input id={`rcv-${r.id}`} className="ops-num" inputMode="numeric" value={receive[r.id] ?? ""} onChange={(e) => setReceive({ ...receive, [r.id]: e.target.value })} />
            <span className="ops-hint">of {r.left}</span>
          </li>
        ))}
      </ul>
    );
  } else if (action.input === "adjust") {
    payload = /^\d+$/.test(counted) && Number(counted) !== Number(context.qtyOnHand) ? { counted: Number(counted), reason } : null;
    body = (
      <div className="ops-form-grid">
        <div className="ops-field is-half">
          <label htmlFor="adj-qty">Counted quantity</label>
          <input id="adj-qty" inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value)} />
          <span className="ops-hint">Currently {context.qtyOnHand} on hand</span>
        </div>
        <div className="ops-field is-half">
          <label htmlFor="adj-reason">Reason</label>
          <select id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <form
      className="ops-form ops-action-form"
      aria-label={action.label}
      onSubmit={(e) => {
        e.preventDefault();
        if (payload) onSubmit(payload);
      }}
    >
      {body}
      <div className="ops-form-actions">
        <button type="button" className="ops-btn is-ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className="ops-btn is-primary" disabled={!payload || pending}>
          {pending ? "Working…" : action.label}
        </button>
      </div>
    </form>
  );
}
