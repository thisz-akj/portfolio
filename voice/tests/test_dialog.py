import pytest

from app.dialog import Engine, summary, view
from app.llm import ModelBusy
from app.nlu import Context, DailyBudget, Understander, rules
from app.scenarios import SCENARIOS, check, run

from .conftest import NOW, FakeCompleter, model_reply, rules_engine

pytestmark = pytest.mark.anyio


@pytest.mark.parametrize("sc", [s for s in SCENARIOS if s["rules_ok"]], ids=lambda s: s["id"])
async def test_golden_rules_only(sc):
    call, replies = await run(rules_engine(), sc, NOW)
    assert check(call, replies, sc) == [], replies


async def test_model_scenarios_degrade_safely_without_model():
    """Without a model the tricky calls may not finish, but must never book something nobody asked for."""
    for sc in [s for s in SCENARIOS if not s["rules_ok"]]:
        call, _ = await run(rules_engine(), sc, NOW)
        if call.booking:
            assert call.booking.doctor_id == sc["expect"]["doctor"] or sc["id"] == "misheard-doctor"


def test_rules_read_the_showcase_line():
    u = rules("Hi, I need to see Dr. Rao for a follow-up, ideally Tuesday afternoon. It's Arjun Mehta.",
              Context("open", [], NOW.date()))
    assert (u.doctor_id, u.part, u.name, u.reason, u.unsure) == ("rao", "afternoon", "Arjun Mehta", "follow-up", False)


@pytest.mark.parametrize("text", ["the patient will be suresh kumar, dentist monday", "I can't do Tuesday, Wednesday works",
                                  "I want to see doctor row"])
def test_rules_flag_what_they_cannot_settle(text):
    assert rules(text, Context("open", [], NOW.date())).unsure


async def test_model_used_only_when_rules_cannot_tell():
    fake = FakeCompleter(model_reply(intent="book", doctor="rao", day_text="Thursday"))
    engine = Engine(Understander(fake, DailyBudget(10)))
    call, _ = engine.start("c", NOW)
    await engine.turn(call, "I'd like Dr. Rao on Wednesday")  # rules are enough
    assert fake.calls == 0
    await engine.turn(call, "I want to see doctor row on thursday")
    assert fake.calls == 1
    assert call.doctor_id == "rao" and call.day.isoformat() == "2026-11-26"
    assert "Thursday" in fake.prompts[0] or "thursday" in fake.prompts[0]


async def test_model_busy_and_budget_fall_back_to_rules():
    engine = Engine(Understander(FakeCompleter(ModelBusy("429")), DailyBudget(10)))
    call, _ = engine.start("c", NOW)
    reply = await engine.turn(call, "I want to see doctor row")
    assert "Which doctor" in reply and not call.ended
    fake = FakeCompleter(model_reply(intent="book"))
    engine = Engine(Understander(fake, DailyBudget(0)))
    call, _ = engine.start("c", NOW)
    await engine.turn(call, "I want to see doctor row")
    assert fake.calls == 0


async def test_model_day_words_are_parsed_by_rules_not_trusted():
    fake = FakeCompleter(model_reply(intent="book", doctor="rao", day_text="2026-01-01", name="Robert'); DROP"))
    engine = Engine(Understander(fake, DailyBudget(10)))
    call, _ = engine.start("c", NOW)
    await engine.turn(call, "uh the doctor row maybe some day")
    assert call.day is None and call.name is None


async def test_never_offers_more_than_two_and_reads_back_booking():
    engine = rules_engine()
    call, _ = engine.start("c", NOW)
    r = await engine.turn(call, "Dr. Rao on Wednesday please, it's Kiran Das")
    assert len(call.offered) == 2 and all(s.time_text() in r for s in call.offered)
    r = await engine.turn(call, "the first one")
    assert call.booking and "Kiran Das" in r and call.booking.time_text() in r


async def test_turn_limit_hands_over():
    engine = Engine(Understander(None, DailyBudget(0)), max_turns=3)
    call, _ = engine.start("c", NOW)
    for line in ["Dr. Rao", "what are your timings", "where are you located"]:
        reply = await engine.turn(call, line)
    assert call.ended and call.outcome == "handoff" and "call you back" in reply


async def test_view_has_results_only():
    engine = rules_engine()
    call, greeting = engine.start("c", NOW)
    await engine.turn(call, "Dr. Rao on Wednesday please, it's Kiran Das")
    await engine.turn(call, "first")
    v = view(call, "x")
    text = str(v).lower()
    for secret in ("rules", "model", "source", "prompt", "groq", "unsure"):
        assert secret not in text, secret
    assert v["booking"] and summary(call)["outcome"] == "booked"
    assert "No escalation needed." in v["summary"]["text"]
