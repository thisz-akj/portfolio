"""BM25 over a document's chunks (section label + text). Small, dependency-free, deterministic."""

from __future__ import annotations

import math
import re
from collections import Counter

from .pdfdoc import Chunk

STOP = set(
    "a an the and or of to in on for by with is are be been was were it its this that these those as at from "
    "what which who whom when where how do does did can could should would will shall may might any all there "
    "their our your my me i we you they he she them us not no yes if than then so such into about under per".split()
)
SUFFIXES = ("ations", "ation", "ments", "ment", "ings", "ing", "als", "al", "ed", "es", "s", "e")
# A few words people use that documents phrase differently (query side only).
SYNONYMS = {
    "cancel": ["terminat"], "quit": ["terminat"], "exit": ["terminat"], "leave": ["terminat", "leave"],
    "late": ["interest", "overdue"], "due": ["payabl", "due"], "cost": ["fee", "rent", "amount"],
    "price": ["rate", "fee"], "pay": ["payabl", "payment", "pay"], "cap": ["limit", "liabil"],
    "court": ["jurisdict", "court"], "dispute": ["arbitrat", "disput"], "tax": ["gst", "igst", "cgst", "sgst"],
    "total": ["total", "amount"], "deposit": ["deposit", "secur"], "renew": ["renew", "renewal"],
    "uptime": ["availab"], "sla": ["servic", "level", "availab"], "downtime": ["availab"],
    "salary": ["pay", "compens"], "fine": ["penalt", "interest"], "breach": ["breach"],
}


def stem(tok: str) -> str:
    for suf in SUFFIXES:
        if tok.endswith(suf) and len(tok) - len(suf) >= 4:
            tok = tok[: -len(suf)]
            break
    return tok[:6]


def tokenize(text: str) -> list[str]:
    raw = re.findall(r"[a-z0-9₹%]+", text.lower().replace(",", ""))
    return [stem(t) for t in raw if t not in STOP and (len(t) > 1 or t.isdigit())]


def query_tokens(question: str) -> list[str]:
    toks = tokenize(question)
    extra = [stem(s) for t in re.findall(r"[a-z]+", question.lower()) for s in SYNONYMS.get(t, [])]
    return toks + extra


class Index:
    def __init__(self, chunks: list[Chunk], k1: float = 1.4, b: float = 0.7):
        self.chunks = chunks
        self.docs = [tokenize(f"{c.section} {c.text}") for c in chunks]
        self.tf = [Counter(d) for d in self.docs]
        self.avg = sum(map(len, self.docs)) / max(1, len(self.docs))
        df = Counter(t for d in self.docs for t in set(d))
        n = len(self.docs)
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}
        self.k1, self.b = k1, b

    def scores(self, question: str) -> list[float]:
        q = query_tokens(question)
        out = []
        for tf, doc in zip(self.tf, self.docs):
            s = 0.0
            for t in q:
                f = tf.get(t)
                if f:
                    s += self.idf[t] * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * len(doc) / self.avg))
            out.append(s)
        return out

    def coverage(self, question: str, chunk_index: int) -> float:
        """Share of the question's own terms found in one chunk (synonyms count as a match for their word)."""
        terms = set(tokenize(question))
        if not terms:
            return 0.0
        doc = self.tf[chunk_index]
        hits = 0
        for t in terms:
            alts = [t, *(stem(s) for w, ss in SYNONYMS.items() if stem(w) == t for s in ss)]
            hits += any(a in doc for a in alts)
        return hits / len(terms)

    def top(self, question: str, k: int = 5) -> list[tuple[Chunk, float]]:
        ranked = sorted(zip(self.chunks, self.scores(question)), key=lambda x: -x[1])
        return [(c, s) for c, s in ranked[:k] if s > 0]
