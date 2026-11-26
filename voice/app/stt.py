"""Speech → text (Groq speech-to-text, free tier). One short clip per caller turn.

A vocabulary hint (clinic + doctor names, or the site owner's name) helps names come out right. Clips that are
silence or Whisper's well-known silence phrases come back as empty text so the agent doesn't answer noise.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Protocol

import httpx

from .clinic import CLINIC_NAME, DOCTORS
from .config import Settings

log = logging.getLogger("voice")
URL = "https://api.groq.com/openai/v1/audio/transcriptions"

HINTS = {
    "clinic": f"A patient calls {CLINIC_NAME} in Bengaluru to book with " + ", ".join(d.short for d in DOCTORS.values())
              + ". Callers give Indian first names and surnames.",
    "about": "A visitor asks about Azad Kumar Jha, an applied AI engineer: projects, services and contact.",
}
_SILENCE = re.compile(r"^\W*(thank you|thanks for watching|thank you for watching|you|bye|\.+|subtitles by.*)\W*$",
                      re.I)


class SttBusy(RuntimeError):
    """Every model failed or the audio budget is spent."""


class Transcriber(Protocol):
    async def transcribe(self, audio: bytes, filename: str, hint: str) -> tuple[str, float]: ...


def clean(text: str) -> str:
    text = " ".join(text.split())
    return "" if not text or _SILENCE.match(text) else text


class AudioBudget:
    """Audio seconds per day across all callers (the free tier counts audio time)."""

    def __init__(self, seconds: int):
        self.limit, self._day, self.used = seconds, "", 0.0

    def ok(self) -> bool:
        day = time.strftime("%Y-%m-%d")
        if day != self._day:
            self._day, self.used = day, 0.0
        return self.used < self.limit

    def add(self, seconds: float) -> None:
        self.used += max(seconds, 1.0)


class GroqTranscriber:
    def __init__(self, settings: Settings, timeout: float = 15.0):
        self._key = settings.groq_key
        self._models = settings.stt_models
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=5.0))

    async def transcribe(self, audio: bytes, filename: str, hint: str) -> tuple[str, float]:
        last = "no models"
        for model in self._models:
            data = {"model": model, "language": "en", "temperature": "0", "response_format": "verbose_json",
                    "prompt": HINTS.get(hint, "")}
            try:
                r = await self._client.post(URL, headers={"Authorization": f"Bearer {self._key}"}, data=data,
                                            files={"file": (filename, audio)})
            except httpx.HTTPError as err:
                last = type(err).__name__
                continue
            if r.status_code != 200:
                last = f"HTTP {r.status_code}"
                log.warning("stt %s skipped: %s", model, last)
                continue
            body = r.json()
            segments = body.get("segments") or []
            # Whisper marks likely-silence segments; drop them instead of trusting invented words.
            if segments and all(s.get("no_speech_prob", 0) > 0.6 for s in segments):
                return "", float(body.get("duration") or 0)
            return clean(body.get("text", "")), float(body.get("duration") or 0)
        raise SttBusy(last)
