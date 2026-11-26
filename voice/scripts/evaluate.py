"""Play the golden scenarios through the engine and write quality/report.json.

  env -u PYTHONPATH .venv/bin/python -m scripts.evaluate            # all scenarios, model on (free tier)
  env -u PYTHONPATH .venv/bin/python -m scripts.evaluate --model-only   # only those that need the model
  env -u PYTHONPATH .venv/bin/python -m scripts.evaluate --rules        # no model calls at all
Internal: the report may name routes/model counts; the site only shows the headline numbers.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from datetime import datetime

from app.config import ROOT, get_settings
from app.dialog import Engine
from app.llm import GroqCompleter
from app.nlu import PROMPT_VERSION, DailyBudget, Understander
from app.scenarios import NOW, SCENARIOS, check


def pct(xs: list[float]) -> dict:
    if not xs:
        return {"n": 0}
    xs = sorted(xs)
    at = lambda q: round(xs[min(len(xs) - 1, int(q * len(xs)))], 1)  # noqa: E731
    return {"n": len(xs), "p50": at(0.5), "p90": at(0.9), "max": round(xs[-1], 1)}


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rules", action="store_true")
    ap.add_argument("--model-only", action="store_true")
    args = ap.parse_args()
    settings = get_settings()
    completer = None if args.rules or not settings.live else GroqCompleter(settings)
    now = datetime.fromisoformat(NOW)
    rows: list[dict] = []
    rules_ms: list[float] = []
    model_ms: list[float] = []
    for sc in SCENARIOS:
        if args.model_only and sc["rules_ok"]:
            continue
        understander = Understander(completer, DailyBudget(1000))
        engine = Engine(understander)
        t0 = time.perf_counter()
        call, greeting = engine.start(sc["id"], now)
        replies = [greeting]
        for line in sc["turns"]:
            if call.ended:
                break
            before, t = understander.model_calls, time.perf_counter()
            replies.append(await engine.turn(call, line))
            (model_ms if understander.model_calls > before else rules_ms).append((time.perf_counter() - t) * 1000)
        errs = check(call, replies, sc)
        rows.append({"id": sc["id"], "pass": not errs, "errors": errs, "turns": call.turns,
                     "modelCalls": understander.model_calls, "seconds": round(time.perf_counter() - t0, 2)})
        print(("PASS " if not errs else "FAIL ") + sc["id"], errs or "", f"model={understander.model_calls}")
        if completer:
            await asyncio.sleep(2)  # stay well inside the free tier's per-minute limit
    passed = sum(r["pass"] for r in rows)
    report = {"prompt": PROMPT_VERSION, "ranAt": datetime.now().isoformat(timespec="seconds"),
              "model": bool(completer), "passed": passed, "total": len(rows),
              "turns": sum(r["turns"] for r in rows), "modelCalls": sum(r["modelCalls"] for r in rows),
              "turnMs": {"rules": pct(rules_ms), "model": pct(model_ms)},
              "scenarios": rows}
    if not args.model_only:
        (ROOT / "quality" / "report.json").write_text(json.dumps(report, indent=1) + "\n")
    print(f"{passed}/{len(rows)} passed · {report['modelCalls']} model calls over {report['turns']} turns")


if __name__ == "__main__":
    asyncio.run(main())
