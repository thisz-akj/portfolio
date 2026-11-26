"""The conversation: what the agent says next, decided by rules from the call state and the calendar.

Every reply is a template filled from the calendar and clinic facts — the model only reads the caller's words —
so the agent can't invent a slot, a fee or a policy. Picking a slot with a known name books it at once and reads
it back; corrections later in the same call update or rebook it.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime

from .clinic import (BY_SPECIALTY, CLINIC_NAME, DOCTORS, FAQ, PATIENTS, Calendar, Found, Slot, doctors_menu,
                     find_slots)
from .dates import WEEKDAYS, spoken_date, spoken_time
from .nlu import Context, Understander, Understanding

GREETING = (f"Hello, you've reached {CLINIC_NAME}. The front desk is closed right now, but I can book an "
            "appointment or answer a quick question. How can I help?")
GOODBYE = f"Thank you for calling {CLINIC_NAME}. Take care!"
_ANOTHER = re.compile(r"\b(another|also|second|as well|too|one more)\b", re.I)


@dataclass
class Call:
    id: str
    now: datetime
    calendar: Calendar = field(default_factory=Calendar)
    started: float = field(default_factory=time.monotonic)
    turns: int = 0
    wants: str | None = None
    name: str | None = None
    doctor_id: str | None = None
    reason: str | None = None
    day: date | None = None
    at: tuple[int, int] | None = None
    part: str | None = None
    earliest: bool = False
    offered: list[Slot] = field(default_factory=list)
    excluded: set[str] = field(default_factory=set)
    chosen: Slot | None = None
    booking: Slot | None = None
    asked: str = "open"
    declined: bool = False  # the last offer was turned down → don't repeat why the first wish didn't work
    misses: int = 0
    ended: bool = False
    outcome: str | None = None  # booked | handoff | request | info | incomplete
    handoff_reason: str | None = None
    requests: list[str] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)
    topics: list[str] = field(default_factory=list)
    transcript: list[dict] = field(default_factory=list)
    events: list[dict] = field(default_factory=list)

    @property
    def today(self) -> date:
        return self.now.date()

    def elapsed(self) -> float:
        return round(time.monotonic() - self.started, 1)

    def event(self, kind: str, text: str) -> None:
        self.events.append({"t": self.elapsed(), "kind": kind, "text": text})

    def say(self, role: str, text: str) -> None:
        self.transcript.append({"role": role, "text": text, "t": self.elapsed()})

    def when(self, s: Slot) -> str:
        return f"{spoken_date(s.start.date(), self.today)} at {s.time_text()}"

    def options(self, joiner: str = " or ") -> str:
        """The slots on offer, said briefly: times only if they're on one day, else day + time."""
        same_day = len({s.start.date() for s in self.offered}) == 1
        if same_day:
            return joiner.join(s.time_text() for s in self.offered)
        return joiner.join(f"{WEEKDAYS[s.start.weekday()].title()} at {s.time_text()}" for s in self.offered)


class Engine:
    def __init__(self, understander: Understander, max_turns: int = 14):
        self.understander, self.max_turns = understander, max_turns

    def start(self, call_id: str, now: datetime) -> tuple[Call, str]:
        call = Call(call_id, now)
        call.say("agent", GREETING)
        return call, GREETING

    async def turn(self, call: Call, text: str) -> str:
        text = " ".join(text.split())[:400]
        call.turns += 1
        call.say("caller", text)
        ctx = Context(call.asked, list(call.offered), call.today)
        u = await self.understander.understand(text, ctx)
        if found := u.found():
            call.event("understood", " · ".join(found))
        reply = self._respond(call, u, text)
        if not call.ended and call.turns >= self.max_turns:
            reply = self._wrap_up(call, reply)
        call.say("agent", reply)
        return reply

    # --- turn logic --------------------------------------------------------------------------------------------

    def _respond(self, call: Call, u: Understanding, text: str) -> str:
        if u.intent == "emergency":
            call.flags.append("urgent")
            return self._handoff(call, "Caller described a possible emergency",
                                 "This sounds urgent. Please hang up and call 112 now, or 108 for an ambulance. "
                                 "I'm also alerting our doctor on duty.")
        if u.intent == "human":
            return self._handoff(call, "Caller asked for a person",
                                 "Of course. I've passed your details to the front desk, and someone will call you "
                                 "back when we open at 9:30 am. Thank you for calling.")
        wishes = any([u.doctor_id, u.specialty, u.day, u.at, u.part, u.earliest])
        if (u.intent == "goodbye" and (call.asked in ("else", "open") or not u.no)) or \
                (call.asked == "else" and u.no and not wishes and not u.name and not u.topic):
            return self._end(call)
        if u.intent in ("cancel", "reschedule") and not (call.booking and u.intent == "reschedule"):
            return self._existing(call, u)

        pre = ""
        if u.topic:
            pre = FAQ[u.topic] + " "
            call.topics.append(u.topic)
            call.event("answered", f"Question: {u.topic}")
        if call.booking:
            return pre + self._after_booking(call, u, wishes, text)

        changed = self._apply(call, u)
        if u.intent == "book" or wishes or (u.yes and call.asked == "else"):
            call.wants = "book"
        if call.asked == "offer" and call.offered and not changed:
            if u.choice is not None:
                call.chosen = call.offered[u.choice]
            elif u.yes and len(call.offered) == 1:
                call.chosen = call.offered[0]
            elif u.yes:
                return pre + f"Which would you like: {call.options()}?"
            elif u.no:
                call.excluded |= {s.key for s in call.offered}
                call.offered, call.declined = [], True
                pre += "No problem. "

        if not (u.useful or pre):
            call.misses += 1
            if call.misses >= 2:
                return self._handoff(call, "Agent couldn't understand the caller",
                                     "I'm sorry, I'm having trouble understanding. I'll ask the front desk to call "
                                     "you back when we open. Thank you for calling.")
            return "Sorry, I didn't catch that. " + self._question(call)
        call.misses = 0
        if not call.wants:
            call.asked = "else" if pre else "open"
            return pre + ("Is there anything else I can help with? I can also book an appointment." if pre else
                          "I can book an appointment or answer questions about the clinic. What would you like to do?")
        return pre + self._next(call)

    def _apply(self, call: Call, u: Understanding) -> bool:
        """Fold what the caller said into the call. Returns True if their wishes changed (→ search again)."""
        changed = False
        doc = u.doctor_id or (BY_SPECIALTY.get(u.specialty or "") if not call.doctor_id else None)
        if doc and doc != call.doctor_id:
            call.doctor_id, changed = doc, True
        if u.day and u.day != call.day:
            call.day, call.earliest, changed = u.day, False, True
        if u.at and u.at != call.at:
            call.at, changed = u.at, True
        if u.part and not u.at and u.part != call.part:
            call.part, call.at, changed = u.part, None, True
        if u.earliest and not u.day and not call.earliest:
            call.earliest, call.day, changed = True, None, True
        if u.name:
            call.name = u.name
        if u.reason and not call.reason:
            call.reason = u.reason
        if changed:
            call.offered, call.chosen = [], None
        return changed

    def _next(self, call: Call) -> str:
        doc = DOCTORS.get(call.doctor_id or "")
        if not doc:
            again = call.asked == "doctor"
            call.asked = "doctor"
            if again:
                return "Which doctor: Dr. Rao for general health, Dr. Iyer for skin, Dr. Menon for children, or Dr. Qureshi for teeth?"
            return f"Which doctor would you like to see? We have {doctors_menu()}."
        if not call.chosen:
            if not (call.day or call.at or call.part or call.earliest):
                call.asked = "day"
                return f"{doc.short} sees patients {doc.days_text()}. What day would suit you?"
            if not call.offered:
                found = find_slots(call.calendar, doc, call.now, call.day, call.at, call.part,
                                   frozenset(call.excluded))
                call.event("checked", f"Calendar: {doc.short} · " + (
                    ", ".join(s.short() for s in found.slots) + " free" if found.slots else "nothing free"))
                if not found.slots:
                    return self._handoff(call, "No free slot in the next two weeks",
                                         f"I'm sorry, {doc.short} has no free slots in the next two weeks. I'll ask "
                                         "the front desk to call you back to find a time.")
                call.offered, call.asked = found.slots, "offer"
                return self._offer_text(call, doc, found)
            call.asked = "offer"
            return f"Would {call.options()} work for you?"
        if not call.name:
            call.asked = "name"
            return f"{call.chosen.time_text()} it is. May I have the patient's full name?"
        return self._book(call)

    def _offer_text(self, call: Call, doc, found: Found) -> str:
        times = [s.time_text() for s in found.slots]
        day = spoken_date(found.slots[0].start.date(), call.today)
        lead = ""
        if call.declined:
            call.declined = False
        elif found.reason == "past":
            lead = "That date has already passed. "
        elif found.reason == "too_far":
            lead = "I can only book up to two weeks ahead. "
        elif found.reason == "closed":
            lead = "We're closed on Sundays. "
        elif found.reason == "off" and found.asked_day:
            lead = f"{doc.short} isn't in on {WEEKDAYS[found.asked_day.weekday()].title()}s. "
        elif found.reason == "full":
            part = f" in the {call.part}" if call.part else f" at {spoken_time(*call.at)}" if call.at else ""
            lead = (f"{doc.short} is fully booked {spoken_date(found.asked_day, call.today)}{part}. "
                    if found.asked_day else f"{doc.short} has nothing free{part} in the next two weeks. ")
        elif found.reason == "taken" and call.at:
            lead = f"{spoken_time(*call.at)} is taken. "
        if found.kind == "exact":
            return lead + f"{doc.short} has {times[0]} free {day}. Shall I book that?"
        if len(times) == 1:
            return lead + f"{doc.short} has {times[0]} {day}. Would that work?"
        if found.slots[0].start.date() != found.slots[1].start.date():
            other = spoken_date(found.slots[1].start.date(), call.today)
            return lead + (f"The nearest I have with {doc.short} is {day} at {times[0]}, or {other} at {times[1]}. "
                           "Which would you prefer?")
        if found.kind == "other_day":
            return lead + f"The nearest I have with {doc.short} is {day}, at {times[0]} or {times[1]}. Which would you prefer?"
        return lead + f"{doc.short} has {times[0]} or {times[1]} {day}. Which would you prefer?"

    def _book(self, call: Call) -> str:
        s = call.chosen
        assert s and call.name
        if not call.calendar.is_free(s, call.now):
            call.excluded.add(s.key)
            call.chosen, call.offered = None, []
            return "Sorry, that time has just gone. " + self._next(call)
        call.calendar.book(s)
        call.booking, call.outcome, call.asked = s, "booked", "else"
        if call.name.lower() in PATIENTS and "returning patient" not in call.flags:
            call.flags.append("returning patient")
        call.event("booked", f"{s.doctor.short} · {s.short()} · {call.name}")
        call.event("sms", "Confirmation SMS queued")
        return (f"Done. {call.name} is booked with {s.doctor.short} {call.when(s)}. You'll get an SMS confirmation "
                "shortly. Is there anything else I can help with?")

    def _after_booking(self, call: Call, u: Understanding, wishes: bool, text: str) -> str:
        s = call.booking
        assert s
        if u.name and u.name != call.name:
            call.name = u.name
            call.event("updated", f"Name: {u.name}")
            call.asked = "else"
            return f"Thanks, I've updated the booking to {u.name}. Is there anything else?"
        if (wishes or u.intent == "book") and _ANOTHER.search(text):
            call.requests.append("Another appointment")
            call.event("request", "Another appointment → front desk")
            call.asked = "else"
            return ("I can make one booking per call, so I've noted that you'd like another appointment and the "
                    "front desk will call you back. Is there anything else?")
        if wishes or u.intent == "reschedule":
            call.calendar.release(s)
            call.booking, call.outcome = None, None
            call.event("changed", f"Released {s.short()} to rebook")
            self._apply(call, u)
            call.offered, call.chosen, call.wants = [], None, "book"
            return "No problem, let me change that. " + self._next(call)
        call.asked = "else"
        if u.yes:
            return "Sure, what else can I help with?"
        return "Is there anything else I can help with?"

    def _existing(self, call: Call, u: Understanding) -> str:
        verb = "cancel" if u.intent == "cancel" else "move"
        if u.name:
            call.name = call.name or u.name
        call.requests.append(f"{verb.title()} an existing appointment")
        call.event("request", f"{verb.title()} existing appointment → front desk")
        call.asked = "else"
        who = f" for {call.name}" if call.name else ""
        return (f"I can't {verb} existing appointments myself, so I've noted your request{who} and the front desk "
                f"will call you back when we open. Is there anything else I can help with?")

    def _question(self, call: Call) -> str:
        if call.asked == "offer" and call.offered:
            return f"Would {call.options()} work for you?"
        return {"doctor": "Which doctor would you like to see?", "day": "What day would suit you?",
                "name": "May I have the patient's full name?",
                "else": "Is there anything else I can help with?"}.get(call.asked, "How can I help you today?")

    def _handoff(self, call: Call, reason: str, reply: str) -> str:
        call.ended = True
        call.outcome = "booked" if call.booking else "handoff"
        call.handoff_reason = reason
        call.event("handoff", reason)
        return reply

    def _end(self, call: Call) -> str:
        call.ended = True
        if not call.outcome:
            call.outcome = ("request" if call.requests else "info" if call.topics else "incomplete")
        call.event("ended", "Caller said goodbye")
        return GOODBYE if call.booking or call.asked == "else" else "No problem. " + GOODBYE

    def _wrap_up(self, call: Call, reply: str) -> str:
        if call.booking:
            call.ended = True
            call.event("ended", "Turn limit")
            return reply.replace(" Is there anything else I can help with?", "") + " " + GOODBYE
        return self._handoff(call, "Call ran long without a booking",
                             "I'm sorry this is taking a while. I'll ask the front desk to call you back to finish "
                             "this. Thank you for calling.")


def summary(call: Call) -> dict:
    """What staff see after the call. Facts from the call only."""
    s = call.booking
    doc = DOCTORS.get((s.doctor_id if s else call.doctor_id) or "")
    parts: list[str] = []
    if s:
        parts.append(f"{call.name} booked with {s.doctor.short}, {s.short()}" +
                     (f" ({call.reason})." if call.reason else "."))
    if call.handoff_reason and call.outcome == "handoff":
        wish = ", ".join(x for x in [call.name, doc.short if doc else None, call.reason] if x)
        parts.append(f"Call back: {call.handoff_reason.lower()}." + (f" Details: {wish}." if wish else ""))
    parts += [f"Request: {r}." for r in call.requests]
    if call.topics:
        parts.append("Asked about: " + ", ".join(dict.fromkeys(call.topics)) + ".")
    if "urgent" in call.flags:
        parts.insert(0, "URGENT.")
    if "returning patient" in call.flags:
        parts.append("Returning patient.")
    secs = int(call.transcript[-1]["t"]) if call.transcript else 0
    parts.append(f"Call {secs // 60}m {secs % 60:02d}s, {call.turns} caller turn{'' if call.turns == 1 else 's'}.")
    if call.outcome == "booked" and not call.requests and not call.handoff_reason:
        parts.append("No escalation needed.")
    return {
        "outcome": call.outcome or ("in-progress" if not call.ended else "incomplete"),
        "patient": call.name,
        "doctor": doc.name if doc else None,
        "slot": s.public() if s else None,
        "reason": call.reason,
        "requests": list(call.requests),
        "flags": list(call.flags),
        "turns": call.turns,
        "text": " ".join(parts) if parts else "",
    }


def view(call: Call, reply: str | None = None) -> dict:
    """The browser's view of a call: results only — never how a turn was understood."""
    return {
        "id": call.id,
        "reply": reply,
        "ended": call.ended,
        "awaiting": call.asked,
        "offered": [s.public() for s in call.offered] if not call.booking else [],
        "booking": call.booking.public() if call.booking else None,
        "events": call.events[-40:],
        "transcript": call.transcript[-40:],
        "summary": summary(call),
    }
