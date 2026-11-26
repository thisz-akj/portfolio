"""PDF → pages, positioned words and clause-sized chunks; quote → highlight rectangles.

Chunks are what retrieval ranks and what answers cite. Every word keeps its box, so a cited quote can be
mapped back to exact rectangles on the page (returned as fractions of the page size for the viewer).
"""

from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher

import pdfplumber

FOOTER_ZONE = 48  # points from the bottom edge: running footers ("Page 2") are not content
CHUNK_TARGET = 420  # characters; short paragraphs (table rows, key-value lines) are merged up to this
CLAUSE_START = re.compile(r"^(\d+(\.\d+)+|\d+\.)\s")


class PdfError(ValueError):
    """Raised with a machine-readable code: not_pdf, encrypted, too_many_pages, no_text, unreadable."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass
class Word:
    text: str
    page: int
    x0: float
    top: float
    x1: float
    bottom: float
    bold: bool = False
    size: float = 0.0


@dataclass
class Page:
    number: int
    width: float
    height: float


@dataclass
class Chunk:
    id: str
    page: int
    section: str
    words: list[Word]

    @property
    def text(self) -> str:
        return " ".join(w.text for w in self.words)


@dataclass
class Parsed:
    sha: str
    pages: list[Page]
    chunks: list[Chunk]
    meta_title: str = ""

    @property
    def text(self) -> str:
        return "\n".join(c.text for c in self.chunks)

    def chunk(self, cid: str) -> Chunk | None:
        return next((c for c in self.chunks if c.id == cid), None)


@dataclass
class _Line:
    words: list[Word] = field(default_factory=list)

    @property
    def top(self) -> float:
        return min(w.top for w in self.words)

    @property
    def bottom(self) -> float:
        return max(w.bottom for w in self.words)

    @property
    def text(self) -> str:
        return " ".join(w.text for w in self.words)

    @property
    def bold(self) -> bool:
        return all(w.bold for w in self.words)

    @property
    def size(self) -> float:
        return max(w.size for w in self.words)


def page_count(data: bytes) -> int:
    if not data.startswith(b"%PDF"):
        raise PdfError("not_pdf", "That file isn't a PDF.")
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return len(pdf.pages)
    except Exception as err:  # noqa: BLE001 — pdfminer raises many types
        if "encrypt" in str(err).lower() or "password" in str(err).lower():
            raise PdfError("encrypted", "That PDF is password-protected.") from err
        raise PdfError("unreadable", "That PDF couldn't be read.") from err


def _lines(words: list[Word]) -> list[_Line]:
    lines: list[_Line] = []
    for w in sorted(words, key=lambda w: (round(w.top), w.x0)):
        if lines and abs(lines[-1].words[0].top - w.top) < 3:
            lines[-1].words.append(w)
        else:
            lines.append(_Line([w]))
    for line in lines:
        line.words.sort(key=lambda w: w.x0)
    return lines


def parse(data: bytes, max_pages: int | None = None) -> Parsed:
    n = page_count(data)
    if max_pages is not None and n > max_pages:
        raise PdfError("too_many_pages", f"The document has {n} pages; the limit is {max_pages}.")
    pages: list[Page] = []
    paragraphs: list[tuple[int, str, list[Word], bool]] = []  # (page, section, words, is_heading)
    section = ""
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        title = (pdf.metadata or {}).get("Title", "") or ""
        for pno, page in enumerate(pdf.pages, 1):
            pages.append(Page(pno, float(page.width), float(page.height)))
            raw = page.extract_words(keep_blank_chars=False, use_text_flow=False, extra_attrs=["fontname", "size"])
            words = [
                Word(w["text"], pno, float(w["x0"]), float(w["top"]), float(w["x1"]), float(w["bottom"]),
                     "bold" in str(w.get("fontname", "")).lower(), float(w.get("size", 0)))
                for w in raw
                if float(w["top"]) < float(page.height) - FOOTER_ZONE
            ]
            lines = _lines(words)
            sizes = sorted(w.size for w in words)
            body_size = sizes[len(sizes) // 2] if sizes else 10
            current: list[Word] = []
            prev: _Line | None = None
            for line in lines:
                height = line.bottom - line.top
                gap = line.top - prev.bottom if prev else 0
                # Headings: bold and larger than body text (bold table rows like "Grand total" stay content).
                heading = line.bold and len(line.text) < 80 and line.size >= body_size + 0.6
                starts_clause = bool(CLAUSE_START.match(line.text)) and not heading
                if current and (prev is None or gap > max(4.5, height * 0.45) or heading or starts_clause or prev.bold):
                    paragraphs.append((pno, section, current, False))
                    current = []
                if heading:
                    section = line.text
                    paragraphs.append((pno, section, list(line.words), True))
                    prev = line
                    continue
                current.extend(line.words)
                prev = line
            if current:
                paragraphs.append((pno, section, current, False))

    chunks: list[Chunk] = []
    for pno, sec, words, is_heading in paragraphs:
        if is_heading:
            continue  # headings live on as the chunk's section label
        text = " ".join(w.text for w in words)
        last = chunks[-1] if chunks else None
        mergeable = (
            last is not None and last.page == pno and last.section == sec
            and len(last.text) + len(text) < CHUNK_TARGET and not CLAUSE_START.match(text)
        )
        if mergeable:
            last.words.extend(words)
        else:
            chunks.append(Chunk(f"c{len(chunks) + 1}", pno, sec, list(words)))
    if not chunks or sum(len(c.text) for c in chunks) < 20:
        raise PdfError("no_text", "No readable text found — it looks like a scan.")
    return Parsed(hashlib.sha256(data).hexdigest()[:16], pages, chunks, title)


# --- quotes → highlights ---------------------------------------------------------------------

_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-"})


def norm_token(t: str) -> str:
    return re.sub(r"[^0-9a-z₹%]+", "", t.translate(_QUOTES).lower())


def _tokens(words: list[Word]) -> tuple[list[str], list[int]]:
    toks, idx = [], []
    for i, w in enumerate(words):
        t = norm_token(w.text)
        if t:
            toks.append(t)
            idx.append(i)
    return toks, idx


def _find_in(chunk: Chunk, q: list[str], fuzzy: bool) -> tuple[int, int, float] | None:
    toks, idx = _tokens(chunk.words)
    n = len(q)
    if n == 0 or n > len(toks):
        return None
    for s in range(len(toks) - n + 1):
        if toks[s : s + n] == q:
            return idx[s], idx[s + n - 1], 1.0
    if not fuzzy:
        return None
    best: tuple[int, int, float] | None = None
    for s in range(len(toks) - n + 1):
        ratio = SequenceMatcher(None, toks[s : s + n], q, autojunk=False).ratio()
        if ratio >= 0.86 and (best is None or ratio > best[2]):
            best = (idx[s], idx[s + n - 1], ratio)
    return best


@dataclass
class Match:
    chunk: Chunk
    words: list[Word]

    @property
    def text(self) -> str:
        return " ".join(w.text for w in self.words)


def find_quote(parsed: Parsed, quote: str, prefer: str | None = None) -> list[Match]:
    """Locates a (possibly elided "…") quote. Returns one Match per part, or [] if any part isn't in the document.

    Exact token match first (preferred chunk, then all chunks), then a strict fuzzy match that tolerates small
    differences such as a dropped word or different punctuation — anything looser counts as not found.
    """
    parts = [p for p in re.split(r"\.\.\.|…", quote) if p.strip()]
    order = sorted(parsed.chunks, key=lambda c: c.id != prefer)
    matches: list[Match] = []
    for part in parts:
        q = [t for t in (norm_token(x) for x in part.split()) if t]
        if len(q) < 1 or (len(parts) > 1 and len(q) < 2):
            continue
        hit = None
        for fuzzy in (False, True):
            for c in order:
                found = _find_in(c, q, fuzzy) if (not fuzzy or len(q) >= 5) else None
                if found:
                    hit = Match(c, c.words[found[0] : found[1] + 1])
                    break
            if hit:
                break
        if not hit:
            return []
        matches.append(hit)
    return matches


def rects(parsed: Parsed, words: list[Word], pad: float = 1.5) -> list[dict]:
    """Merges words on the same line into one rectangle; coordinates are fractions of the page size."""
    out: list[dict] = []
    for line in _lines(words):
        page = parsed.pages[line.words[0].page - 1]
        x0 = min(w.x0 for w in line.words) - pad
        x1 = max(w.x1 for w in line.words) + pad
        top, bottom = line.top - pad, line.bottom + pad
        out.append({
            "page": page.number,
            "x": round(x0 / page.width, 4), "y": round(top / page.height, 4),
            "w": round((x1 - x0) / page.width, 4), "h": round((bottom - top) / page.height, 4),
        })
    return out
