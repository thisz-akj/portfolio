"""Day and time words → dates and clock times, by rules. The model never does date maths; it only copies words."""

from __future__ import annotations

import re
from datetime import date, timedelta

WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
_SHORT_WD = {"mon": 0, "tue": 1, "tues": 1, "wed": 2, "thu": 3, "thur": 3, "thurs": 3, "fri": 4, "sat": 5, "sun": 6}
MONTHS = ("january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
          "november", "december")
_MONTH = {m: i + 1 for i, m in enumerate(MONTHS)} | {m[:3]: i + 1 for i, m in enumerate(MONTHS)} | {"sept": 9}
_MONTH_RE = "|".join(sorted(_MONTH, key=len, reverse=True))
_WD_RE = re.compile(r"\b(" + "|".join(WEEKDAYS) + r")s?\b")
_SHORT_WD_RE = re.compile(r"\b(" + "|".join(sorted(_SHORT_WD, key=len, reverse=True)) + r")\b")
_NUMBER_WORDS = {
    "forty five": "45", "forty-five": "45", "fifteen": "15", "thirty": "30", "twelve": "12", "eleven": "11",
    "ten": "10", "nine": "9", "eight": "8", "seven": "7", "six": "6", "five": "5", "four": "4", "three": "3",
    "two": "2", "one": "1",
}
_EARLIEST = re.compile(r"\b(earliest|soonest|asap|as soon as possible|first available|next available|any ?time|"
                       r"whenever|any day|as early as possible)\b")


def _safe(y: int, m: int, d: int) -> date | None:
    try:
        return date(y, m, d)
    except ValueError:
        return None


def _not_before(today: date, month: int, day: int) -> date | None:
    """The next date with this month/day on or after today (rolls into next year)."""
    cand = _safe(today.year, month, day)
    if cand and cand < today:
        cand = _safe(today.year + 1, month, day)
    return cand


def weekday_in(text: str) -> int | None:
    t = text.lower()
    m = _WD_RE.search(t)
    if m:
        return WEEKDAYS.index(m.group(1))
    m = _SHORT_WD_RE.search(t)
    return _SHORT_WD[m.group(1)] if m else None


def parse_day(text: str, today: date) -> date | None:
    t = text.lower()
    if re.search(r"\bday after tomorrow\b", t):
        return today + timedelta(days=2)
    if re.search(r"\btomorrow\b", t):
        return today + timedelta(days=1)
    if re.search(r"\b(today|tonight)\b|\bthis (morning|afternoon|evening)\b", t):
        return today
    m = re.search(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?(?:\s+of)?\s+({_MONTH_RE})\b", t)
    if m:
        return _not_before(today, _MONTH[m.group(2)], int(m.group(1)))
    m = re.search(rf"\b({_MONTH_RE})\s+(?:the\s+)?(\d{{1,2}})(?:st|nd|rd|th)?\b", t)
    if m:
        return _not_before(today, _MONTH[m.group(1)], int(m.group(2)))
    m = re.search(r"\bthe\s+(\d{1,2})(?:st|nd|rd|th)\b", t)
    if m:
        d = int(m.group(1))
        cand = _safe(today.year, today.month, d)
        if cand is None or cand < today:
            nxt = (today.replace(day=1) + timedelta(days=32)).replace(day=1)
            cand = _safe(nxt.year, nxt.month, d)
        return cand
    wd = weekday_in(t)
    if re.search(r"\bnext week\b", t):
        monday = today + timedelta(days=7 - today.weekday())
        return monday + timedelta(days=wd or 0)
    if wd is not None:
        delta = (wd - today.weekday()) % 7
        if delta == 0 and not re.search(r"\b(this|today)\b", t):
            delta = 7
        return today + timedelta(days=delta)
    if re.search(r"\b(this |the )?weekend\b", t):
        return today + timedelta(days=(5 - today.weekday()) % 7)
    return None


def _clock(h: int, m: int, meridiem: str | None) -> tuple[int, int] | None:
    if meridiem == "pm" and h < 12:
        h += 12
    elif meridiem == "am" and h == 12:
        h = 0
    elif meridiem is None and 1 <= h <= 7:
        h += 12  # "at 4" at a clinic means 4 pm
    return (h, m) if 0 <= h < 24 and 0 <= m < 60 else None


def parse_time(text: str) -> tuple[int, int] | None:
    t = text.lower()
    t = re.sub(r"\bp\.?\s?m\.?", "pm", t)
    t = re.sub(r"\ba\.?\s?m\.?(?=\s|$|[,.!?])", "am", t)
    for word, num in _NUMBER_WORDS.items():
        t = re.sub(rf"\b{word}\b", num, t)
    if re.search(r"\b(noon|midday)\b", t):
        return (12, 0)
    m = re.search(r"\bquarter past (\d{1,2})\b", t)
    if m:
        return _clock(int(m.group(1)), 15, None)
    m = re.search(r"\bhalf past (\d{1,2})\b", t)
    if m:
        return _clock(int(m.group(1)), 30, None)
    m = re.search(r"\bquarter to (\d{1,2})\b", t)
    if m:
        return _clock(int(m.group(1)) - 1, 45, None)
    m = re.search(r"\b(\d{1,2})(?:[:.](\d{2})|\s(15|30|45|00))?\s*(am|pm)\b", t)
    if m:
        return _clock(int(m.group(1)), int(m.group(2) or m.group(3) or 0), m.group(4))
    m = re.search(r"\b(\d{1,2})[:.](\d{2})\b", t)
    if m:
        return _clock(int(m.group(1)), int(m.group(2)), None)
    m = re.search(r"\b(\d{1,2})(?:\s(15|30|45))?\s*o'?\s?clock\b", t)
    if m:
        return _clock(int(m.group(1)), int(m.group(2) or 0), None)
    m = re.search(r"\b(?:at|around|about|by|after)\s+(\d{1,2})(?:\s(15|30|45))?\b(?!\s*(?:st|nd|rd|th|of)\b)", t)
    if m and 1 <= int(m.group(1)) <= 12:
        return _clock(int(m.group(1)), int(m.group(2) or 0), None)
    return None


def parse_part(text: str) -> str | None:
    t = text.lower()
    if re.search(r"\bmorning\b|\bbefore lunch\b", t):
        return "morning"
    if re.search(r"\bafternoon\b|\bafter lunch\b", t):
        return "afternoon"
    if re.search(r"\bevening\b|\btonight\b|\bafter (work|office)\b", t):
        return "evening"
    return None


def wants_earliest(text: str) -> bool:
    return bool(_EARLIEST.search(text.lower()))


def part_of(h: int, m: int = 0) -> str:
    return "morning" if h < 12 else "afternoon" if h < 17 else "evening"


def spoken_time(h: int, m: int) -> str:
    suffix = "am" if h < 12 else "pm"
    h12 = h % 12 or 12
    return f"{h12} {suffix}" if m == 0 else f"{h12}:{m:02d} {suffix}"


def spoken_date(d: date, today: date) -> str:
    full = f"{WEEKDAYS[d.weekday()].title()} {d.day} {MONTHS[d.month - 1].title()}"
    if d == today:
        return "today"
    if d == today + timedelta(days=1):
        return f"tomorrow, {full}"
    return f"on {full}"


def short_date(d: date) -> str:
    return f"{WEEKDAYS[d.weekday()][:3].title()} {d.day} {MONTHS[d.month - 1][:3].title()}"
