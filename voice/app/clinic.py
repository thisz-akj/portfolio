"""Synthetic clinic: doctors, hours, fees, FAQ and a calendar.

Busy slots come from a stable hash (same answer every run, no database); bookings made in a call live on that
call's calendar only, so visitors never see each other's bookings.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from .dates import part_of, short_date, spoken_time

TZ = ZoneInfo("Asia/Kolkata")
CLINIC_NAME = "Lotus Family Clinic"
HORIZON_DAYS = 14  # bookable window
LEAD_MINUTES = 30  # earliest slot today is at least this far from now


@dataclass(frozen=True)
class Doctor:
    id: str
    name: str
    short: str
    role: str  # how the agent introduces them
    specialty: str
    hours: dict[int, tuple[tuple[str, str], ...]]  # weekday → sessions
    slot_minutes: int
    fee: int
    aliases: tuple[str, ...]

    def works_on(self, d: date) -> bool:
        return d.weekday() in self.hours

    def days_text(self) -> str:
        """'Monday to Friday' or 'on Mondays, Wednesdays and Fridays'."""
        days = sorted(self.hours)
        names = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
        if len(days) >= 3 and days == list(range(days[0], days[-1] + 1)):
            return f"{names[days[0]]} to {names[days[-1]]}"
        plural = [names[i] + "s" for i in days]
        return "on " + (", ".join(plural[:-1]) + " and " + plural[-1] if len(plural) > 1 else plural[0])


_ALL_WEEK = range(6)
DOCTORS: dict[str, Doctor] = {d.id: d for d in [
    Doctor("rao", "Dr. Kavya Rao", "Dr. Rao", "our general physician", "general",
           {i: (("10:00", "13:00"), ("15:00", "19:00")) for i in _ALL_WEEK}, 15, 600, ("rao", "kavya", "rau", "raoh")),
    Doctor("iyer", "Dr. Sameer Iyer", "Dr. Iyer", "our skin specialist", "skin",
           {0: (("11:00", "14:00"),), 2: (("11:00", "14:00"),), 4: (("11:00", "14:00"),), 5: (("10:00", "13:00"),)},
           30, 900, ("iyer", "iyar", "ayer", "sameer")),
    Doctor("menon", "Dr. Anita Menon", "Dr. Menon", "our children's doctor", "children",
           {1: (("09:30", "12:30"), ("16:00", "18:00")), 3: (("09:30", "12:30"), ("16:00", "18:00")),
            5: (("09:30", "12:30"),)}, 15, 700, ("menon", "anita", "menen", "mena", "menan", "meenan")),
    Doctor("qureshi", "Dr. Farhan Qureshi", "Dr. Qureshi", "our dentist", "dental",
           {i: (("15:00", "19:00"),) for i in range(5)}, 30, 500, ("qureshi", "kureshi", "qureshy", "farhan")),
]}
BY_SPECIALTY = {d.specialty: d.id for d in DOCTORS.values()}

FAQ = {
    "hours": "We're open Monday to Saturday, 9:30 am to 7 pm, and closed on Sundays.",
    "address": "We're at 14 Lake View Road, Indiranagar, Bengaluru, two minutes from the metro station.",
    "fees": ("A consultation is 600 rupees with Dr. Rao, 900 with Dr. Iyer and 700 with Dr. Menon. "
             "A dental check-up with Dr. Qureshi is 500 rupees."),
    "parking": "There's free parking for about ten cars in front of the clinic.",
    "documents": "Please bring any earlier prescriptions or reports, and a photo ID.",
}

# Synthetic patients already on file (used only to mark "returning patient" in the staff summary).
PATIENTS = frozenset({"arjun mehta", "vikram singh", "meera krishnan", "kiran das"})


def doctors_menu() -> str:
    parts = [f"{d.short}, {d.role}" for d in DOCTORS.values()]
    return "; ".join(parts[:-1]) + "; and " + parts[-1]


@dataclass(frozen=True)
class Slot:
    doctor_id: str
    start: datetime

    @property
    def key(self) -> str:
        return f"{self.doctor_id}@{self.start:%Y-%m-%dT%H:%M}"

    @property
    def doctor(self) -> Doctor:
        return DOCTORS[self.doctor_id]

    def time_text(self) -> str:
        return spoken_time(self.start.hour, self.start.minute)

    def short(self) -> str:
        return f"{short_date(self.start.date())} {self.start:%H:%M}"

    def public(self) -> dict:
        return {"doctor": self.doctor.name, "start": self.start.isoformat(), "label": self.short()}


def in_part(s: Slot, part: str | None) -> bool:
    return part is None or part_of(s.start.hour, s.start.minute) == part


def _hm(v: str) -> time:
    h, m = v.split(":")
    return time(int(h), int(m))


@dataclass
class Calendar:
    busy: float = 0.55
    seed: str = "lotus-v1"
    booked: set[str] = field(default_factory=set)

    def _taken(self, key: str) -> bool:
        if key in self.booked:
            return True
        h = int(hashlib.sha1(f"{self.seed}|{key}".encode()).hexdigest()[:8], 16)
        return h / 0xFFFFFFFF < self.busy

    def day_slots(self, doc: Doctor, d: date, now: datetime) -> list[Slot]:
        """Free slots for a doctor on a day, later than now + lead time."""
        out: list[Slot] = []
        earliest = now + timedelta(minutes=LEAD_MINUTES)
        for start, end in doc.hours.get(d.weekday(), ()):
            t = datetime.combine(d, _hm(start), TZ)
            stop = datetime.combine(d, _hm(end), TZ)
            while t + timedelta(minutes=doc.slot_minutes) <= stop:
                s = Slot(doc.id, t)
                if t >= earliest and not self._taken(s.key):
                    out.append(s)
                t += timedelta(minutes=doc.slot_minutes)
        return out

    def is_free(self, s: Slot, now: datetime) -> bool:
        return s.start >= now + timedelta(minutes=LEAD_MINUTES) and not self._taken(s.key)

    def book(self, s: Slot) -> None:
        self.booked.add(s.key)

    def release(self, s: Slot) -> None:
        self.booked.discard(s.key)


@dataclass
class Found:
    slots: list[Slot]
    kind: str  # exact | near | day | other_day | none
    reason: str | None  # why the asked day/time didn't work: past | too_far | closed | off | full | taken
    asked_day: date | None


def _spread(pool: list[Slot], limit: int) -> list[Slot]:
    """First free slot plus one at least 45 minutes later, so the two options feel different."""
    if len(pool) <= 1 or limit == 1:
        return pool[:limit]
    later = [s for s in pool[1:] if s.start - pool[0].start >= timedelta(minutes=45)]
    return [pool[0], (later or pool[1:])[0]]


def _nearest(pool: list[Slot], want: time, limit: int) -> list[Slot]:
    mins = want.hour * 60 + want.minute
    best = sorted(pool, key=lambda s: abs(s.start.hour * 60 + s.start.minute - mins))[:limit]
    return sorted(best, key=lambda s: s.start)


def find_slots(cal: Calendar, doc: Doctor, now: datetime, day: date | None = None,
               at: tuple[int, int] | None = None, part: str | None = None,
               exclude: frozenset[str] | set[str] = frozenset(), limit: int = 2) -> Found:
    """Up to `limit` free slots matching the caller's wishes, else the nearest ones after them. Never invents."""
    today = now.date()
    last = today + timedelta(days=HORIZON_DAYS)
    want = time(*at) if at else None
    if want:
        part = None
    reason: str | None = None
    asked = day

    def free(d: date) -> list[Slot]:
        return [s for s in cal.day_slots(doc, d, now) if s.key not in exclude]

    if day is not None:
        if day < today:
            reason, day = "past", None
        elif day > last:
            reason, day = "too_far", None
        elif day.weekday() == 6:
            reason = "closed"
        elif not doc.works_on(day):
            reason = "off"
    if day is not None and reason is None:
        pool = free(day)
        if want:
            exact = [s for s in pool if s.start.time() == want]
            if exact:
                return Found(exact[:1], "exact", None, asked)
            near = [s for s in pool if in_part(s, part_of(want.hour))] or pool
            if near:
                return Found(_nearest(near, want, limit), "near", "taken", asked)
        else:
            pool = [s for s in pool if in_part(s, part)]
            if pool:
                return Found(_spread(pool, limit), "day", None, asked)
        reason = "full"

    start = day + timedelta(days=1) if day is not None else today
    days = [start + timedelta(days=i) for i in range((last - start).days + 1)]
    if want and asked is None:  # "anything at 5 pm" → the first day with exactly that time
        for d in days:
            exact = [s for s in free(d) if s.start.time() == want]
            if exact:
                return Found(exact[:1], "exact", None, None)
    picked: list[Slot] = []
    for d in days:  # the first day with a match; top up from the next day if it only has one
        pool = free(d)
        if want:
            pool = _nearest([s for s in pool if in_part(s, part_of(want.hour))], want, limit)
        else:
            pool = _spread([s for s in pool if in_part(s, part)], limit)
        picked += pool[: limit - len(picked)]
        if len(picked) >= limit:
            break
    if picked:
        return Found(picked, "other_day", reason, asked)
    if part or want:  # nothing in that part of the day for two weeks → any time
        f = find_slots(cal, doc, now, None, None, None, exclude, limit)
        if f.slots:
            return Found(f.slots, "other_day", reason or "full", asked)
    return Found([], "none", reason or "full", asked)
