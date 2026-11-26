from datetime import date

import pytest

from app.dates import parse_day, parse_part, parse_time, spoken_date, spoken_time, wants_earliest

MON = date(2026, 11, 23)


@pytest.mark.parametrize("text,expected", [
    ("tomorrow", date(2026, 11, 24)),
    ("day after tomorrow", date(2026, 11, 25)),
    ("today please", MON),
    ("Tuesday afternoon", date(2026, 11, 24)),
    ("next Friday", date(2026, 11, 27)),
    ("on Monday", date(2026, 11, 30)),  # said on a Monday → next week
    ("this Monday", MON),
    ("next week Wednesday", date(2026, 12, 2)),
    ("the 30th of December", date(2026, 12, 30)),
    ("December 3rd", date(2026, 12, 3)),
    ("25 Nov", date(2026, 11, 25)),
    ("the 2nd", date(2026, 12, 2)),
    ("5th of January", date(2027, 1, 5)),
    ("this weekend", date(2026, 11, 28)),
    ("may I come in", None),
    ("whenever", None),
])
def test_parse_day(text, expected):
    assert parse_day(text, MON) == expected


@pytest.mark.parametrize("text,expected", [
    ("4:15", (16, 15)), ("4.15 pm", (16, 15)), ("at 4", (16, 0)), ("10 am", (10, 0)), ("11:15 am", (11, 15)),
    ("quarter past four", (16, 15)), ("half past 10", (10, 30)), ("quarter to 5", (16, 45)),
    ("four fifteen pm", (16, 15)), ("5 o'clock", (17, 0)), ("noon", (12, 0)), ("15:30", (15, 30)),
    ("12 pm", (12, 0)), ("at 9", (9, 0)), ("the 25th", None), ("the first one", None), ("on the 4th", None),
])
def test_parse_time(text, expected):
    assert parse_time(text) == expected


def test_parts_and_earliest():
    assert parse_part("tomorrow morning") == "morning"
    assert parse_part("after lunch") == "afternoon"
    assert parse_part("in the evening") == "evening"
    assert parse_part("I am free") is None
    assert wants_earliest("as soon as possible") and wants_earliest("the earliest slot")
    assert not wants_earliest("Tuesday")


def test_spoken():
    assert spoken_time(16, 15) == "4:15 pm" and spoken_time(9, 0) == "9 am" and spoken_time(12, 0) == "12 pm"
    assert spoken_date(MON, MON) == "today"
    assert spoken_date(date(2026, 11, 24), MON) == "tomorrow, Tuesday 24 November"
    assert spoken_date(date(2026, 11, 26), MON) == "on Thursday 26 November"
