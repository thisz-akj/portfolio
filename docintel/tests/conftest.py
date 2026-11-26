import io
from pathlib import Path

import pytest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.config import Settings

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture
def settings() -> Settings:
    return Settings(groq_key="", models=(), daily_limit=5, token="", upload_max_pages=1,
                    upload_max_bytes=2 * 1024 * 1024, upload_ttl_s=3600, samples_dir=ROOT / "samples")


def make_pdf(pages: list[list[str]]) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4, invariant=1)
    for lines in pages:
        y = 780
        for line in lines:
            c.drawString(60, y, line)
            y -= 16
        c.showPage()
    c.save()
    return buf.getvalue()


class FakeCompleter:
    """`reply` is returned for every call; `by_name` overrides it per call kind ("route", "answer", "fields")."""

    def __init__(self, reply: dict | Exception, by_name: dict | None = None):
        self.reply, self.by_name, self.calls, self.prompts, self.names = reply, by_name or {}, 0, [], []

    async def complete(self, system, user, schema, name, max_tokens):
        self.calls += 1
        self.prompts.append(user)
        self.names.append(name)
        reply = self.by_name.get(name, self.reply)
        if isinstance(reply, Exception):
            raise reply
        return reply
