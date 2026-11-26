from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import FakeCompleter, make_pdf

FORBIDDEN = ("groq", "gpt", "qwen", "llama", "claude", "gemini", "prompt", "bm25", "model")


def client(settings, completer=None):
    return TestClient(create_app(settings, completer))


def test_library_detail_file_and_examples(settings):
    c = client(settings)
    docs = c.get("/documents").json()["documents"]
    assert len(docs) == 8 and all(d["examples"] for d in docs)
    d = c.get("/documents/msa-kestrel-v1").json()
    assert d["pages"] >= 2 and d["pageSizes"][0]["w"] > 500 and "11. Termination" in d["sections"]
    f = c.get("/documents/msa-kestrel-v1/file")
    assert f.headers["content-type"] == "application/pdf" and f.content.startswith(b"%PDF")
    ex = c.post("/documents/msa-kestrel-v1/ask", json={"example": 0}).json()
    assert ex["mode"] == "example" and ex["citations"][0]["rects"]
    assert c.get("/documents/nope").status_code == 404


def test_upload_one_page_then_ask(settings):
    fake = FakeCompleter({"found": True, "answer": "₹12,500 [1].",
                          "citations": [{"chunk": "c1", "quote": "Total payable: INR 12,500"}]})
    c = client(settings, fake)
    pdf = make_pdf([["Invoice No. ACME-77", "Bill to: Test Traders", "Total payable: INR 12,500", "Due: 30 days"]])
    up = c.post("/documents", files={"file": ("acme.pdf", pdf, "application/pdf")})
    assert up.status_code == 200, up.text
    doc = up.json()
    assert doc["id"].startswith("u-") and doc["source"] == "upload" and doc["pages"] == 1
    res = c.post(f"/documents/{doc['id']}/ask", json={"question": "What is the total?"}).json()
    assert res["mode"] == "answer" and res["citations"][0]["page"] == 1


def test_upload_rejections(settings):
    c = client(settings)
    two = make_pdf([["page one"], ["page two"]])
    r = c.post("/documents", files={"file": ("two.pdf", two, "application/pdf")})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "too_many_pages"
    r = c.post("/documents", files={"file": ("x.pdf", b"not a pdf", "application/pdf")})
    assert r.json()["detail"]["code"] == "not_pdf"


def test_token_required_when_configured(settings):
    from dataclasses import replace
    c = client(replace(settings, token="s3cret"))
    assert c.get("/documents").status_code == 401
    assert c.get("/documents", headers={"x-docintel-token": "s3cret"}).status_code == 200


def test_responses_never_reveal_internals(settings):
    fake = FakeCompleter({"found": True, "answer": "60 days [1].",
                          "citations": [{"chunk": "c24", "quote": "upon sixty (60) days' written notice"}]})
    c = client(settings, fake)
    body = c.post("/documents/msa-kestrel-v1/ask", json={"question": "notice?"}).text.lower()
    keys = c.post("/documents/msa-kestrel-v1/ask", json={"question": "notice?"}).json().keys()
    assert not any(w in " ".join(keys).lower() for w in FORBIDDEN)
    assert "groq" not in body and "gpt" not in body
