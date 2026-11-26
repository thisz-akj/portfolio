import asyncio
import json

import pytest

from app.checks import gstin_valid, run_checks
from app.compare import compare_po_invoice
from app.extract import extract, extract_offline, normalise, parse_date, parse_money, values
from app.store import Store
from samples.source import DOCUMENTS
from tests.conftest import ROOT, FakeCompleter, make_pdf
from app.pdfdoc import parse

STORE = Store(ROOT / "samples")
TRUTH = {d["id"]: d for d in DOCUMENTS}


def test_normalisers():
    assert parse_date("12 October 2026") == "2026-10-12"
    assert parse_date("05/11/2026") == "2026-11-05"  # dd/mm/yyyy
    assert parse_money("INR 4,50,000 (Indian Rupees)") == 450000
    assert parse_money("₹1.85 lakh") == 185000
    assert normalise("int", "sixty (60) days") == 60
    assert normalise("bool", "Yes") is True
    assert normalise("text", "") is None


@pytest.mark.parametrize("doc_id", ["invoice-northwind-0418", "invoice-kaveri-1187", "po-saffron-0932"])
def test_rules_read_invoices_and_pos_without_a_model(doc_id):
    d = STORE.get(doc_id)
    res = extract_offline(d.parsed, None)
    assert res["type"] == TRUTH[doc_id]["type"]
    got = values(res)
    for key, truth in TRUTH[doc_id]["fields"].items():
        if key == "line_items" or truth in (0, None) or key not in got or got[key] is None:
            continue
        assert got[key] == truth, key
    items = [(i["description"], i["qty"], i["rate"], i["amount"]) for i in res["lineItems"]]
    assert items == [(x["description"], x["qty"], x["rate"], x["amount"]) for x in TRUTH[doc_id]["fields"]["line_items"]]
    assert all(i["source"] for i in res["lineItems"])


def test_planted_invoice_errors_are_caught():
    d = STORE.get("invoice-kaveri-1187")
    checks = run_checks(d.parsed, extract_offline(d.parsed, None))
    errors = [c for c in checks if c["severity"] == "error"]
    assert [c["id"] for c in errors] == ["total"]
    assert "₹270" in errors[0]["detail"] and errors[0]["source"]["rects"]
    clean = STORE.get("invoice-northwind-0418")
    assert not [c for c in run_checks(clean.parsed, extract_offline(clean.parsed, None)) if c["severity"] == "error"]


def test_gstin_check_digit():
    assert gstin_valid(TRUTH["invoice-northwind-0418"]["fields"]["supplier_gstin"])
    bad = TRUTH["invoice-northwind-0418"]["fields"]["supplier_gstin"][:-1] + "0"
    assert not gstin_valid(bad) or bad == TRUTH["invoice-northwind-0418"]["fields"]["supplier_gstin"]


def test_po_vs_invoice_mismatches():
    po, inv = STORE.get("po-saffron-0932"), STORE.get("invoice-kaveri-1187")
    xp, xi = extract_offline(po.parsed, None), extract_offline(inv.parsed, None)
    r = compare_po_invoice(values(xp), values(xi), xp["lineItems"], xi["lineItems"])
    issues = {l["description"]: l["issues"] for l in r["lines"]}
    assert issues["Pressure cooker, 5 litre"] == ["Qty 72 invoiced vs 60 ordered — over-billed"]
    assert issues["Non-stick fry pan, 24 cm"] == ["Rate ₹745 vs ₹720 agreed"]
    assert issues["Cast iron tawa, 12 inch"] == []
    assert {h["label"]: h["status"] for h in r["header"]}["Payment terms"] == "mismatch"
    assert r["overBilled"] == 22200 + 2500


def test_model_fields_need_a_matching_quote_and_mixups_are_flagged():
    pdf = make_pdf([["TAX INVOICE", "Invoice No: ACME/26/0091", "Bill to: Test Traders Pvt Ltd", "Grand total: 59,000.00"]])
    parsed = parse(pdf)
    fake = FakeCompleter({
        "invoice_date": {"value": "", "quote": ""},
        "due_date": {"value": "30 Nov 2026", "quote": "payment due 30 November 2026"},  # quote not in doc
        "po_number": {"value": "ACME/26/0091", "quote": "Invoice No: ACME/26/0091"},  # mix-up
        "supplier_name": {"value": "", "quote": ""},
        "buyer_name": {"value": "Test Traders Pvt Ltd", "quote": "Bill to: Test Traders Pvt Ltd"},
    })
    res = asyncio.run(extract(parsed, "invoice", fake))
    f = {x["key"]: x for x in res["fields"]}
    assert f["invoice_number"]["confidence"] == "high"
    assert f["buyer_name"]["confidence"] == "high" and f["buyer_name"]["source"]["rects"]
    assert f["due_date"]["confidence"] == "review" and f["due_date"]["source"] is None
    assert f["po_number"]["confidence"] == "review"
    assert f["invoice_date"]["confidence"] == "missing"


def test_precomputed_sample_extractions_are_current():
    pre = json.loads((ROOT / "samples" / "extracted.json").read_text(encoding="utf-8"))
    for d in STORE.samples():
        assert pre[d.id]["sha"] == d.parsed.sha, f"re-run scripts.extract_samples for {d.id}"
        assert pre[d.id]["result"]["complete"]
