"""Build the sample calls the site can play with zero tokens and no live service.

Each sample is a golden scenario played through the engine with rules only (fixed clock), saved turn by turn with
the timeline events, booking and staff note as they were at that moment. Output (results only, no internals):
  src/features/demos/voice-ai/samples.json
Run from voice/: env -u PYTHONPATH .venv/bin/python -m scripts.samples   (a pytest fails if the file is stale)
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime

from app.config import ROOT
from app.dialog import Engine, summary
from app.nlu import DailyBudget, Understander
from app.scenarios import NOW, SCENARIOS

OUT = ROOT.parent / "src" / "features" / "demos" / "voice-ai" / "samples.json"

PICKS = [
    ("showcase-follow-up", "Follow-up booking", "Everything in one breath: doctor, day, name. Booked in two turns."),
    ("child-fever-change-day", "Changes their mind", "A parent books, then moves the visit to another day."),
    ("doctor-not-in-that-day", "Doctor's day off", "Asks for a day the doctor isn't in and gets the nearest real slots."),
    ("faq-then-dentist-earliest", "Question, then booking", "Opening hours first, then the earliest dentist slot."),
    ("emergency", "Urgent call", "Describes an emergency. The agent stops booking and directs to 112/108."),
    ("cancel-existing", "Cancel request", "An existing appointment goes to the front desk as a call-back."),
]


async def build() -> list[dict]:
    by_id = {s["id"]: s for s in SCENARIOS}
    now = datetime.fromisoformat(NOW)
    out = []
    for sid, title, blurb in PICKS:
        sc = by_id[sid]
        engine = Engine(Understander(None, DailyBudget(0)))
        call, greeting = engine.start(sid, now)
        turns = [{"role": "agent", "text": greeting, "events": [], "booking": None}]
        for line in sc["turns"]:
            if call.ended:
                break
            seen = len(call.events)
            reply = await engine.turn(call, line)
            new = [{"kind": e["kind"], "text": e["text"]} for e in call.events[seen:]]
            booking = call.booking.public() if call.booking else None
            turns.append({"role": "caller", "text": line, "events": [], "booking": None})
            turns.append({"role": "agent", "text": reply, "events": new, "booking": booking})
        note = summary(call)
        out.append({"id": sid, "title": title, "blurb": blurb, "turns": turns,
                    "summary": {"outcome": note["outcome"], "text": note["text"].replace("Call 0m 00s, ", "")}})
    return out


def render(samples: list[dict]) -> str:
    return json.dumps({"clock": NOW, "samples": samples}, indent=1, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    OUT.write_text(render(asyncio.run(build())), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT.parent)}")
