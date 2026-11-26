"""Front Desk Voice service: a clinic phone agent (text turns now; audio in phase 2).

Responses carry results only: the agent's reply, the call timeline, booking and staff summary. Never model names,
prompts or how a turn was understood.
Run: env -u PYTHONPATH .venv/bin/uvicorn app.main:create_app --factory --port 8003   (from voice/)
"""

from __future__ import annotations

import logging
import secrets
import time
from collections import OrderedDict
from datetime import datetime

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field, field_validator

from .clinic import TZ
from .config import Settings, get_settings
from .dialog import Call, Engine, view
from .llm import Completer, GroqCompleter
from .nlu import DailyBudget, Understander
from .stt import AudioBudget, GroqTranscriber, SttBusy, Transcriber

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


class TurnRequest(BaseModel):
    text: str = Field(min_length=1, max_length=400)

    @field_validator("text")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("empty")
        return v


class CallStore:
    """In-memory calls with a TTL and a size cap (oldest dropped first)."""

    def __init__(self, ttl_s: int, max_calls: int):
        self.ttl_s, self.max_calls = ttl_s, max_calls
        self._calls: OrderedDict[str, tuple[float, Call]] = OrderedDict()

    def _purge(self) -> None:
        cutoff = time.monotonic() - self.ttl_s
        for key in [k for k, (ts, _) in self._calls.items() if ts < cutoff]:
            del self._calls[key]
        while len(self._calls) > self.max_calls:
            self._calls.popitem(last=False)

    def add(self, call: Call) -> None:
        self._calls[call.id] = (time.monotonic(), call)
        self._purge()

    def get(self, call_id: str) -> Call | None:
        self._purge()
        item = self._calls.get(call_id)
        return item[1] if item else None


def create_app(settings: Settings | None = None, completer: Completer | None = None,
               transcriber: Transcriber | None = None) -> FastAPI:
    settings = settings or get_settings()
    if completer is None and settings.live:
        completer = GroqCompleter(settings)
    if transcriber is None and settings.groq_key and settings.stt_models:
        transcriber = GroqTranscriber(settings)
    audio_budget = AudioBudget(settings.stt_daily_s)
    understander = Understander(completer, DailyBudget(settings.daily_limit))
    engine = Engine(understander, settings.max_turns)
    store = CallStore(settings.call_ttl_s, settings.max_calls)
    app = FastAPI(title="Front Desk Voice", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.store, app.state.engine = store, engine

    def check_token(x_voice_token: str | None = Header(default=None)) -> None:
        if settings.token and x_voice_token != settings.token:
            raise HTTPException(401, "unauthorised")

    def now() -> datetime:
        fixed = settings.fixed_now()
        if fixed:
            return fixed if fixed.tzinfo else fixed.replace(tzinfo=TZ)
        return datetime.now(TZ)

    def get_call(call_id: str) -> Call:
        call = store.get(call_id)
        if not call:
            raise HTTPException(404, {"code": "not_found", "message": "That call has ended or expired."})
        return call

    @app.get("/health")
    def health() -> dict:
        return {"ok": True, "live": completer is not None, "speech": transcriber is not None}

    @app.post("/transcribe", dependencies=[Depends(check_token)])
    async def transcribe(audio: UploadFile = File(...), hint: str = Form("clinic")) -> dict:
        """One caller clip → text. Used by both lines (clinic calls and questions about Azad)."""
        if transcriber is None:
            raise HTTPException(503, {"code": "no_speech", "message": "Voice input is offline — type instead."})
        data = await audio.read(settings.clip_max_bytes + 1)
        if not data:
            raise HTTPException(400, {"code": "empty", "message": "No audio received."})
        if len(data) > settings.clip_max_bytes:
            raise HTTPException(413, {"code": "too_long", "message": "That was too long — keep each turn short."})
        if not audio_budget.ok():
            raise HTTPException(503, {"code": "busy", "message": "Voice input is busy right now — type instead."})
        t0 = time.perf_counter()
        try:
            text, seconds = await transcriber.transcribe(data, audio.filename or "clip.webm",
                                                         hint if hint in ("clinic", "about") else "clinic")
        except SttBusy:
            raise HTTPException(503, {"code": "busy", "message": "Voice input is busy right now — type instead."})
        audio_budget.add(seconds)
        return {"text": text[:400], "ms": round((time.perf_counter() - t0) * 1000)}

    @app.post("/calls", dependencies=[Depends(check_token)])
    def start_call() -> dict:
        call, reply = engine.start(secrets.token_urlsafe(9), now())
        store.add(call)
        return view(call, reply)

    @app.post("/calls/{call_id}/turn", dependencies=[Depends(check_token)])
    async def turn(call_id: str, req: TurnRequest) -> dict:
        call = get_call(call_id)
        if call.ended:
            raise HTTPException(409, {"code": "ended", "message": "This call has ended."})
        reply = await engine.turn(call, req.text)
        return view(call, reply)

    @app.get("/calls/{call_id}", dependencies=[Depends(check_token)])
    def get(call_id: str) -> dict:
        return view(get_call(call_id))

    return app
