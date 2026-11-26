"""Golden calls: caller lines + the outcome a good front desk would reach.

Clock for every scenario: Monday 23 Nov 2026, 7:30 pm IST (after hours). `rules_ok` = rules alone must pass
(run in pytest, 0 tokens); the others need the model and run in the evaluation script.
Expected fields are checked only when present: outcome, doctor, day (ISO), time (HH:MM), patient, flags,
requests, max_turns, never (substrings the agent must not say).
"""

from __future__ import annotations

NOW = "2026-11-23T19:30:00+05:30"

SCENARIOS: list[dict] = [
    {"id": "doctor-surname-patient", "rules_ok": True,
     "turns": ["I'd like to see Dr. Menon on Saturday", "second", "Priya Iyer", "no"],
     "expect": {"outcome": "booked", "doctor": "menon", "day": "2026-11-28", "patient": "Priya Iyer"}},
    {"id": "showcase-follow-up", "rules_ok": True,
     "turns": ["Hi, I need to see Dr. Rao for a follow-up, ideally Tuesday afternoon. It's Arjun Mehta.",
               "the later one", "no that's all"],
     "expect": {"outcome": "booked", "doctor": "rao", "day": "2026-11-24", "patient": "Arjun Mehta",
                "flags": ["returning patient"], "max_turns": 3}},
    {"id": "child-fever-change-day", "rules_ok": True,
     "turns": ["I want an appointment for my son, he has a fever", "tomorrow morning", "first one", "Rohan Sharma",
               "actually can we make it Thursday", "second", "bye"],
     "expect": {"outcome": "booked", "doctor": "menon", "day": "2026-11-26", "patient": "Rohan Sharma"}},
    {"id": "faq-then-dentist-earliest", "rules_ok": True,
     "turns": ["what are your timings?", "yes", "dentist", "as soon as possible", "the first one",
               "my name is priya nair", "no thanks"],
     "expect": {"outcome": "booked", "doctor": "qureshi", "day": "2026-11-24", "patient": "Priya Nair"}},
    {"id": "exact-time-free", "rules_ok": True,
     "turns": ["Can I book Dr. Rao on Wednesday at 11:30 am? My name is Kiran Das.", "yes please", "no"],
     "expect": {"outcome": "booked", "doctor": "rao", "day": "2026-11-25", "time": "11:30", "patient": "Kiran Das"}},
    {"id": "exact-time-taken", "rules_ok": True,
     "turns": ["Dr. Rao, Wednesday at quarter past eleven in the morning, for Kiran Das", "the 11 o'clock one", "no"],
     "expect": {"outcome": "booked", "doctor": "rao", "day": "2026-11-25", "time": "11:00"},
     "says": ["11:15 am is taken"]},
    {"id": "doctor-not-in-that-day", "rules_ok": True,
     "turns": ["skin doctor on tuesday at 4", "Wednesday", "Fatima Sheikh", "no"],
     "expect": {"outcome": "booked", "doctor": "iyer", "day": "2026-11-25", "patient": "Fatima Sheikh"}},
    {"id": "sunday-closed", "rules_ok": True,
     "turns": ["I'd like to see Dr. Rao on Sunday", "first", "It's Neha Gupta", "no"],
     "expect": {"outcome": "booked", "doctor": "rao", "patient": "Neha Gupta"}, "says": ["closed on Sundays"]},
    {"id": "decline-then-accept", "rules_ok": True,
     "turns": ["dentist on friday afternoon", "neither works", "the second one", "Imran Khan", "no"],
     "expect": {"outcome": "booked", "doctor": "qureshi", "patient": "Imran Khan"}},
    {"id": "name-correction-after-booking", "rules_ok": True,
     "turns": ["Book Dr. Menon on Thursday morning for my daughter Ananya", "first one",
               "sorry, the name is Ananya Iyengar", "no"],
     "expect": {"outcome": "booked", "doctor": "menon", "day": "2026-11-26", "patient": "Ananya Iyengar"}},
    {"id": "emergency", "rules_ok": True,
     "turns": ["my father has chest pain and is sweating"],
     "expect": {"outcome": "handoff", "flags": ["urgent"]}, "says": ["112"]},
    {"id": "wants-human", "rules_ok": True,
     "turns": ["Can I speak to the receptionist please"],
     "expect": {"outcome": "handoff"}},
    {"id": "cancel-existing", "rules_ok": True,
     "turns": ["I need to cancel my appointment, it's Vikram Singh", "no"],
     "expect": {"outcome": "request", "requests": ["Cancel an existing appointment"], "patient": "Vikram Singh"}},
    {"id": "faq-only", "rules_ok": True,
     "turns": ["Where is the clinic located?", "Is there parking?", "no thanks"],
     "expect": {"outcome": "info"}, "says": ["Lake View Road", "parking"]},
    {"id": "fees-midway", "rules_ok": True,
     "turns": ["Appointment with Dr. Iyer on Friday", "how much is the consultation?", "first", "Sana Ali", "no"],
     "expect": {"outcome": "booked", "doctor": "iyer", "day": "2026-11-27", "patient": "Sana Ali"}, "says": ["900"]},
    {"id": "gibberish", "rules_ok": True,
     "turns": ["blah", "hmm what"],
     "expect": {"outcome": "handoff"}},
    {"id": "too-far-ahead", "rules_ok": True,
     "turns": ["Dr. Rao on the 30th of December please", "first", "Asha Pillai", "no"],
     "expect": {"outcome": "booked", "doctor": "rao", "patient": "Asha Pillai"}, "says": ["two weeks"]},
    # --- need the model ---------------------------------------------------------------------------------------
    {"id": "negation", "rules_ok": False,
     "turns": ["I can't do Tuesday, but Wednesday evening works for Dr. Rao", "first", "Rahul Verma", "no"],
     "expect": {"outcome": "booked", "doctor": "rao", "day": "2026-11-25", "patient": "Rahul Verma"}},
    {"id": "misheard-doctor", "rules_ok": False,
     "turns": ["I want to see doctor row on thursday", "first", "Deepa Nair", "no"],
     "expect": {"outcome": "booked", "doctor": "rao", "day": "2026-11-26", "patient": "Deepa Nair"}},
    {"id": "rambling", "rules_ok": True,
     "turns": ["So my wife has been getting these red itchy patches on her arms for a week, could someone look at "
               "it, maybe Friday?", "first", "Lakshmi Rao", "no"],
     "expect": {"outcome": "booked", "doctor": "iyer", "day": "2026-11-27", "patient": "Lakshmi Rao"}},
    {"id": "lowercase-name-midsentence", "rules_ok": False,
     "turns": ["hi this is about booking, dr qureshi, monday, and the patient will be suresh kumar", "first", "no"],
     "expect": {"outcome": "booked", "doctor": "qureshi", "day": "2026-11-30", "patient": "Suresh Kumar"}},
]


async def run(engine, scenario: dict, now) -> tuple[object, list[str]]:
    """Play a scenario's caller lines through the engine (stops early if the call ends)."""
    call, greeting = engine.start(scenario["id"], now)
    replies = [greeting]
    for line in scenario["turns"]:
        if call.ended:
            break
        replies.append(await engine.turn(call, line))
    return call, replies


def check(call, replies: list[str], scenario: dict) -> list[str]:
    """Differences from the expected outcome (empty = pass)."""
    exp, errs = scenario["expect"], []
    s = call.booking
    if exp.get("outcome") and call.outcome != exp["outcome"]:
        errs.append(f"outcome {call.outcome} != {exp['outcome']}")
    if exp.get("doctor") and (s.doctor_id if s else call.doctor_id) != exp["doctor"]:
        errs.append(f"doctor {s.doctor_id if s else call.doctor_id} != {exp['doctor']}")
    if exp.get("day") and (not s or s.start.date().isoformat() != exp["day"]):
        errs.append(f"day {s.start.date() if s else None} != {exp['day']}")
    if exp.get("time") and (not s or f"{s.start:%H:%M}" != exp["time"]):
        errs.append(f"time {f'{s.start:%H:%M}' if s else None} != {exp['time']}")
    if exp.get("patient") and call.name != exp["patient"]:
        errs.append(f"patient {call.name} != {exp['patient']}")
    for flag in exp.get("flags", []):
        if flag not in call.flags:
            errs.append(f"missing flag {flag}")
    for req in exp.get("requests", []):
        if req not in call.requests:
            errs.append(f"missing request {req}")
    if exp.get("max_turns") and call.turns > exp["max_turns"]:
        errs.append(f"{call.turns} turns > {exp['max_turns']}")
    said = " ".join(replies)
    for phrase in scenario.get("says", []):
        if phrase not in said:
            errs.append(f"never said {phrase!r}")
    return errs
