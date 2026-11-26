import asyncio

from app.ask import NOT_FOUND, Asker, DailyBudget
from app.llm import ModelBusy
from app.search import Index
from app.store import Store
from tests.conftest import ROOT, FakeCompleter

STORE = Store(ROOT / "samples")


def run(coro):
    return asyncio.run(coro)


def doc(doc_id="msa-kestrel-v1"):
    return STORE.get(doc_id)


def test_every_example_resolves_with_highlights():
    for d in STORE.samples():
        asker = Asker(None, DailyBudget(0))
        for i, ex in enumerate(d.examples):
            res = asker.example(d, i)
            if ex.answer is None:
                assert res["mode"] == "not_found"
            else:
                assert res["citations"] and all(c["rects"] for c in res["citations"]), (d.id, ex.question)


def test_retrieval_finds_the_right_clause():
    idx = doc().index
    top = [c.section for c, _ in idx.top("how much notice to cancel the contract?", k=3)]
    assert "11. Termination" in top
    top = [c.section for c, _ in idx.top("what is the liability cap", k=2)]
    assert top[0] == "10. Limitation of Liability"


def test_model_answer_keeps_only_verified_quotes():
    fake = FakeCompleter({
        "found": True,
        "answer": "Either party can end it on 60 days' notice [1] and it is governed by Swiss law [2].",
        "citations": [
            {"chunk": "c24", "quote": "terminate this Agreement for convenience upon sixty (60) days' written notice"},
            {"chunk": "c26", "quote": "governed by the laws of Switzerland"},
        ],
    })
    res = run(Asker(fake, DailyBudget(5)).ask(doc(), "notice period?", []))
    assert res["mode"] == "answer"
    assert [c["section"] for c in res["citations"]] == ["11. Termination"]
    assert "[1]" in res["answer"] and "[2]" not in res["answer"]


def test_answer_with_no_verifiable_quote_becomes_not_found():
    fake = FakeCompleter({"found": True, "answer": "It renews every 5 years [1].",
                          "citations": [{"chunk": "c8", "quote": "renews every five years automatically forever"}]})
    res = run(Asker(fake, DailyBudget(5)).ask(doc(), "renewal?", []))
    assert res == {**res, "mode": "not_found", "answer": NOT_FOUND, "citations": []}


def test_cache_examples_budget_and_busy_fallbacks():
    reply = {"found": True, "answer": "60 days [1].",
             "citations": [{"chunk": "c24", "quote": "upon sixty (60) days' written notice"}]}
    fake = FakeCompleter(reply)
    asker = Asker(fake, DailyBudget(1))
    d = doc()
    first = run(asker.ask(d, "Termination notice?", []))
    again = run(asker.ask(d, "termination notice", []))
    assert fake.calls == 1 and again["cached"] and again["answer"] == first["answer"]
    # pre-written example question → no model call
    ex = run(asker.ask(d, d.examples[0].question, []))
    assert ex["mode"] == "example" and fake.calls == 1
    # budget spent → closest passages, no call
    res = run(asker.ask(d, "Who owns the deliverables?", []))
    assert res["mode"] == "passages" and fake.calls == 1 and res["citations"]
    # model busy → passages
    busy = run(Asker(FakeCompleter(ModelBusy("429")), DailyBudget(5)).ask(d, "governing law?", []))
    assert busy["mode"] == "passages" and busy.get("busy")


def test_short_documents_are_sent_whole_long_ones_retrieved():
    asker = Asker(None, DailyBudget(0))
    inv = doc("invoice-northwind-0418")
    assert asker.context(inv, "total?", []) == inv.parsed.chunks
    msa = doc()
    ctx = asker.context(msa, "liability cap", [])
    assert 0 < len(ctx) <= 5 and sum(len(c.text) for c in ctx) <= 3400


def test_ai_retrieval_takes_over_when_keywords_are_weak():
    """Paraphrase with no shared words → the AI picks the clause from the outline, then answers from it."""
    route = {"passages": ["c24"], "searches": ["termination for convenience"]}
    answer = {"found": True, "answer": "Yes, on 60 days' notice [1].",
              "citations": [{"chunk": "c24", "quote": "terminate this Agreement for convenience upon sixty (60) days' written notice"}]}
    fake = FakeCompleter(answer, by_name={"route": route})
    asker = Asker(fake, DailyBudget(5))
    d = doc()
    passages, how = asker.plan(d, "Can we walk away early without a reason?", [])
    assert how == "ai"
    res = run(asker.ask(d, "Can we walk away early without a reason?", []))
    assert fake.names == ["route", "answer"] and asker.last_route == "ai"
    assert res["mode"] == "answer" and res["citations"][0]["section"] == "11. Termination"
    assert "[c24] p2 11. Termination" in fake.prompts[0]  # the outline the AI chose from
    assert "[c24]" in fake.prompts[1]  # its pick reached the answer step
    assert "route" not in res and "ai" not in res.values()  # never exposed


def test_ai_retrieval_finding_nothing_means_not_found_without_an_answer_call():
    fake = FakeCompleter({"found": True, "answer": "x", "citations": []}, by_name={"route": {"passages": [], "searches": []}})
    res = run(Asker(fake, DailyBudget(5)).ask(doc(), "What's the CEO's favourite cricket team?", []))
    assert res["mode"] == "not_found" and fake.names == ["route"]


def test_confident_keyword_match_skips_ai_retrieval():
    fake = FakeCompleter({"found": True, "answer": "1.5% per month [1].",
                          "citations": [{"chunk": "c13", "quote": "one and a half percent (1.5%) per month"}]})
    asker = Asker(fake, DailyBudget(5))
    res = run(asker.ask(doc(), "What interest is charged on late payments?", []))
    assert fake.names == ["answer"] and asker.last_route == "keyword" and res["mode"] == "answer"


def test_outline_stays_small():
    from app.ask import OUTLINE_CHARS, outline_prompt
    text = outline_prompt(doc(), "anything?")
    assert len(text) < OUTLINE_CHARS + 300 and "[c1]" in text and "[c30]" in text


def test_prompt_labels_passages_and_model_not_found_is_respected():
    fake = FakeCompleter({"found": False, "answer": "The document doesn't cover that.", "citations": []})
    res = run(Asker(fake, DailyBudget(5)).ask(doc(), "What fees apply to the Statement of Work?", []))
    assert res["mode"] == "not_found" and res["citations"] == []
    assert "[c" in fake.prompts[0] and "Question: What fees apply to the Statement of Work?" in fake.prompts[0]


def test_follow_up_keeps_its_own_clause():
    asker = Asker(None, DailyBudget(0))
    history = [{"role": "user", "content": "What's the termination notice period, and does it auto-renew?"},
               {"role": "assistant", "content": "60 days."}]
    ctx = asker.context(doc(), "Who owns the deliverables once paid?", history)
    assert "7. Intellectual Property" in {c.section for c in ctx}


def test_routes_whole_keyword_and_ai():
    asker = Asker(None, DailyBudget(0))
    d = doc()
    assert asker.plan(doc("invoice-northwind-0418"), "total?", [])[1] == "whole"
    assert asker.plan(d, "What interest is charged on late payments?", [])[1] == "keyword"
    # "provider" is everywhere, "coffee" nowhere → weak match → AI retrieval
    assert asker.plan(d, "Does the provider supply coffee machines?", [])[1] == "ai"
    # business synonyms bridge wording without AI: "uptime" finds the availability clause
    ctx, how = asker.plan(d, "What uptime does the provider commit to?", [])
    assert how == "keyword" and "4. Service Levels" in {c.section for c in ctx}


def test_quoting_a_calculated_figure_falls_back_to_the_named_clause():
    d = STORE.get("lease-indigo-park")
    c = next(c for c in d.parsed.chunks if c.text.startswith("3.2"))
    fake = FakeCompleter({"found": True, "answer": "₹2,03,962 a month in year 3 [1].",
                          "citations": [{"chunk": c.id, "quote": "Y3 ₹2,03,962"}]})
    res = run(Asker(fake, DailyBudget(5)).ask(d, "Rent in year three?", []))
    assert res["mode"] == "answer" and res["citations"][0]["chunk"] == c.id
    assert "Calculated figures" in fake.prompts[0] and "Y3 ₹2,03,962" in fake.prompts[0]
    # an invented quote that is neither in the PDF nor a calculated figure is still rejected
    bad = FakeCompleter({"found": True, "answer": "x [1]", "citations": [{"chunk": c.id, "quote": "rent doubles every year forever"}]})
    assert run(Asker(bad, DailyBudget(5)).ask(d, "Rent in year three?", []))["mode"] == "not_found"
