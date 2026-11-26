"""Documents: the built-in samples (parsed once at start) and visitor uploads (memory only, expire after a TTL)."""

from __future__ import annotations

import json
import secrets
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

from .checks import run_checks
from .extract import TYPE_LABELS, detect_type, extract_offline
from .pages import render_page
from .pdfdoc import Match, Parsed, find_quote, parse
from .search import Index


@dataclass
class Example:
    question: str
    answer: str | None  # None → the honest answer is "not in this document"
    quotes: list[list[Match]]  # one entry per supporting quote


@dataclass
class Document:
    id: str
    title: str
    type: str
    blurb: str
    source: str  # "sample" | "upload"
    data: bytes
    parsed: Parsed
    index: Index
    examples: list[Example] = field(default_factory=list)
    fields: dict = field(default_factory=dict)  # ground truth (samples only; never sent to the browser)
    expires: float | None = None
    extraction: dict | None = None
    checks: list[dict] = field(default_factory=list)
    _pages: dict[int, bytes] = field(default_factory=dict)

    def page_image(self, n: int) -> bytes:
        if n not in self._pages:
            self._pages[n] = render_page(self.data, n)
        return self._pages[n]

    def set_extraction(self, result: dict) -> None:
        self.extraction = result
        self.type = result["type"]
        self.checks = run_checks(self.parsed, result)

    def issues(self) -> dict:
        return {s: sum(c["severity"] == s for c in self.checks) for s in ("error", "warning")}

    def summary(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "type": self.type,
            "blurb": self.blurb,
            "source": self.source,
            "typeLabel": TYPE_LABELS.get(self.type, "Document"),
            "pages": len(self.parsed.pages),
            "examples": [e.question for e in self.examples],
            "issues": self.issues(),
        }

    def detail(self) -> dict:
        return {
            **self.summary(),
            "pageSizes": [{"n": p.number, "w": p.width, "h": p.height} for p in self.parsed.pages],
            "sections": sorted({c.section for c in self.parsed.chunks if c.section}, key=self._order),
        }

    def _order(self, section: str) -> int:
        return next(int(c.id[1:]) for c in self.parsed.chunks if c.section == section)


def _load_source(samples_dir: Path):
    # samples/source.py holds content + ground truth; import it from the configured samples folder.
    root = str(samples_dir.parent)
    if root not in sys.path:
        sys.path.insert(0, root)
    from samples.source import DOCUMENTS  # noqa: PLC0415

    return DOCUMENTS


def resolve_examples(parsed: Parsed, raw: list[dict], doc_id: str) -> list[Example]:
    out = []
    for ex in raw:
        quotes: list[list[Match]] = []
        for q in ex["quotes"]:
            found = find_quote(parsed, q)
            if not found:
                raise ValueError(f"{doc_id}: example quote not found in PDF: {q!r}")
            quotes.append(found)
        out.append(Example(ex["q"], ex["a"], quotes))
    return out


class Store:
    def __init__(self, samples_dir: Path, upload_ttl_s: int = 3600, max_uploads: int = 300):
        self._samples: dict[str, Document] = {}
        # Sample extractions are computed offline (scripts/extract_samples.py) and reused while the PDF is unchanged.
        pre_path = samples_dir / "extracted.json"
        pre = json.loads(pre_path.read_text(encoding="utf-8")) if pre_path.exists() else {}
        self.precomputed: dict[str, dict] = {}
        self._uploads: dict[str, Document] = {}
        self._ttl = upload_ttl_s
        self._max_uploads = max_uploads
        for meta in _load_source(samples_dir):
            data = (samples_dir / "pdf" / f"{meta['id']}.pdf").read_bytes()
            parsed = parse(data)
            self._samples[meta["id"]] = Document(
                id=meta["id"], title=meta["title"], type=meta["type"], blurb=meta["blurb"], source="sample",
                data=data, parsed=parsed, index=Index(parsed.chunks),
                examples=resolve_examples(parsed, meta.get("examples", []), meta["id"]), fields=meta.get("fields", {}),
            )
            hit = pre.get(meta["id"])
            if hit and hit.get("sha") == parsed.sha:
                self.precomputed[meta["id"]] = hit["result"]
            # Every consumer (API, evaluation, tests) sees samples with fields + checks — and so with derived facts.
            doc = self._samples[meta["id"]]
            doc.set_extraction(self.precomputed.get(meta["id"]) or extract_offline(parsed, doc.type))

    def samples(self) -> list[Document]:
        return list(self._samples.values())

    def get(self, doc_id: str) -> Document | None:
        if doc_id in self._samples:
            return self._samples[doc_id]
        doc = self._uploads.get(doc_id)
        if doc and doc.expires is not None and doc.expires < time.time():
            self._uploads.pop(doc_id, None)
            return None
        return doc

    def add_upload(self, data: bytes, filename: str, max_pages: int) -> Document:
        parsed = parse(data, max_pages=max_pages)  # raises PdfError with a code
        self._sweep()
        title = (parsed.meta_title or Path(filename or "document.pdf").stem).strip()[:80] or "Uploaded document"
        doc = Document(
            id="u-" + secrets.token_urlsafe(12), title=title, type=detect_type(parsed), blurb="Your upload — kept in memory, "
            "deleted automatically.", source="upload", data=data, parsed=parsed, index=Index(parsed.chunks),
            expires=time.time() + self._ttl,
        )
        self._uploads[doc.id] = doc
        return doc

    def uploads(self, ids: list[str]) -> list[Document]:
        return [d for d in (self.get(i) for i in ids if i.startswith("u-")) if d]

    def _sweep(self) -> None:
        now = time.time()
        for k in [k for k, d in self._uploads.items() if d.expires is not None and d.expires < now]:
            del self._uploads[k]
        while len(self._uploads) >= self._max_uploads:  # oldest first
            del self._uploads[next(iter(self._uploads))]
