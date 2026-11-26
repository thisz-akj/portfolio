"""Page images for the viewer (highlights are drawn over them as page-fraction boxes)."""

from __future__ import annotations

import io
import threading

import pypdfium2 as pdfium

_LOCK = threading.Lock()  # pdfium is not thread-safe; FastAPI runs sync endpoints on a thread pool

SCALE = 1.6  # A4 → ~952×1347 px: sharp on laptop screens, ~60–120 KB per page as WebP


def render_page(data: bytes, page: int, scale: float = SCALE) -> bytes:
    with _LOCK:
        return _render(data, page, scale)


def _render(data: bytes, page: int, scale: float) -> bytes:
    pdf = pdfium.PdfDocument(data)
    try:
        if not 1 <= page <= len(pdf):
            raise IndexError(page)
        img = pdf[page - 1].render(scale=scale).to_pil()
        buf = io.BytesIO()
        img.convert("RGB").save(buf, "WEBP", quality=82, method=4)
        return buf.getvalue()
    finally:
        pdf.close()
