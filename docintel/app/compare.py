"""Compare two documents — rules only, no model.

contract ↔ contract: clause-by-clause redline (aligned by clause number, then heading) + key-term table.
purchase order ↔ invoice: line-by-line match on description, plus header terms and totals.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher

from .checks import rupees
from .pdfdoc import Chunk, Parsed, rects

CLAUSE = re.compile(r"^(\d+\.\d+)\s")


def _heading(section: str) -> str:
    return re.sub(r"^\d+\.\s*", "", section).strip().lower()


def _keyed(chunks: list[Chunk]) -> dict[str, Chunk]:
    out: dict[str, Chunk] = {}
    counters: dict[str, int] = {}
    for c in chunks:
        m = CLAUSE.match(c.text)
        if m:
            key = f"{_heading(c.section)}|{m.group(1).split('.')[1]}"  # heading + sub-number survives renumbering
        else:
            h = _heading(c.section)
            counters[h] = counters.get(h, 0) + 1
            key = f"{h}|#{counters[h]}"
        out[key] = c
    return out


def _norm(w: str) -> str:
    return re.sub(r"[^0-9a-z₹%]+", "", w.lower())


def _diff(pa: Parsed, a: Chunk, pb: Parsed, b: Chunk) -> dict | None:
    wa, wb = a.words, b.words
    sm = SequenceMatcher(None, [_norm(w.text) for w in wa], [_norm(w.text) for w in wb], autojunk=False)
    if sm.ratio() == 1.0:
        return None
    ops, del_words, ins_words = [], [], []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            ops.append(["=", " ".join(w.text for w in wa[i1:i2])])
            continue
        if i2 > i1:
            ops.append(["-", " ".join(w.text for w in wa[i1:i2])])
            del_words += wa[i1:i2]
        if j2 > j1:
            ops.append(["+", " ".join(w.text for w in wb[j1:j2])])
            ins_words += wb[j1:j2]
    return {"ops": ops, "a": {"page": a.page, "rects": rects(pa, del_words)}, "b": {"page": b.page, "rects": rects(pb, ins_words)}}


def compare_contracts(pa: Parsed, pb: Parsed, fa: dict, fb: dict, labels: dict[str, str]) -> dict:
    ka, kb = _keyed(pa.chunks), _keyed(pb.chunks)
    changes = []
    for key in list(dict.fromkeys([*ka, *kb])):
        a, b = ka.get(key), kb.get(key)
        section = (b or a).section
        clause = (CLAUSE.match((b or a).text) or [None, ""])[1]
        if a and b:
            d = _diff(pa, a, pb, b)
            if d:
                changes.append({"kind": "changed", "section": section, "clause": clause, **d})
        elif b:
            changes.append({"kind": "added", "section": section, "clause": clause, "ops": [["+", b.text]],
                            "a": None, "b": {"page": b.page, "rects": rects(pb, b.words)}})
        elif a:
            changes.append({"kind": "removed", "section": section, "clause": clause, "ops": [["-", a.text]],
                            "a": {"page": a.page, "rects": rects(pa, a.words)}, "b": None})
    terms = []
    for key, label in labels.items():
        va, vb = fa.get(key), fb.get(key)
        if va is None and vb is None:
            continue
        terms.append({"key": key, "label": label, "a": _show(va), "b": _show(vb), "same": va == vb})
    return {"mode": "contracts", "changes": changes, "terms": terms,
            "summary": f"{len(changes)} clause change{'s' if len(changes) != 1 else ''}, "
                       f"{sum(not t['same'] for t in terms)} key term{'s' if sum(not t['same'] for t in terms) != 1 else ''} differ."}


def _show(v) -> str:
    if v is None:
        return "—"
    if isinstance(v, bool):
        return "Yes" if v else "No"
    if isinstance(v, list):
        return " · ".join(map(str, v))
    return str(v)


def _desc(s: str) -> str:
    return " ".join(sorted(re.findall(r"[a-z0-9]+", s.lower())))


def compare_po_invoice(po: dict, inv: dict, po_items: list[dict], inv_items: list[dict]) -> dict:
    """po / inv are {key: value} field maps. Items carry their own highlight sources."""
    rows = []
    used = set()
    for p in po_items:
        best, score = None, 0.0
        for i, it in enumerate(inv_items):
            if i in used:
                continue
            r = SequenceMatcher(None, _desc(p["description"]), _desc(it["description"])).ratio()
            if r > score:
                best, score = i, r
        it = inv_items[best] if best is not None and score >= 0.6 else None
        if it is not None:
            used.add(best)
        issues = []
        if it is None:
            issues.append("Not invoiced")
        else:
            if it["qty"] != p["qty"]:
                issues.append(f"Qty {it['qty']} invoiced vs {p['qty']} ordered" + (" — over-billed" if it["qty"] > p["qty"] else ""))
            if it["rate"] != p["rate"]:
                issues.append(f"Rate {rupees(it['rate'])} vs {rupees(p['rate'])} agreed")
        rows.append({"description": p["description"], "po": _line(p), "invoice": _line(it) if it else None,
                     "status": "mismatch" if issues else "match", "issues": issues,
                     "poSource": p.get("source"), "invoiceSource": it.get("source") if it else None,
                     "impact": (it["amount"] - p["amount"]) if it else -p["amount"]})
    for i, it in enumerate(inv_items):
        if i not in used:
            rows.append({"description": it["description"], "po": None, "invoice": _line(it), "status": "mismatch",
                         "issues": ["Not on the purchase order"], "poSource": None, "invoiceSource": it.get("source"),
                         "impact": it["amount"]})

    header = []

    def term(label, a, b, fmt=str):
        if a is None and b is None:
            return
        header.append({"label": label, "po": fmt(a) if a is not None else "—", "invoice": fmt(b) if b is not None else "—",
                       "status": "match" if a == b else "mismatch"})

    term("PO number", po.get("po_number"), inv.get("po_number"))
    term("Buyer GSTIN", po.get("buyer_gstin"), inv.get("buyer_gstin"))
    term("Vendor GSTIN", po.get("vendor_gstin"), inv.get("supplier_gstin"))
    term("Payment terms", po.get("payment_terms_days"), inv.get("payment_terms_days"), lambda d: f"Net {d} days")
    term("Taxable value", po.get("taxable_value"), inv.get("taxable_value"), rupees)
    term("Grand total", po.get("total"), inv.get("total"), rupees)

    over = sum(r["impact"] for r in rows if r["status"] == "mismatch" and r["impact"] > 0)
    bad = sum(r["status"] == "mismatch" for r in rows) + sum(h["status"] == "mismatch" for h in header if h["label"] not in {"Taxable value", "Grand total"})
    verdict = "Matches the purchase order" if bad == 0 else f"{bad} mismatch{'es' if bad != 1 else ''} — hold payment for review"
    return {"mode": "po_invoice", "lines": rows, "header": header, "summary": verdict,
            "overBilled": over, "overBilledDisplay": rupees(over) if over else None}


def _line(it: dict | None) -> dict | None:
    if not it:
        return None
    return {"qty": it["qty"], "rate": it["rate"], "amount": it["amount"],
            "display": f"{it['qty']} × {rupees(it['rate'])} = {rupees(it['amount'])}"}
