from datetime import date, datetime, timedelta

from app.clinic import DOCTORS, TZ, Calendar, find_slots

from .conftest import NOW


def _within_hours(s) -> bool:
    doc = s.doctor
    for start, end in doc.hours.get(s.start.weekday(), ()):
        lo = datetime.combine(s.start.date(), datetime.strptime(start, "%H:%M").time(), TZ)
        hi = datetime.combine(s.start.date(), datetime.strptime(end, "%H:%M").time(), TZ)
        if lo <= s.start and s.start + timedelta(minutes=doc.slot_minutes) <= hi:
            return True
    return False


def test_every_offer_is_free_and_real():
    cal = Calendar()
    for doc in DOCTORS.values():
        for offset in range(-2, 18):
            day = NOW.date() + timedelta(days=offset)
            for at in (None, (10, 0), (16, 15), (17, 0), (9, 0)):
                for part in (None, "morning", "afternoon", "evening"):
                    found = find_slots(cal, doc, NOW, day, at, part)
                    for s in found.slots:
                        assert not cal._taken(s.key), s.key
                        assert _within_hours(s), s.key
                        assert s.start >= NOW + timedelta(minutes=30)
                        assert s.start.date() <= NOW.date() + timedelta(days=14)
                        assert s.start.weekday() != 6


def test_reasons():
    cal = Calendar()
    rao, iyer = DOCTORS["rao"], DOCTORS["iyer"]
    assert find_slots(cal, rao, NOW, date(2026, 11, 29)).reason == "closed"
    assert find_slots(cal, iyer, NOW, date(2026, 11, 24)).reason == "off"
    assert find_slots(cal, rao, NOW, date(2026, 11, 20)).reason == "past"
    assert find_slots(cal, rao, NOW, date(2027, 1, 20)).reason == "too_far"


def test_booked_slot_is_not_offered_again():
    cal = Calendar()
    rao = DOCTORS["rao"]
    first = find_slots(cal, rao, NOW, date(2026, 11, 25)).slots[0]
    cal.book(first)
    assert first not in find_slots(cal, rao, NOW, date(2026, 11, 25)).slots
    assert not cal.is_free(first, NOW)
    cal.release(first)
    assert cal.is_free(first, NOW)


def test_exclusions_and_two_options():
    cal = Calendar()
    rao = DOCTORS["rao"]
    a = find_slots(cal, rao, NOW, date(2026, 11, 25))
    assert len(a.slots) == 2 and a.slots[1].start - a.slots[0].start >= timedelta(minutes=45)
    b = find_slots(cal, rao, NOW, date(2026, 11, 25), exclude={s.key for s in a.slots})
    assert not set(s.key for s in a.slots) & set(s.key for s in b.slots)
