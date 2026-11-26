"""DocDesk service: sample library, 1-page uploads (demo limit), grounded Q&A with highlightable citations.

Responses carry results only: answer text, citations with page boxes, timing. Never model names or prompts.
Run: env -u PYTHONPATH .venv/bin/uvicorn app.main:create_app --factory --port 8002   (from docintel/)
"""

from __future__ import annotations

import logging

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator

import json

from .ask import Asker, DailyBudget
from .compare import compare_contracts, compare_po_invoice
from .config import ROOT, Settings, get_settings
from .extract import SPECS, extract, extract_offline, values
from .llm import Completer, GroqCompleter
from .pdfdoc import PdfError
from .store import Document, Store

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


class Turn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=2000)


class AskRequest(BaseModel):
    question: str = Field(default="", max_length=500)
    history: list[Turn] = Field(default_factory=list, max_length=12)
    example: int | None = Field(default=None, ge=0, le=20)

    @field_validator("question")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


def create_app(settings: Settings | None = None, completer: Completer | None = None) -> FastAPI:
    settings = settings or get_settings()
    store = Store(settings.samples_dir, settings.upload_ttl_s)
    if completer is None and settings.live:
        completer = GroqCompleter(settings)
    asker = Asker(completer, DailyBudget(settings.daily_limit))
    app = FastAPI(title="DocDesk", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.store, app.state.asker = store, asker

    def check_token(x_docintel_token: str | None = Header(default=None)) -> None:
        if settings.token and x_docintel_token != settings.token:
            raise HTTPException(401, "unauthorised")

    def get_doc(doc_id: str) -> Document:
        doc = store.get(doc_id)
        if not doc:
            raise HTTPException(404, {"code": "not_found", "message": "That document isn't available (uploads expire)."})
        return doc

    @app.get("/health")
    def health() -> dict:
        return {"ok": True, "live": completer is not None, "samples": len(store.samples())}

    @app.get("/limits")
    def limits() -> dict:
        return {"uploadMaxPages": settings.upload_max_pages, "uploadMaxBytes": settings.upload_max_bytes,
                "uploadTtlMinutes": settings.upload_ttl_s // 60}

    @app.get("/documents", dependencies=[Depends(check_token)])
    def documents() -> dict:
        return {"documents": [d.summary() for d in store.samples()]}

    @app.get("/documents/{doc_id}", dependencies=[Depends(check_token)])
    def document(doc_id: str) -> dict:
        return get_doc(doc_id).detail()

    @app.get("/documents/{doc_id}/file", dependencies=[Depends(check_token)])
    def document_file(doc_id: str) -> Response:
        doc = get_doc(doc_id)
        cache = "public, max-age=86400" if doc.source == "sample" else "private, no-store"
        return Response(doc.data, media_type="application/pdf", headers={"Cache-Control": cache})

    @app.post("/documents", dependencies=[Depends(check_token)])
    async def upload(file: UploadFile = File(...)) -> dict:
        data = await file.read(settings.upload_max_bytes + 1)
        if len(data) > settings.upload_max_bytes:
            raise HTTPException(413, {"code": "too_large", "message": "That file is too large for the demo."})
        try:
            doc = store.add_upload(data, file.filename or "", settings.upload_max_pages)
        except PdfError as err:
            raise HTTPException(422, {"code": err.code, "message": str(err)}) from err
        # One extraction call per upload (the proxy limits uploads per visitor); rules-only past the daily budget.
        use_model = completer is not None and asker.budget.take()
        doc.set_extraction(await extract(doc.parsed, doc.type, completer, use_model=use_model))
        return doc.detail()

    @app.get("/documents/{doc_id}/pages/{n}", dependencies=[Depends(check_token)])
    def page_image(doc_id: str, n: int) -> Response:
        doc = get_doc(doc_id)
        if not 1 <= n <= len(doc.parsed.pages):
            raise HTTPException(404, {"code": "no_page", "message": "No such page."})
        cache = "public, max-age=86400" if doc.source == "sample" else "private, max-age=3600"
        return Response(doc.page_image(n), media_type="image/webp", headers={"Cache-Control": cache})

    @app.get("/documents/{doc_id}/extract", dependencies=[Depends(check_token)])
    def extraction(doc_id: str) -> dict:
        doc = get_doc(doc_id)
        if doc.extraction is None:
            doc.set_extraction(extract_offline(doc.parsed, doc.type))
        return {**doc.extraction, "checks": doc.checks}

    @app.get("/compare", dependencies=[Depends(check_token)])
    def compare(a: str, b: str) -> dict:
        da, db = get_doc(a), get_doc(b)
        if da.id == db.id:
            raise HTTPException(400, {"code": "same", "message": "Pick two different documents."})
        for d in (da, db):
            if d.extraction is None:
                d.set_extraction(extract_offline(d.parsed, d.type))
        ta, tb = da.type, db.type
        head = {"a": da.summary(), "b": db.summary()}
        if {ta, tb} <= {"contract", "lease", "policy"} and ta == tb:
            labels = {s.key: s.label for s in SPECS[ta]}
            return {**head, **compare_contracts(da.parsed, db.parsed, values(da.extraction), values(db.extraction), labels)}
        if {ta, tb} == {"purchase_order", "invoice"}:
            po, inv = (da, db) if ta == "purchase_order" else (db, da)
            res = compare_po_invoice(values(po.extraction), values(inv.extraction), po.extraction["lineItems"],
                                     inv.extraction["lineItems"])
            return {**head, "a": po.summary(), "b": inv.summary(), **res}
        raise HTTPException(400, {"code": "incompatible", "message": "These two can't be compared. Pick two versions "
                                  "of a contract, lease or policy, or a purchase order and its invoice."})

    @app.get("/review", dependencies=[Depends(check_token)])
    def review(uploads: str = "") -> dict:
        docs = [*store.samples(), *store.uploads([u for u in uploads.split(",") if u][:20])]
        items = []
        for d in docs:
            if d.extraction is None:
                d.set_extraction(extract_offline(d.parsed, d.type))
            for c in d.checks:
                if c["severity"] in {"error", "warning"}:
                    items.append({"doc": d.summary(), **c, "key": f"{d.id}:{c['id']}"})
            for f in d.extraction["fields"]:
                if f["confidence"] == "review":
                    items.append({"doc": d.summary(), "id": f"field-{f['key']}", "key": f"{d.id}:field-{f['key']}",
                                  "severity": "warning", "title": f"Check extracted value: {f['label']}",
                                  "detail": f"Read as “{f['display']}” but the supporting text didn't confirm it.",
                                  "source": f["source"]})
        order = {"error": 0, "warning": 1}
        items.sort(key=lambda i: order[i["severity"]])
        return {"items": items}

    @app.get("/quality")
    def quality() -> dict:
        path = ROOT / "quality" / "report.json"
        if not path.exists():
            return {"available": False}
        report = json.loads(path.read_text(encoding="utf-8"))
        report.pop("versions", None)  # internal bookkeeping — never sent to the browser
        return {"available": True, **report}

    @app.post("/documents/{doc_id}/ask", dependencies=[Depends(check_token)])
    async def ask(doc_id: str, req: AskRequest) -> dict:
        doc = get_doc(doc_id)
        if req.example is not None:
            if req.example >= len(doc.examples):
                raise HTTPException(400, {"code": "bad_example", "message": "Unknown example."})
            return {**asker.example(doc, req.example), "latencyMs": 0}
        if len(req.question) < 2:
            raise HTTPException(400, {"code": "empty", "message": "Ask a question about the document."})
        return await asker.ask(doc, req.question, [t.model_dump() for t in req.history])

    return app
