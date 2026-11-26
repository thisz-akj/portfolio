"""Renders the synthetic sample documents in samples/source.py to samples/pdf/<id>.pdf.

Deterministic (fixed metadata, no timestamps), so re-running only changes files whose content changed.
Run: env -u PYTHONPATH .venv/bin/python -m scripts.build_samples   (from docintel/)
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from samples.source import DOCUMENTS

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "samples" / "fonts"
OUT = ROOT / "samples" / "pdf"

for name, file in [("Serif", "NotoSerif-Regular"), ("Serif-Bold", "NotoSerif-Bold"),
                   ("Sans", "NotoSans-Regular"), ("Sans-Bold", "NotoSans-Bold")]:
    pdfmetrics.registerFont(TTFont(name, str(FONTS / f"{file}.ttf")))

INK = colors.HexColor("#1b1b1b")
MUTED = colors.HexColor("#5c5c5c")
RULE = colors.HexColor("#c9c9c9")


def styles(family: str) -> dict[str, ParagraphStyle]:
    bold = f"{family}-Bold"
    return {
        "title": ParagraphStyle("title", fontName=bold, fontSize=17, leading=22, textColor=INK, spaceAfter=4),
        "sub": ParagraphStyle("sub", fontName=family, fontSize=8.5, leading=12, textColor=MUTED, spaceAfter=12),
        "h": ParagraphStyle("h", fontName=bold, fontSize=10.5, leading=14, textColor=INK, spaceBefore=9, spaceAfter=3),
        "p": ParagraphStyle("p", fontName=family, fontSize=9.6, leading=13.6, textColor=INK, spaceAfter=5),
        "small": ParagraphStyle("small", fontName=family, fontSize=7.8, leading=10.5, textColor=MUTED, spaceBefore=10),
        "cell": ParagraphStyle("cell", fontName=family, fontSize=8.8, leading=11, textColor=INK),
        "cellb": ParagraphStyle("cellb", fontName=bold, fontSize=8.8, leading=11, textColor=INK),
    }


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def flow(doc: dict) -> list:
    family = "Sans" if doc["type"] in {"invoice", "purchase_order"} else "Serif"
    st = styles(family)
    out: list = []
    for block in doc["blocks"]:
        kind = block[0]
        if kind in {"title", "sub", "h", "p", "small"}:
            out.append(Paragraph(esc(block[1]), st[kind]))
        elif kind == "space":
            out.append(Spacer(1, block[1]))
        elif kind == "kv":
            rows = [[Paragraph(esc(c), st["cellb" if i % 2 == 0 else "cell"]) for i, c in enumerate(r)] for r in block[1]]
            t = Table(rows, colWidths=[80, 150, 80, 150])
            t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, RULE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                   ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
            out += [t, Spacer(1, 6)]
        elif kind == "table":
            rows, widths = block[1], block[2]
            n = len(rows)
            body = []
            for ri, r in enumerate(rows):
                strong = ri == 0 or r[1] == "Grand total"
                body.append([Paragraph(esc(c), st["cellb" if strong else "cell"]) for c in r])
            t = Table(body, colWidths=widths, repeatRows=1)
            t.setStyle(TableStyle([
                ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK),
                ("LINEBELOW", (0, 1), (-1, n - 2), 0.3, RULE),
                ("LINEABOVE", (0, n - 1), (-1, n - 1), 0.8, INK),
                ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            out += [t, Spacer(1, 6)]
        elif kind == "sign":
            cols = [[Paragraph("Signature: ______________________", st["cell"]), Paragraph(esc(n), st["cellb"]),
                     Paragraph(esc(r), st["cell"]), Paragraph(esc(c), st["cell"])] for n, r, c in block[1]]
            rows = [list(x) for x in zip(*cols)]
            t = Table(rows, colWidths=[235, 235])
            t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 2),
                                   ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
            out.append(t)
        else:
            raise ValueError(f"unknown block {kind}")
    return out


def footer(label: str, family: str):
    def draw(canvas, doc):
        canvas.saveState()
        canvas.setFont(family, 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(64, 28, label)
        canvas.drawRightString(A4[0] - 64, 28, f"Page {doc.page}")
        canvas.restoreState()
    return draw


def build(doc: dict) -> Path:
    path = OUT / f"{doc['id']}.pdf"
    family = "Sans" if doc["type"] in {"invoice", "purchase_order"} else "Serif"
    pdf = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=64, rightMargin=64, topMargin=60, bottomMargin=64,
                            title=doc["title"], author="DocDesk sample (synthetic)", subject="Synthetic sample document",
                            creator="DocDesk", producer="DocDesk", invariant=1)
    draw = footer(f"{doc['title']} · Synthetic sample — fictional parties", family)
    pdf.build(flow(doc), onFirstPage=draw, onLaterPages=draw)
    return path


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for doc in DOCUMENTS:
        path = build(doc)
        print(f"{path.name}: {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
