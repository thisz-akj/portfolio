"""Runs full extraction (rules + model) on every sample once and saves samples/extracted.json.

The service serves these results to visitors, so sample extraction costs no tokens at runtime.
Re-run after changing samples or extraction rules (entries are keyed by the PDF's hash; stale ones are ignored).
Run: env -u PYTHONPATH .venv/bin/python -m scripts.extract_samples [doc-id ...]
"""

from __future__ import annotations

import asyncio
import json
import sys
import time

from app.config import ROOT, get_settings
from app.extract import extract
from app.llm import GroqCompleter
from app.store import Store


async def main(only: list[str]) -> None:
    settings = get_settings()
    if not settings.live:
        sys.exit("GROQ_API_KEY is not set")
    store = Store(settings.samples_dir)
    path = ROOT / "samples" / "extracted.json"
    out = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    completer = GroqCompleter(settings)
    for doc in store.samples():
        if only and doc.id not in only:
            continue
        t0 = time.perf_counter()
        result = await extract(doc.parsed, doc.type, completer)
        if not result["complete"]:
            print(f"{doc.id}: model busy, kept previous result")
            continue
        out[doc.id] = {"sha": doc.parsed.sha, "result": result}
        conf = [f["confidence"] for f in result["fields"]]
        print(f"{doc.id}: {conf.count('high')} high, {conf.count('review')} review, {conf.count('missing')} missing "
              f"({time.perf_counter() - t0:.1f}s)")
        path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
        await asyncio.sleep(8)  # free tier: tokens per minute


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
