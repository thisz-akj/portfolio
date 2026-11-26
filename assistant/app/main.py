"""FastAPI app (run with `uvicorn app.main:create_app --factory`): POST /chat streams NDJSON events, GET /health reports mode.

Events (one JSON object per line):
  {"type": "meta", "mode": "live" | "offline" | "limit"}
  {"type": "delta", "text": "..."}
  {"type": "trace", "topic", "route", "sources", "mode", "ttft_ms", "total_ms"}
  {"type": "done"}
  {"type": "error", "message": "..."}
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncIterator
from datetime import date
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from . import fallback, triage
from .config import Settings, get_settings
from .corpus import Corpus, load_corpus
from .llm import Generator, ModelRouter
from .prompt import system_prompt
from .triage import TagStripper
from .cache import AnswerCache, fingerprint
from .prompt import RULES

log = logging.getLogger("assistant")

MAX_USER_CHARS = 1000
MAX_ASSISTANT_CHARS = 4000
MAX_TURNS = 6  # messages of history sent to the model (token budget: older turns rarely matter)
MAX_HISTORY_REPLY_CHARS = 500  # earlier assistant replies are trimmed — the model only needs the gist


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)

    @field_validator("content")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=40)
    channel: Literal["text", "voice"] = "text"  # voice: short spoken answers (the voice demo's "about Azad" line)

    @field_validator("messages")
    @classmethod
    def _shape(cls, msgs: list[Message]) -> list[Message]:
        if msgs[-1].role != "user":
            raise ValueError("last message must be from the user")
        for m in msgs:
            limit = MAX_USER_CHARS if m.role == "user" else MAX_ASSISTANT_CHARS
            if not m.content or len(m.content) > limit:
                raise ValueError(f"{m.role} message must be 1–{limit} characters")
        return msgs


class DailyBudget:
    """Process-local cap on live calls per day — cost safety net, not abuse protection (Next.js rate-limits)."""

    def __init__(self, limit: int):
        self.limit = limit
        self.day = date.today()
        self.used = 0

    def take(self) -> bool:
        today = date.today()
        if today != self.day:
            self.day, self.used = today, 0
        if self.used >= self.limit:
            return False
        self.used += 1
        return True


def _line(obj: dict) -> bytes:
    return (json.dumps(obj, ensure_ascii=False) + "\n").encode()


def create_app(settings: Settings | None = None, generator: Generator | None = None) -> FastAPI:
    settings = settings or get_settings()
    corpus: Corpus = load_corpus(settings.corpus_path, settings.notes_path)
    gen: Generator | None = generator or (ModelRouter(settings) if settings.live else None)
    budget = DailyBudget(settings.daily_limit)
    # Repeated opening questions are answered from memory (0 tokens); new content/rules → new keys.
    cache = AnswerCache(salt=fingerprint(corpus.knowledge, corpus.notes, RULES))

    app = FastAPI(title="Portfolio assistant", docs_url=None, redoc_url=None)

    def check_token(x_assistant_token: str | None = Header(default=None)) -> None:
        if settings.token and x_assistant_token != settings.token:
            raise HTTPException(status_code=401, detail="unauthorised")

    @app.get("/health")
    def health() -> dict:
        return {"ok": True, "mode": "live" if gen else "offline", "models": [f"{p}:{m}" for p, m in settings.candidates] if gen else []}

    @app.post("/chat", dependencies=[Depends(check_token)])
    async def chat(req: ChatRequest) -> StreamingResponse:
        history = [m.model_dump() for m in req.messages][-MAX_TURNS:]
        if history[0]["role"] != "user":  # Gemini wants the conversation to open with the user
            history = history[1:]
        for m in history[:-1]:
            if m["role"] == "assistant" and len(m["content"]) > MAX_HISTORY_REPLY_CHARS:
                m["content"] = m["content"][:MAX_HISTORY_REPLY_CHARS].rstrip() + "…"
        question = history[-1]["content"]
        first_turn = len(req.messages) == 1 or all(m.role == "assistant" for m in req.messages[:-1])
        voice = req.channel == "voice"
        cache_key = ("voice: " if voice else "") + question

        async def events() -> AsyncIterator[bytes]:
            started = time.perf_counter()
            ms = lambda: round((time.perf_counter() - started) * 1000)  # noqa: E731

            # 1. Rules first: contact / pricing questions have a fixed, correct answer — no model call.
            if first_turn and (contact := fallback.contact_reply(corpus, question)):
                text, trace = contact
                mode = "live" if gen else "offline"
                yield _line({"type": "meta", "mode": mode})
                yield _line({"type": "delta", "text": text})
                yield _line(trace.as_event(mode=mode, ttft_ms=ms(), total_ms=ms()))
                yield _line({"type": "done"})
                return

            # 2. Cache: the same opening question answered before → replay it (0 tokens).
            if first_turn and (hit := cache.get(cache_key)):
                yield _line({"type": "meta", "mode": "live"})
                yield _line({"type": "delta", "text": hit.text})
                yield _line({"type": "trace", **hit.trace, "ttft_ms": ms(), "total_ms": ms()})
                yield _line({"type": "done"})
                return

            if gen is None or not budget.take():
                reason = "offline" if gen is None else "limit"
                text, trace = fallback.reply(corpus, question, reason)
                yield _line({"type": "meta", "mode": reason})
                yield _line({"type": "delta", "text": text})
                yield _line(trace.as_event(mode=reason, ttft_ms=ms(), total_ms=ms()))
                yield _line({"type": "done"})
                return
            yield _line({"type": "meta", "mode": "live"})
            # Excerpts follow the conversation: this question plus the previous one (for follow-ups).
            users = [m["content"] for m in history if m["role"] == "user"]
            system = system_prompt(corpus, " ".join(users[-2:]), voice=voice)
            strip = TagStripper()
            ttft: int | None = None
            try:
                async for chunk in gen.stream(system, history):
                    out = strip.feed(chunk)
                    if out:
                        ttft = ttft if ttft is not None else ms()
                        yield _line({"type": "delta", "text": out})
                tail = strip.finish()
                if tail:
                    yield _line({"type": "delta", "text": tail})
                if strip.text.strip():
                    trace = triage.from_model(strip.text, strip.tag, corpus)
                else:  # empty reply: fall back to quoting the site
                    text, trace = fallback.reply(corpus, question)
                    yield _line({"type": "delta", "text": text})
                log.info("route=%s topic=%s decided_by=%s", trace.route, trace.topic, trace.decided_by)
                event = trace.as_event(mode="live", ttft_ms=ttft or ms(), total_ms=ms())
                if first_turn and strip.text.strip():
                    cache.put(cache_key, strip.text.strip(), {k: v for k, v in event.items() if k not in ("type", "ttft_ms", "total_ms")})
                yield _line(event)
                yield _line({"type": "done"})
            except Exception as err:  # noqa: BLE001 — never leak provider errors to visitors
                log.warning("generation failed: %s", type(err).__name__)
                if strip.text.strip():  # failed mid-answer: keep what was said, flag the rest
                    yield _line({"type": "error", "message": "The assistant couldn't finish that answer. Please try again."})
                    return
                # Every model busy before saying anything: quote the site instead of showing an error.
                text, trace = fallback.reply(corpus, question, "busy")
                yield _line({"type": "meta", "mode": "offline"})
                yield _line({"type": "delta", "text": text})
                yield _line(trace.as_event(mode="offline", ttft_ms=ms(), total_ms=ms()))
                yield _line({"type": "done"})
            finally:
                log.info("chat turn=%d ms=%d", len(history), ms())

        return StreamingResponse(events(), media_type="application/x-ndjson", headers={"Cache-Control": "no-store"})

    return app

