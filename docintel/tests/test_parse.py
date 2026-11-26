from app.pdfdoc import PdfError, find_quote, parse, rects
from tests.conftest import ROOT, make_pdf

import pytest

from samples.source import DOCUMENTS


def load(doc_id: str):
    return parse((ROOT / "samples" / "pdf" / f"{doc_id}.pdf").read_bytes())


def test_every_sample_parses_into_clause_chunks():
    for meta in DOCUMENTS:
        p = load(meta["id"])
        assert p.chunks, meta["id"]
        assert all(c.text.strip() for c in p.chunks)
        assert not any("Synthetic sample — fictional parties" in c.text for c in p.chunks), "footer leaked into text"


def test_clauses_start_their_own_chunk_with_section_label():
    p = load("msa-kestrel-v1")
    c = next(c for c in p.chunks if c.text.startswith("11.2"))
    assert c.section == "11. Termination" and c.page == 2
    assert "sixty (60) days' written notice" in c.text


def test_bold_table_rows_stay_content():
    p = load("invoice-kaveri-1187")
    assert find_quote(p, "Grand total 3,58,636.00")


def test_find_quote_exact_fuzzy_and_elided():
    p = load("msa-kestrel-v1")
    assert find_quote(p, "renews automatically for successive twelve (12) month terms")
    # curly quotes / punctuation differences are tolerated
    assert find_quote(p, "upon sixty (60) days’ written notice to the other Party")
    # one dropped word in a long quote is tolerated, an invented clause is not
    assert find_quote(p, "Each Party's total liability arising out of or in connection with this Agreement shall not exceed")
    assert not find_quote(p, "either party may terminate immediately without any notice whatsoever")
    parts = find_quote(p, "The Provider shall invoice monthly in advance … payable within thirty (30) days")
    assert len(parts) == 2


def test_rects_are_page_fractions():
    p = load("msa-kestrel-v1")
    [m] = find_quote(p, "Late payments carry interest at one and a half percent (1.5%) per month")
    rs = rects(p, m.words)
    assert rs and all(0 <= r["x"] < 1 and 0 <= r["y"] < 1 and 0 < r["w"] <= 1 and 0 < r["h"] < 0.1 for r in rs)


def test_page_limit_and_bad_files():
    two = make_pdf([["Invoice No. 1", "Total 100"], ["Page two text"]])
    with pytest.raises(PdfError) as e:
        parse(two, max_pages=1)
    assert e.value.code == "too_many_pages"
    with pytest.raises(PdfError) as e:
        parse(b"hello world")
    assert e.value.code == "not_pdf"
    with pytest.raises(PdfError) as e:
        parse(make_pdf([[]]))
    assert e.value.code == "no_text"
