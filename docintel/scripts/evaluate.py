"""Quality report: graded Q&A on the golden set + extraction accuracy vs ground truth → quality/report.json.

Q&A runs through exactly the same path visitors use (retrieval → model → quote verification), with the
cache off. Extraction is scored from samples/extracted.json (what visitors see). Free-tier friendly: paced.
Run: env -u PYTHONPATH .venv/bin/python -m scripts.evaluate
"""

from __future__ import annotations

import asyncio
import json
import re
import statistics
import sys
import time
from datetime import datetime, timezone

from app.ask import PROMPT_VERSION, Asker, DailyBudget, TTLCache
from app.config import ROOT, get_settings
from app.extract import EXTRACT_VERSION
from app.llm import GroqCompleter
from app.store import Store
from samples.source import DOCUMENTS, GOLDEN

PACE_S = 9  # seconds between questions (free tier tokens/minute)


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().replace("‑", "-").replace("–", "-"))


def grade(item: dict, res: dict) -> dict:
    if item.get("negative"):
        ok = res["mode"] == "not_found"
        return {"correct": ok, "grounded": ok, "reason": "" if ok else "answered a question the document doesn't cover"}
    if res["mode"] != "answer":
        return {"correct": False, "grounded": False, "reason": f"mode={res['mode']}"}
    ans = norm(res["answer"]).replace(",", "")
    missing = [g for g in item["expect"] if not any(norm(alt).replace(",", "") in ans for alt in g.split("|"))]
    sections = [c["section"] for c in res["citations"]]
    grounded = bool(res["citations"]) and (not item.get("section") or item["section"] in sections)
    return {"correct": not missing, "grounded": grounded,
            "reason": (f"missing {missing}" if missing else "") + ("" if grounded else " wrong/no citation")}


def field_match(truth, got) -> bool:
    if truth in (0, None) and got in (0, None):
        return True
    if isinstance(truth, list) and isinstance(got, list):
        t = {re.sub(r"[^a-z]", "", x.lower())[:20] for x in truth}
        g = {re.sub(r"[^a-z]", "", x.lower())[:20] for x in got}
        return t == g
    if isinstance(truth, str) and isinstance(got, str) and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", truth):
        tw, gw = set(re.findall(r"[a-z0-9]+", truth.lower())), set(re.findall(r"[a-z0-9]+", got.lower()))
        return len(tw & gw) / max(1, len(tw)) >= 0.8
    return truth == got


def extraction_report() -> dict:
    pre = json.loads((ROOT / "samples" / "extracted.json").read_text(encoding="utf-8"))
    per_doc, total, right, confident_wrong = [], 0, 0, 0
    for meta in DOCUMENTS:
        res = pre[meta["id"]]["result"]
        got = {f["key"]: f for f in res["fields"]}
        n = ok = 0
        for key, truth in meta["fields"].items():
            if key == "line_items" or key not in got:
                continue
            n += 1
            hit = field_match(truth, got[key]["value"])
            ok += hit
            confident_wrong += (not hit) and got[key]["confidence"] == "high"
        total, right = total + n, right + ok
        per_doc.append({"doc": meta["title"], "type": res["typeLabel"], "fields": n, "correct": ok})
    return {"fields": total, "correct": right, "accuracy": round(right / total, 3), "confidentWrong": confident_wrong,
            "perDoc": per_doc}


async def main() -> None:
    settings = get_settings()
    if not settings.live:
        sys.exit("GROQ_API_KEY is not set")
    store = Store(settings.samples_dir)
    asker = Asker(GroqCompleter(settings), DailyBudget(10_000), TTLCache(ttl_s=0))
    rows = []
    for i, item in enumerate(GOLDEN, 1):
        doc = store.get(item["doc"])
        t0 = time.perf_counter()
        res = await asker.ask(doc, item["q"], [])
        if res.get("busy"):  # rate-limited: wait and retry once
            await asyncio.sleep(30)
            t0 = time.perf_counter()
            res = await asker.ask(doc, item["q"], [])
        ms = round((time.perf_counter() - t0) * 1000)
        g = grade(item, res)
        rows.append({"doc": doc.title, "question": item["q"], "kind": "not-in-document" if item.get("negative") else "answerable",
                     "answer": res["answer"], "pages": sorted({c["page"] for c in res["citations"]}),
                     "correct": g["correct"], "grounded": g["grounded"], "latencyMs": ms, "busy": bool(res.get("busy")),
                     "_route": asker.last_route})
        print(f"{i:2}/{len(GOLDEN)} {'✓' if g['correct'] else '✗'} {ms:5} ms  [{asker.last_route:7}] {item['q'][:55]}  {g['reason']}")
        await asyncio.sleep(PACE_S)

    answerable = [r for r in rows if r["kind"] == "answerable"]
    negative = [r for r in rows if r["kind"] != "answerable"]
    lat = sorted(r["latencyMs"] for r in rows if not r["busy"])
    routes = {r: sum(x["_route"] == r for x in rows) for r in ("whole", "keyword", "ai")}
    for x in rows:
        x.pop("_route", None)
    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "versions": {"answers": PROMPT_VERSION, "extraction": EXTRACT_VERSION, "routes": routes},  # internal only
        "qa": {
            "questions": len(rows),
            "accuracy": round(sum(r["correct"] for r in rows) / len(rows), 3),
            "answerableAccuracy": round(sum(r["correct"] for r in answerable) / len(answerable), 3),
            "citationAccuracy": round(sum(r["grounded"] for r in answerable) / len(answerable), 3),
            "notFoundAccuracy": round(sum(r["correct"] for r in negative) / len(negative), 3),
            "latencyP50": lat[len(lat) // 2] if lat else None,
            "latencyP95": lat[min(len(lat) - 1, int(len(lat) * 0.95))] if lat else None,
            "latencyMean": round(statistics.mean(lat)) if lat else None,
            "rows": rows,
        },
        "extraction": extraction_report(),
    }
    out = ROOT / "quality" / "report.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    q = report["qa"]
    print(f"\nQ&A {q['accuracy']:.0%} · citations {q['citationAccuracy']:.0%} · not-found {q['notFoundAccuracy']:.0%} · "
          f"p50 {q['latencyP50']} ms · extraction {report['extraction']['accuracy']:.0%} · routes {routes}")


if __name__ == "__main__":
    asyncio.run(main())
