"""Internal reports → the small public snapshot the app shows (results only: no routes, models or methods).

  env -u PYTHONPATH .venv/bin/python -m scripts.publish   → src/features/demos/voice-ai/quality.json
Reads quality/report.json (scripts.evaluate, with the model) and quality/audio.json (scripts.audio_eval).
"""

from __future__ import annotations

import json

from app.config import ROOT

OUT = ROOT.parent / "src" / "features" / "demos" / "voice-ai" / "quality.json"


def load(name: str) -> dict:
    p = ROOT / "quality" / name
    return json.loads(p.read_text()) if p.exists() else {}


def main() -> None:
    golden, audio = load("report.json"), load("audio.json")
    if not golden.get("model"):
        raise SystemExit("report.json is a rules-only run; run scripts.evaluate with the model first")
    turn = golden.get("turnMs", {})
    snap = {
        "ranAt": max(golden.get("ranAt", ""), audio.get("ranAt", ""))[:10],
        "calls": {"passed": golden["passed"], "total": golden["total"]},
        "heard": {"understood": audio["understood"], "clips": audio["clips"]} if audio else None,
        "sttMs": audio.get("sttMs", {}).get("p50"),
        "turnMs": {"quick": turn.get("rules", {}).get("p50"), "harder": turn.get("model", {}).get("p50")},
        "aboutFirstWordMs": (audio.get("assistantFirstWordMs") or {}).get("p50"),
    }
    OUT.write_text(json.dumps(snap, indent=1) + "\n")
    print(json.dumps(snap))


if __name__ == "__main__":
    main()
