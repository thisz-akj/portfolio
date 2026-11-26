"""Deterministic checks on extracted values — arithmetic, GST rules, dates and contract/lease terms.

No model involved: a check is either provably right or wrong from the document's own numbers.
Severity: error (wrong / inconsistent), warning (needs attention), info (useful derived fact), pass.
"""

from __future__ import annotations

import re
from datetime import date, timedelta

from .extract import fmt_inr
from .pdfdoc import Parsed, find_quote, rects

ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
STATE_CODES = {"27": "Maharashtra", "29": "Karnataka", "33": "Tamil Nadu", "36": "Telangana", "07": "Delhi",
               "24": "Gujarat", "32": "Kerala", "06": "Haryana", "09": "Uttar Pradesh", "19": "West Bengal"}


def gstin_valid(g: str) -> bool:
    if not re.fullmatch(r"\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]", g or ""):
        return False
    total = 0
    for i, ch in enumerate(g[:14]):
        p = ALPHABET.index(ch) * (1 if i % 2 == 0 else 2)
        total += p // 36 + p % 36
    return g[14] == ALPHABET[(36 - total % 36) % 36]


def rupees(n: float) -> str:
    return f"₹{fmt_inr(round(n))}"


def _add_months(d: date, months: int) -> date:
    y, m = divmod(d.month - 1 + months, 12)
    year, month = d.year + y, m + 1
    for day in (d.day, 30, 29, 28):
        try:
            return date(year, month, day)
        except ValueError:
            continue
    raise ValueError("bad date")


class Checks:
    def __init__(self, parsed: Parsed, fields: dict[str, dict], items: list[dict]):
        self.parsed, self.f, self.items = parsed, fields, items
        self.out: list[dict] = []

    def v(self, key: str):
        f = self.f.get(key)
        return f["value"] if f else None

    def src(self, key: str) -> dict | None:
        f = self.f.get(key)
        return f.get("source") if f else None

    def add(self, cid: str, severity: str, title: str, detail: str, source: dict | None = None, quote: str | None = None):
        if quote and not source:
            found = find_quote(self.parsed, quote)
            if found:
                words = [w for m in found for w in m.words]
                source = {"quote": " … ".join(m.text for m in found), "page": found[0].chunk.page,
                          "rects": rects(self.parsed, words)}
        self.out.append({"id": cid, "severity": severity, "title": title, "detail": detail, "source": source})

    # -- invoices & purchase orders -----------------------------------------------------------
    def money_doc(self, kind: str) -> None:
        bad = []
        for it in self.items:
            if it["qty"] and it["rate"] is not None and it["amount"] is not None and abs(it["qty"] * it["rate"] - it["amount"]) > 1:
                bad.append(it)
                self.add(f"line-{len(bad)}", "error", "Line amount doesn't match qty × rate",
                         f"{it['description']}: {it['qty']} × {rupees(it['rate'])} = {rupees(it['qty'] * it['rate'])}, "
                         f"printed {rupees(it['amount'])}.", it.get("source"))
        if self.items and not bad:
            self.add("lines", "pass", "Every line: qty × rate = amount", f"{len(self.items)} lines checked.")

        taxable = self.v("taxable_value")
        if self.items and taxable is not None:
            s = sum(it["amount"] or 0 for it in self.items)
            if abs(s - taxable) > 1:
                self.add("subtotal", "error", "Line items don't add up to the taxable value",
                         f"Lines total {rupees(s)}; taxable value printed {rupees(taxable)}.", self.src("taxable_value"))
            else:
                self.add("subtotal", "pass", "Line items add up to the taxable value", rupees(s))

        text = self.parsed.text
        taxes = 0
        for key, label in (("cgst", "CGST"), ("sgst", "SGST"), ("igst", "IGST")):
            amt = self.v(key)
            if amt is None:
                continue
            taxes += amt
            m = re.search(label + r"\s*@\s*([\d.]+)\s*%", text)
            if m and taxable is not None:
                expected = round(taxable * float(m.group(1)) / 100)
                if abs(expected - amt) > 1:
                    self.add(f"{key}-rate", "error", f"{label} doesn't match its rate",
                             f"{m.group(1)}% of {rupees(taxable)} = {rupees(expected)}; printed {rupees(amt)}.", self.src(key))
        total = self.v("total")
        if total is not None and taxable is not None:
            expected = taxable + taxes
            if abs(expected - total) > 1:
                self.add("total", "error", "Grand total doesn't add up",
                         f"Taxable value + tax = {rupees(expected)}, but the grand total is printed as {rupees(total)} "
                         f"(off by {rupees(abs(total - expected))}).", self.src("total"))
            else:
                self.add("total", "pass", "Grand total = taxable value + tax", rupees(total))

        # GST type: same state → CGST + SGST; different state → IGST.
        seller = self.v("supplier_gstin") if kind == "invoice" else self.v("vendor_gstin")
        pos = self.v("place_of_supply") or ""
        pos_code = (re.search(r"\((\d{2})\)", pos) or [None, None])[1]
        if kind == "purchase_order" and not pos_code and self.v("buyer_gstin"):
            pos_code = self.v("buyer_gstin")[:2]
        if seller and pos_code:
            intra = seller[:2] == pos_code
            has_igst, has_split = self.v("igst") is not None, self.v("cgst") is not None or self.v("sgst") is not None
            place = STATE_CODES.get(pos_code, pos_code)
            if intra and has_igst:
                self.add("gst-type", "error", "IGST charged on an intra-state supply",
                         f"Supplier and place of supply are both in {place}; expected CGST + SGST.", self.src("igst"))
            elif not intra and has_split:
                self.add("gst-type", "error", "CGST/SGST charged on an inter-state supply",
                         f"Supplier is in {STATE_CODES.get(seller[:2], seller[:2])}, supply to {place}; expected IGST.",
                         self.src("cgst"))
            elif has_igst or has_split:
                self.add("gst-type", "pass", "Correct GST type for the place of supply",
                         f"{'Intra' if intra else 'Inter'}-state supply → {'CGST + SGST' if intra else 'IGST'}.")

        for key in ("supplier_gstin", "buyer_gstin", "vendor_gstin"):
            g = self.v(key)
            if g:
                label = self.f[key]["label"]
                if gstin_valid(g):
                    self.add(f"{key}-valid", "pass", f"{label} is well-formed", f"{g} — check digit OK.")
                else:
                    self.add(f"{key}-valid", "error", f"{label} fails validation",
                             f"{g} — the check digit doesn't match. Verify it on the GST portal.", self.src(key))

        d1, d2 = self.v("invoice_date"), self.v("due_date")
        if d1 and d2 and d2 < d1:
            self.add("due-date", "error", "Due date is before the invoice date", f"{d2} < {d1}.", self.src("due_date"))
        if kind == "invoice" and d1 and not d2 and self.v("payment_terms_days"):
            due = date.fromisoformat(d1) + timedelta(days=self.v("payment_terms_days"))
            self.add("due-derived", "info", "Payment due", f"{due.strftime('%-d %b %Y')} (invoice date + "
                     f"{self.v('payment_terms_days')} days).", self.src("payment_terms_days"))

    # -- contracts ---------------------------------------------------------------------------
    def contract(self) -> None:
        start, term = self.v("effective_date"), self.v("initial_term_months")
        if start and term:
            end = _add_months(date.fromisoformat(start), term) - timedelta(days=1)
            notice = self.v("renewal_notice_days")
            if self.v("auto_renewal") and notice:
                by = end - timedelta(days=notice)
                self.add("renewal", "warning", "Auto-renews — diary the notice date",
                         f"Initial term ends {end.strftime('%-d %b %Y')}. To stop renewal, send notice by "
                         f"{by.strftime('%-d %b %Y')} ({notice} days before).", self.src("renewal_notice_days"))
            else:
                self.add("term-end", "info", "Term ends", end.strftime("%-d %b %Y"), self.src("initial_term_months"))
        cap = self.v("liability_cap") or ""
        m = re.search(r"(\d+)\s*months?", cap) or re.search(r"\((\d+)\)\s*months", cap)
        if m and int(m.group(1)) < 12:
            self.add("cap", "warning", "Low liability cap",
                     f"Liability is capped at fees paid in the preceding {m.group(1)} months — below the common 12-month benchmark.",
                     self.src("liability_cap"))
        elif cap:
            self.add("cap", "pass", "Liability cap present", cap, self.src("liability_cap"))
        pay = self.v("payment_terms_days")
        if pay and pay > 30:
            self.add("payment", "info", f"Payment terms: {pay} days", "Longer than the usual 30 days.", self.src("payment_terms_days"))
        hrs = self.v("breach_notification_hours")
        if hrs:
            self.add("breach", "info", f"Data-breach notice within {hrs} hours", "Check it fits your incident process.",
                     self.src("breach_notification_hours"))

    # -- leases ------------------------------------------------------------------------------
    def lease(self) -> None:
        rent, esc, term = self.v("monthly_rent_inr"), self.v("escalation_percent"), self.v("term_months")
        if rent and esc and term:
            years = max(1, term // 12)
            sched = [round(rent * (1 + esc / 100) ** y) for y in range(years)]
            total = sum(r * 12 for r in sched)
            self.add("schedule", "info", "Rent over the full term",
                     " · ".join(f"Y{i + 1} {rupees(r)}" for i, r in enumerate(sched)) + f" — {rupees(total)} in total.",
                     self.src("escalation_percent"))
        dep = self.v("security_deposit_inr")
        if rent and dep:
            months = dep / rent
            sev = "warning" if months > 6 else "pass"
            self.add("deposit", sev, f"Deposit = {months:g} months' rent",
                     "Above the usual 6 months for Bengaluru offices." if sev == "warning" else rupees(dep),
                     self.src("security_deposit_inr"))
        lock = self.v("lock_in_months")
        if rent and lock:
            self.add("lock-in", "warning", f"{lock}-month lock-in",
                     f"Leaving in month 1 would cost up to {rupees(rent * lock)} in rent for the rest of the lock-in.",
                     self.src("lock_in_months"))

    def run(self, doc_type: str) -> list[dict]:
        if doc_type in {"invoice", "purchase_order"}:
            self.money_doc(doc_type)
        elif doc_type == "contract":
            self.contract()
        elif doc_type == "lease":
            self.lease()
        order = {"error": 0, "warning": 1, "info": 2, "pass": 3}
        return sorted(self.out, key=lambda c: order[c["severity"]])


def run_checks(parsed: Parsed, extraction: dict) -> list[dict]:
    fields = {f["key"]: f for f in extraction["fields"]}
    return Checks(parsed, fields, extraction["lineItems"]).run(extraction["type"])
