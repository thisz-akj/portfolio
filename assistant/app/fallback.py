"""Offline mode (no API key, or daily limit reached): quote the closest section of the site.

It never generates text — it only returns what the site already says, so it can't make things up.
"""

from __future__ import annotations

import math
from collections import Counter

from .corpus import Corpus, Section, words
from .triage import Trace, sources_in, topic_for_path

STOP = set(
    "a an the and or of to in on for with is are was were be been it its this that what which who how why "
    "do does did can could would should you your he she they them his her their about me my i we our us "
    "tell show give any some there have has had from at by as if into more most "
    "work worked working done azad azads kumar jha anything".split()
)

# Visitor words → words the site actually uses.
SYNONYMS = {
    "chatbot": "support", "chat": "support", "helpdesk": "support", "ticket": "support",
    "pdf": "document", "pdfs": "document", "invoice": "document",
    "call": "voice", "phone": "voice",
    "dashboard": "analytics", "sql": "analytics", "data": "analytics",
    "robot": "robotics", "robots": "robotics", "slam": "slam", "lidar": "lidar",
    "hire": "contact", "email": "contact", "reach": "contact", "price": "contact", "cost": "contact", "book": "contact",
    "crm": "ops", "erp": "ops", "evals": "evaluation", "eval": "evaluation", "testing": "evaluation",
    "companies": "clients", "company": "clients", "organisations": "clients", "organizations": "clients",
    "customers": "clients", "touch": "contact", "contact": "contact", "whatsapp": "contact",
    "background": "about", "who": "about", "experience": "about",
}


def _terms(text: str) -> list[str]:
    out = []
    for w in words(text):
        if w in STOP or len(w) < 2:
            continue
        out.append(SYNONYMS.get(w, w))
    return out


def best_sections(corpus: Corpus, question: str, k: int = 1) -> list[Section]:
    sections = corpus.sections()
    q = _terms(question)
    if not q:
        return []
    df: Counter[str] = Counter()
    docs = []
    for s in sections:
        terms = set(_terms(s.title + " " + s.body))
        docs.append(terms)
        df.update(terms)
    n = len(sections)
    scored = []
    for s, terms in zip(sections, docs):
        title = set(_terms(s.title))
        score = sum(math.log(1 + n / df[t]) * (3 if t in title else 1) for t in set(q) if t in terms)
        if score > 0:
            scored.append((score, s))
    scored.sort(key=lambda x: -x[0])
    return [s for _, s in scored[:k]]


def _excerpt(body: str, limit: int = 420) -> str:
    lines = [l for l in body.splitlines() if l.strip()]
    text = ""
    for line in lines:
        if len(text) + len(line) > limit and text:
            break
        text += line + "\n"
    return text.strip()


PRICING = {"price", "pricing", "rate", "rates", "cost", "budget", "charge", "fee", "fees", "quote"}


def _contact_answer(corpus: Corpus, question: str) -> str | None:
    """Contact/pricing questions get the site's own contact line instead of a fuzzy section match."""
    raw = set(words(question))
    if not ("contact" in _terms(question) or raw & PRICING):
        return None
    line = next((l for l in corpus.knowledge.splitlines() if l.startswith("Contact:")), "")
    first = corpus.name.split()[0]
    pricing = "Pricing isn't listed on the site, so it's best to ask directly. " if raw & PRICING else ""
    return f"{pricing}{line.replace('Contact:', f'You can reach {first} by', 1).rstrip('.')}.\n\n[Contact](/contact)"


def contact_reply(corpus: Corpus, question: str) -> tuple[str, Trace] | None:
    """Deterministic answer for contact / pricing questions (used before any model call)."""
    text = _contact_answer(corpus, question)
    if not text:
        return None
    topic = "pricing" if set(words(question)) & PRICING else "contact"
    return text, Trace(topic=topic, route="handoff", sources=sources_in(text, corpus))


def reply(corpus: Corpus, question: str, reason: str = "offline") -> tuple[str, Trace]:
    """Offline answer plus its triage (decided by rules)."""
    first = corpus.name.split()[0]
    contact = _contact_answer(corpus, question)
    if contact:
        topic = "pricing" if set(words(question)) & PRICING else "contact"
        return contact, Trace(topic=topic, route="handoff", sources=sources_in(contact, corpus))
    lead = {
        "offline": "I'm in offline mode right now, so here's the closest part of the site:",
        "limit": "I've hit today's limit for live answers, so here's the closest part of the site:",
        "busy": "The AI is busy right now, so here's the closest part of the site:",
    }.get(reason, "Here's the closest part of the site:")
    hits = best_sections(corpus, question)
    if not hits:
        text = (
            f"I'm in offline mode and couldn't match that to anything on the site. "
            f"Try asking about {first}'s projects, solutions or demos — or reach out via [Contact](/contact)."
        )
        return text, Trace(topic="other", route="handoff", sources=sources_in(text, corpus))
    s = hits[0]
    link = f"\n\n[{s.title}]({s.path})" if s.path and s.path in corpus.paths else ""
    text = f"{lead}\n\n**{s.title}**\n{_excerpt(s.body)}{link}"
    return text, Trace(topic=topic_for_path(s.path), route="answered", sources=sources_in(text, corpus))


def answer(corpus: Corpus, question: str, reason: str = "offline") -> str:
    return reply(corpus, question, reason)[0]
