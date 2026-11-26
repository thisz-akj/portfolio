"""Answer cache: an opening question asked before (suggested questions, demo scenarios, FAQs) is
served from memory instead of calling a model — zero tokens. Only first-turn questions are cached
(follow-ups depend on the conversation). Keys include a corpus fingerprint, so editing the site's
content invalidates every cached answer automatically."""

from __future__ import annotations

import hashlib
import re
import time
from collections import OrderedDict
from dataclasses import dataclass

_PUNCT = re.compile(r"[^\w\s₹]+")


def normalise(question: str) -> str:
    return " ".join(_PUNCT.sub(" ", question.lower()).split())


def fingerprint(*parts: str) -> str:
    return hashlib.sha1("\x00".join(parts).encode()).hexdigest()[:12]


@dataclass
class Cached:
    text: str
    trace: dict  # public trace fields (no timings)
    at: float


class AnswerCache:
    def __init__(self, max_items: int = 500, ttl_s: float = 24 * 3600, salt: str = ""):
        self._items: OrderedDict[str, Cached] = OrderedDict()
        self._max, self._ttl, self._salt = max_items, ttl_s, salt
        self.hits = 0

    def _key(self, question: str) -> str:
        return f"{self._salt}:{normalise(question)}"

    def get(self, question: str, now: float | None = None) -> Cached | None:
        now = time.time() if now is None else now
        key = self._key(question)
        item = self._items.get(key)
        if not item:
            return None
        if now - item.at > self._ttl:
            del self._items[key]
            return None
        self._items.move_to_end(key)
        self.hits += 1
        return item

    def put(self, question: str, text: str, trace: dict, now: float | None = None) -> None:
        if not normalise(question) or not text.strip():
            return
        self._items[self._key(question)] = Cached(text, trace, time.time() if now is None else now)
        self._items.move_to_end(self._key(question))
        while len(self._items) > self._max:
            self._items.popitem(last=False)
