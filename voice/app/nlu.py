"""Caller words → fields. Rules first (0 tokens); the model only when rules find nothing or the words are tricky.

The model never sees the calendar's free slots beyond the ones on offer and never computes dates: it copies the
caller's day/time words, which `dates.py` turns into dates.
"""

from __future__ import annotations

import logging
import re
import time as _time
from dataclasses import dataclass, field
from datetime import date

from .clinic import BY_SPECIALTY, DOCTORS, Slot
from .dates import (WEEKDAYS, MONTHS, parse_day, parse_part, parse_time, short_date, spoken_time,
                    wants_earliest)
from .llm import Completer, ModelBusy

log = logging.getLogger("voice")
PROMPT_VERSION = "understand-v1"

INTENTS = ("book", "cancel", "reschedule", "question", "human", "emergency", "yes", "no", "choose", "info",
           "goodbye", "unclear")
TOPICS = ("hours", "address", "fees", "parking", "documents")


@dataclass
class Understanding:
    intent: str | None = None  # book | cancel | reschedule | human | emergency | goodbye
    yes: bool = False
    no: bool = False
    choice: int | None = None  # index into the slots on offer
    name: str | None = None
    doctor_id: str | None = None
    specialty: str | None = None
    day: date | None = None
    at: tuple[int, int] | None = None
    part: str | None = None
    earliest: bool = False
    topic: str | None = None
    reason: str | None = None
    unsure: bool = False  # rules saw something they can't settle (conflict, negation) → ask the model
    source: str = "rules"  # internal only, never sent to the browser

    @property
    def useful(self) -> bool:
        return any([self.intent, self.yes, self.no, self.choice is not None, self.name, self.doctor_id,
                    self.specialty, self.day, self.at, self.part, self.earliest, self.topic])

    def found(self) -> list[str]:
        """Short human-readable list of what was understood (for the call timeline)."""
        out = []
        if self.name:
            out.append(f"Name: {self.name}")
        if self.doctor_id:
            out.append(f"Doctor: {DOCTORS[self.doctor_id].short}")
        elif self.specialty:
            out.append(f"Needs: {self.specialty}")
        if self.reason:
            out.append(f"Visit: {self.reason}")
        if self.day:
            out.append(f"Day: {short_date(self.day)}")
        if self.at:
            out.append(f"Time: {spoken_time(*self.at)}")
        elif self.part:
            out.append(f"Pref: {self.part}")
        if self.earliest:
            out.append("Pref: earliest")
        return out


@dataclass
class Context:
    asked: str  # what the agent last asked: open | doctor | day | offer | name | else
    offered: list[Slot]
    today: date


# --- rules -----------------------------------------------------------------------------------------------------

_EMERGENCY = re.compile(
    r"\b(chest pain|heart attack|can'?t breathe|cannot breathe|not breathing|trouble breathing|unconscious|"
    r"fainted|passed out|bleeding (heavily|a lot)|heavy bleeding|severe bleeding|seizure|fits|stroke|"
    r"emergency|accident|overdose|poison(ed|ing)?)\b")
_HUMAN = re.compile(r"\b(human|real person|a person|someone|somebody|receptionist|front desk|operator|"
                    r"staff member|talk to (a|the) (doctor|nurse))\b")
_HUMAN_VERB = re.compile(r"\b(speak|talk|connect|transfer|put me through)\b")
_CANCEL = re.compile(r"\bcancel")
_RESCHEDULE = re.compile(r"\b(reschedule|postpone|prepone|move my|change my (appointment|booking|slot))\b")
_BOOK = re.compile(r"\b(appointment|book|booking|consult|consultation|see (the |a )?(doctor|dr|dentist)|"
                   r"slot|available|availability|check-?up|visit)\b")
_GOODBYE = re.compile(r"\b(bye|goodbye|that'?s all|that is all|nothing else|that'?s it|no thanks|no thank you)\b")
_YES = re.compile(r"^(yes|yeah|yep|yup|ya|sure|correct|right|ok|okay|perfect|great|fine|please do|go ahead|"
                  r"sounds good|that works|that'?s fine|that'?s right|book it|do it|alright|all right)\b")
_NO = re.compile(r"^(no|nope|nah|not really|neither|none of (them|those)|wrong|that'?s wrong|incorrect)\b")
_NEGATION = re.compile(r"\b(not|can'?t|cannot|don'?t|won'?t|isn'?t|except|but not)\b")
_TOPICS = {
    "hours": re.compile(r"\b(opening|closing) (hours|time)|\bwhen (are|do) you (open|close)|\btimings?\b|"
                        r"\bclinic hours\b|\bwhat time do you\b|\bare you open\b|\bopen on sundays?\b"),
    "address": re.compile(r"\b(address|where are you|where is the clinic|located|location|directions|"
                          r"how do i (get|reach))\b"),
    "fees": re.compile(r"\b(fee|fees|cost|costs|charge|charges|how much|price)\b"),
    "parking": re.compile(r"\bpark(ing)?\b"),
    "documents": re.compile(r"\b(what should i bring|what do i bring|documents|bring anything|bring my)\b"),
}
_NAME_CUE = re.compile(r"\b(name|patient (is|will be|'s)|called)\b")
_DOCTOR_CUE = re.compile(r"\b(?:dr|doctor)\.?\s+([a-z]+)")
_NOT_DOCTOR = {"for", "who", "on", "at", "in", "the", "please", "appointment", "tomorrow", "today", "and", "to",
               "is", "available", "about", "next", "this", "as", "soon", "any", "anyone", "there", "i", "my"}
_SPECIALTY_WORDS = {
    "general": r"fever|cough|cold|flu|general physician|physician|\bgp\b|blood pressure|\bbp\b|sugar|diabetes|"
               r"stomach|headache|body ache|infection",
    "skin": r"skin|rash|acne|pimples?|derma\w*|hair ?fall|itch\w*|eczema",
    "children": r"\bchild\b|children|\bkids?\b|baby|toddler|my son|my daughter|paediatric\w*|pediatric\w*|"
                r"vaccinations?|vaccines?",
    "dental": r"tooth|teeth|toothache|dental|dentist|cavity|gums?|root canal|braces",
}
_REASONS = (
    (r"follow[- ]?up", "follow-up"), (r"first (visit|time)|new patient", "new consultation"),
    (r"vaccinat\w+|vaccine", "vaccination"), (r"check-?up", "check-up"), (r"root canal", "root canal"),
    (r"toothache|tooth pain", "toothache"), (r"rash", "rash"), (r"acne|pimples?", "acne"), (r"fever", "fever"),
    (r"cough", "cough"), (r"hair ?fall", "hair fall"),
)
_NAME_LEAD = re.compile(
    r"\b(?:my name is|my name's|name is|this is|it's|it is|i am|i'm|patient is|patient's name is|"
    r"(?:my|for my) (?:son|daughter|child|wife|husband|mother|father|mom|dad)(?:'s name is| is| called| named)?)\s+"
    r"([A-Za-z][a-z'’-]+(?:\s+[A-Za-z][a-z'’-]+){0,2})", re.I)
_FOR_NAME = re.compile(r"\bfor\s+([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){0,2})")  # "…, for Kiran Das" (needs capitals)
_NOT_NAME = {"dr", "doctor", "calling", "looking", "here", "fine", "good", "not", "sorry", "just", "trying",
             "a", "an", "the", "for", "to", "about", "okay", "ok", "yes", "no", "available", "free", "busy",
             "booked", "with", "on", "at", "in", "and", "need", "want", "would", "sure", "actually", "hoping",
             "wondering", "ringing", "after", "regarding", "having", "going", "feeling", "still", "really",
             "also", "my", "your", "his", "her", "is", "was", "be", "it", "that", "this", "i", "we", "he", "she",
             "they", "has", "had", "have", "hello", "hi", "hey", "thanks", "thank", "please", "um", "uh", "hmm",
             "what", "sorry", "neither", "both", "first", "second", "morning", "afternoon", "evening", "today",
             "tomorrow", "next", "dentist", "skin", "child", "son", "daughter", "fever", "appointment", "bye",
             "great", "perfect", "right", "correct", "nope", "yeah", "yep", "cancel", "book"} \
    | set(WEEKDAYS) | set(MONTHS)
_FILLERS = re.compile(r"^(?:(?:yes|yeah|sure|ok|okay|so|um+|uh+|hi|hello|it's|its|it is|this is|my name is|"
                      r"name is|i'm|i am|the name is|patient is|the patient is)[,.]?\s+)+", re.I)


_TITLES = {"mr", "mrs", "ms", "miss", "sgt", "sergeant", "shri", "smt", "sir", "madam", "master", "baby"}


def _clean_name(raw: str) -> str | None:
    words = []
    parts = raw.replace("’", "'").split()
    while parts and parts[0].lower().strip(",.") in _TITLES:  # "Sgt. Mehta" (a misheard first name), "Mr. Das"
        parts = parts[1:]
    for w in parts:
        if w.lower().strip(",.") in _NOT_NAME:
            break
        words.append(w.strip(",.").capitalize())
    return " ".join(words[:3]) or None


def extract_name(text: str, asked_name: bool, bare_ok: bool = True) -> str | None:
    """'my name is …', 'it's …'; a bare 1-3 word reply when we asked for a name; or bare Capitalised words."""
    for m in (_NAME_LEAD.search(text), _FOR_NAME.search(text)):
        name = _clean_name(m.group(1)) if m else None
        if name:
            return name
    short = _FILLERS.sub("", text.strip()).strip(" .,!?")
    words = short.split()
    if not 1 <= len(words) <= 3 or not all(re.fullmatch(r"[A-Za-z][A-Za-z'’-]*", w) for w in words):
        return None
    if any(w.lower() in _NOT_NAME for w in words):
        return None
    if asked_name or (bare_ok and all(w[0].isupper() for w in words)):
        return _clean_name(short)
    return None


def _doctor(t: str, name: str | None) -> str | None:
    """A doctor's name; one that's part of the patient's name ("Lakshmi Rao") counts only after 'Dr'/'doctor'."""
    in_name = set((name or "").lower().split())
    for d in DOCTORS.values():
        for alias in d.aliases:
            if not re.search(rf"\b{alias}\b", t):
                continue
            if alias not in in_name or re.search(rf"\b(dr|doctor)\.?\s+{alias}\b", t):
                return d.id
    return None


def _choice(t: str, at: tuple[int, int] | None, day: date | None, offered: list[Slot]) -> int | None:
    if not offered:
        return None
    hits = [i for i, s in enumerate(offered)
            if (at is None or (s.start.hour, s.start.minute) == at) and (day is None or s.start.date() == day)]
    if (at or day) and len(hits) == 1:
        return hits[0]
    if re.search(r"\b(first|earlier|former|1st|either|any of them|whichever)\b", t):
        return 0
    if len(offered) > 1 and re.search(r"\b(second|later|latter|last|2nd|other one)\b", t):
        return 1
    return None


def rules(text: str, ctx: Context) -> Understanding:
    t = " ".join(text.lower().replace("’", "'").split())
    u = Understanding()
    if _EMERGENCY.search(t):
        u.intent = "emergency"
        return u
    if _HUMAN.search(t) and (_HUMAN_VERB.search(t) or len(t.split()) <= 4):
        u.intent = "human"
        return u
    u.yes, u.no = bool(_YES.search(t)), bool(_NO.search(t))
    if _CANCEL.search(t):
        u.intent = "cancel"
    elif _RESCHEDULE.search(t):
        u.intent = "reschedule"
    elif _BOOK.search(t):
        u.intent = "book"
    elif _GOODBYE.search(t):
        u.intent = "goodbye"
    for topic, rx in _TOPICS.items():
        if rx.search(t):
            u.topic = topic
            break
    u.name = extract_name(text, ctx.asked == "name", bare_ok=ctx.asked != "doctor")
    u.doctor_id = _doctor(t, u.name)
    specs = [s for s, rx in _SPECIALTY_WORDS.items() if re.search(rx, t)]
    if "children" in specs and "dental" not in specs and "skin" not in specs:
        specs = ["children"]  # "my son has a fever" → children's doctor
    if len(specs) == 1:
        u.specialty = specs[0]
    elif len(specs) > 1 and not u.doctor_id:
        u.unsure = True
    for rx, label in _REASONS:
        if re.search(rx, t):
            u.reason = label
            break
    u.day = parse_day(t, ctx.today)
    u.at = parse_time(t)
    u.part = parse_part(t)
    u.earliest = wants_earliest(t)
    u.choice = _choice(t, u.at, u.day, ctx.offered) if ctx.asked == "offer" else None
    if u.choice is not None:
        u.at = u.day = None  # the pick, not a new wish
    if _NEGATION.search(t) and (u.day or u.at or u.part) and not u.yes:
        u.unsure = True  # "not Tuesday", "can't do mornings"
    if not u.name and ctx.asked != "name" and _NAME_CUE.search(t):
        u.unsure = True  # "the patient will be suresh kumar"
    m = _DOCTOR_CUE.search(t)
    if not u.doctor_id and m and m.group(1) not in _NOT_DOCTOR:
        u.unsure = True  # "doctor row" (misheard name)
    return u


# --- model -----------------------------------------------------------------------------------------------------

def _enum(values: tuple[str, ...]) -> dict:
    return {"type": "string", "enum": ["", *values]}


SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["intent", "name", "doctor", "specialty", "day_text", "time_text", "part_of_day", "earliest",
                 "choice", "topic", "reason"],
    "properties": {
        "intent": {"type": "string", "enum": list(INTENTS)},
        "name": {"type": "string"},
        "doctor": _enum(tuple(DOCTORS)),
        "specialty": _enum(tuple(BY_SPECIALTY)),
        "day_text": {"type": "string"},
        "time_text": {"type": "string"},
        "part_of_day": _enum(("morning", "afternoon", "evening")),
        "earliest": {"type": "boolean"},
        "choice": {"type": "integer", "enum": [0, 1, 2]},
        "topic": _enum(TOPICS),
        "reason": {"type": "string"},
    },
}

_DOCS = "; ".join(f"{d.id} = {d.name} ({d.specialty})" for d in DOCTORS.values())
SYSTEM = f"""You read one thing a caller said to a clinic's phone assistant and return it as JSON.
Fill a field only if the caller said it in this utterance; otherwise use "" (earliest false, choice 0).
- intent: book (new appointment), cancel or reschedule (an existing one), question (about the clinic; set topic), \
human (wants a person), emergency (urgent symptoms: chest pain, breathing trouble, heavy bleeding, unconscious), \
yes or no (answering the assistant's question), choose (picks an offered slot; set choice to 1 or 2), \
info (gives details), goodbye, unclear.
- doctor: {_DOCS}. Speech-to-text may misspell names; pick the closest. specialty: only if no doctor is named.
- name: the patient's name exactly as said.
- day_text / time_text: copy the caller's own words for the day or time they want ("next Tuesday", "quarter past \
four"). Never work out dates. If they say a day or time they can NOT do, leave it "".
- earliest: true if they want the first available time. reason: why they're coming, in 1-3 words.
- If the caller corrects something ("actually Wednesday"), return only the new value."""

_ASKED = {
    "open": "How can I help?", "doctor": "Which doctor would you like to see?", "day": "What day suits you?",
    "offer": "Which of these slots works?", "name": "What's the patient's name?",
    "else": "Is there anything else I can help with?",
}


def user_prompt(text: str, ctx: Context) -> str:
    lines = [f"Today: {WEEKDAYS[ctx.today.weekday()].title()} {ctx.today.isoformat()}",
             f"Assistant just asked: {_ASKED.get(ctx.asked, 'How can I help?')}"]
    if ctx.asked == "offer" and ctx.offered:
        lines.append("Slots on offer: " + "  ".join(f"{i + 1}) {s.short()}" for i, s in enumerate(ctx.offered)))
    lines.append(f'Caller said: "{text}"')
    return "\n".join(lines)


def from_model(raw: dict, ctx: Context) -> Understanding:
    u = Understanding(source="model")
    intent = raw.get("intent", "")
    if intent in ("book", "cancel", "reschedule", "human", "emergency", "goodbye"):
        u.intent = intent
    u.yes, u.no = intent == "yes", intent == "no"
    choice = raw.get("choice") or 0
    if intent == "choose" and 1 <= choice <= len(ctx.offered):
        u.choice = choice - 1
    name = (raw.get("name") or "").strip()
    u.name = _clean_name(name) if name and re.fullmatch(r"[A-Za-z][A-Za-z .'’-]{0,60}", name) else None
    u.doctor_id = raw.get("doctor") if raw.get("doctor") in DOCTORS else None
    u.specialty = raw.get("specialty") if raw.get("specialty") in BY_SPECIALTY else None
    if raw.get("day_text"):
        u.day = parse_day(raw["day_text"], ctx.today)
    if raw.get("time_text"):
        u.at = parse_time(raw["time_text"])
        u.part = u.part or parse_part(raw["time_text"])
    if raw.get("part_of_day") in ("morning", "afternoon", "evening"):
        u.part = raw["part_of_day"]
    u.earliest = bool(raw.get("earliest"))
    u.topic = raw.get("topic") if raw.get("topic") in TOPICS else None
    reason = (raw.get("reason") or "").strip().lower()
    u.reason = reason[:40] or None
    return u


class DailyBudget:
    def __init__(self, limit: int):
        self.limit, self._day, self._used = limit, "", 0

    def take(self) -> bool:
        day = _time.strftime("%Y-%m-%d")
        if day != self._day:
            self._day, self._used = day, 0
        if self._used >= self.limit:
            return False
        self._used += 1
        return True


@dataclass
class Understander:
    completer: Completer | None
    budget: DailyBudget
    model_calls: int = field(default=0)

    async def understand(self, text: str, ctx: Context) -> Understanding:
        u = rules(text, ctx)
        if u.intent == "emergency" or (u.useful and not u.unsure):
            return u
        if not self.completer or len(re.findall(r"[A-Za-z]{2,}", text)) < 2 or not self.budget.take():
            return u
        try:
            raw = await self.completer.complete(SYSTEM, user_prompt(text, ctx), SCHEMA, "understand", 250)
        except ModelBusy as err:
            log.warning("understanding fell back to rules: %s", err)
            return u
        self.model_calls += 1
        m = from_model(raw, ctx)
        if not m.reason:
            m.reason = u.reason
        return m
