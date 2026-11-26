"""Exports read-only sample data for the Next.js fallback (used when the service is unreachable, e.g. a static deploy).

Writes src/features/demos/document-intelligence/snapshot.json and public/demos/docdesk/<id>-<page>.webp.
No model calls: examples, extraction (from samples/extracted.json), checks, compare, review and quality only.
Run: env -u PYTHONPATH .venv/bin/python -m scripts.snapshot   (from docintel/; re-run after samples change)
"""

from __future__ import annotations

import json
from dataclasses import replace

from fastapi.testclient import TestClient

from app.config import ROOT, get_settings
from app.main import create_app

SITE = ROOT.parent
OUT_JSON = SITE / "src" / "features" / "demos" / "document-intelligence" / "snapshot.json"
OUT_IMG = SITE / "public" / "demos" / "docdesk"


def main() -> None:
    settings = replace(get_settings(), groq_key="", token="")  # never call a model here
    c = TestClient(create_app(settings))
    snap: dict = {"limits": c.get("/limits").json(), "quality": c.get("/quality").json(), "review": c.get("/review").json()}
    docs = c.get("/documents").json()
    snap["documents"] = docs
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    ids = [d["id"] for d in docs["documents"]]
    for d in docs["documents"]:
        i = d["id"]
        snap[f"documents/{i}"] = c.get(f"/documents/{i}").json()
        snap[f"documents/{i}/extract"] = c.get(f"/documents/{i}/extract").json()
        for n in range(len(d["examples"])):
            snap[f"documents/{i}/ask#{n}"] = c.post(f"/documents/{i}/ask", json={"example": n}).json()
        for p in range(1, d["pages"] + 1):
            (OUT_IMG / f"{i}-{p}.webp").write_bytes(c.get(f"/documents/{i}/pages/{p}").content)
    for a in ids:
        for b in ids:
            if a == b:
                continue
            r = c.get(f"/compare?a={a}&b={b}")
            if r.status_code == 200:
                snap[f"compare?a={a}&b={b}"] = r.json()
    OUT_JSON.write_text(json.dumps(snap, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT_JSON.name}: {OUT_JSON.stat().st_size // 1024} KB, {len(snap)} keys; images in {OUT_IMG}")


if __name__ == "__main__":
    main()
