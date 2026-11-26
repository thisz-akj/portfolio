"""Strict-JSON completions via Groq (OpenAI-compatible), trying each configured model in order.

Kept behind a one-method interface (`complete`) so tests and the no-key path can swap in a fake.
"""

from __future__ import annotations

import json
import logging
from typing import Protocol

import httpx

from .config import Settings

log = logging.getLogger("voice")
URL = "https://api.groq.com/openai/v1/chat/completions"


class ModelBusy(RuntimeError):
    """Every model failed (rate limit, timeout, bad JSON). Callers fall back to rules only."""


class Completer(Protocol):
    async def complete(self, system: str, user: str, schema: dict, name: str, max_tokens: int) -> dict: ...


def _extra(model: str) -> dict:
    if "gpt-oss" in model:
        return {"reasoning_effort": "low"}
    if "qwen" in model:
        return {"reasoning_effort": "none"}
    return {}


class GroqCompleter:
    def __init__(self, settings: Settings, timeout: float = 20.0):
        self._key = settings.groq_key
        self._models = settings.models
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=5.0))

    async def complete(self, system: str, user: str, schema: dict, name: str, max_tokens: int) -> dict:
        last = "no models"
        for model in self._models:
            body = {
                "model": model,
                "temperature": 0.1,
                "max_completion_tokens": max_tokens,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "response_format": {"type": "json_schema", "json_schema": {"name": name, "strict": True, "schema": schema}},
                **_extra(model),
            }
            try:
                r = await self._client.post(URL, headers={"Authorization": f"Bearer {self._key}"}, json=body)
            except httpx.HTTPError as err:
                last = type(err).__name__
                continue
            if r.status_code != 200:
                last = f"HTTP {r.status_code}"
                log.warning("model %s skipped: %s", model, last)
                continue
            try:
                content = r.json()["choices"][0]["message"]["content"]
                return json.loads(content)
            except (KeyError, IndexError, TypeError, json.JSONDecodeError):
                last = "bad JSON"
                continue
        raise ModelBusy(last)
