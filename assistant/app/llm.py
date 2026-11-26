"""LLM streaming across providers (Groq, Gemini) with fallback. Behind a tiny interface so tests can swap in a fake."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Callable
from typing import Protocol

from .config import Settings

log = logging.getLogger("assistant")

# Replies are 1–4 sentences; this cap (incl. any short reasoning) bounds worst-case spend per answer.
MAX_OUTPUT_TOKENS = 600


class Generator(Protocol):
    def stream(self, system: str, history: list[dict]) -> AsyncIterator[str]: ...


async def stream_with_fallback(
    candidates: list[tuple[str, Callable[[], AsyncIterator[str]]]],
    first_token_timeout: float,
    pause: float = 0.0,
    idle_timeout: float = 15.0,
) -> AsyncIterator[str]:
    """Streams from the first candidate that starts answering in time.

    A candidate is skipped if it errors (busy, quota, bad model) or sends nothing within
    `first_token_timeout` seconds. Once text has started flowing we stay with that model, but a
    stream that goes quiet for `idle_timeout` seconds is abandoned (raises TimeoutError) so the
    visitor is never left waiting on a stalled connection.
    """
    last: Exception | None = None
    for i, (name, start) in enumerate(candidates):
        if i and pause:
            await asyncio.sleep(pause)  # "high demand" errors are often gone a moment later
        agen = start()
        try:
            first = await asyncio.wait_for(agen.__anext__(), timeout=first_token_timeout)
        except StopAsyncIteration:
            return
        except Exception as err:  # noqa: BLE001 — try the next model
            last = err
            log.warning("model %s skipped: %s", name, type(err).__name__)
            try:
                await agen.aclose()
            except Exception:  # noqa: BLE001
                pass
            continue
        log.info("served by %s", name)
        yield first
        try:
            while True:
                try:
                    text = await asyncio.wait_for(agen.__anext__(), timeout=idle_timeout)
                except StopAsyncIteration:
                    return
                yield text
        except asyncio.TimeoutError:
            log.warning("model %s stalled mid-answer", name)
            try:
                await agen.aclose()
            except Exception:  # noqa: BLE001
                pass
            raise
    raise last or RuntimeError("no model candidates")


class GeminiGenerator:
    def __init__(self, settings: Settings):
        from google import genai  # imported lazily so offline mode/tests don't need credentials

        self._client = genai.Client(api_key=settings.gemini_key)
        self._settings = settings

    def _config(self, system: str, thinking: bool):
        from google.genai import types

        kwargs: dict = dict(system_instruction=system, temperature=0.3, max_output_tokens=MAX_OUTPUT_TOKENS)
        level = self._settings.thinking
        if thinking and level in {"minimal", "low", "medium", "high"}:
            kwargs["thinking_config"] = types.ThinkingConfig(thinking_level=level.upper())
        return types.GenerateContentConfig(**kwargs)

    async def stream_model(self, model: str, system: str, history: list[dict]) -> AsyncIterator[str]:
        from google.genai import types

        contents = [
            types.Content(role="model" if m["role"] == "assistant" else "user", parts=[types.Part(text=m["content"])])
            for m in history
        ]
        try:
            response = await self._client.aio.models.generate_content_stream(
                model=model, contents=contents, config=self._config(system, thinking=True)
            )
        except Exception as err:  # some models reject a thinking level — retry once without it
            if "thinking" not in str(err).lower():
                raise
            response = await self._client.aio.models.generate_content_stream(
                model=model, contents=contents, config=self._config(system, thinking=False)
            )
        async for chunk in response:
            if chunk.text:
                yield chunk.text


class GroqGenerator:
    """Groq's OpenAI-compatible chat API, streamed over SSE with httpx (no extra SDK)."""

    URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, settings: Settings):
        import httpx

        self._client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0))
        self._key = settings.groq_key

    @staticmethod
    def _extra(model: str) -> dict:
        # Keep reasoning short (gpt-oss) or off (qwen) — only the final answer is streamed.
        if "gpt-oss" in model:
            return {"reasoning_effort": "low"}
        if "qwen" in model:
            return {"reasoning_effort": "none"}
        return {}

    async def stream_model(self, model: str, system: str, history: list[dict]) -> AsyncIterator[str]:
        body = {
            "model": model,
            "stream": True,
            "temperature": 0.3,
            "max_completion_tokens": MAX_OUTPUT_TOKENS,
            "messages": [{"role": "system", "content": system}, *history],
            **self._extra(model),
        }
        async with self._client.stream("POST", self.URL, headers={"Authorization": f"Bearer {self._key}"}, json=body) as r:
            if r.status_code != 200:
                await r.aread()
                raise RuntimeError(f"groq HTTP {r.status_code}")  # 429 quota / 5xx busy → next model
            async for line in r.aiter_lines():
                if not line.startswith("data: ") or line == "data: [DONE]":
                    continue
                choices = json.loads(line[6:]).get("choices") or [{}]
                text = (choices[0].get("delta") or {}).get("content")
                if text:
                    yield text


class ModelRouter:
    """Tries each configured (provider, model) in order, then retries the last one once."""

    def __init__(self, settings: Settings):
        self._settings = settings
        providers = {p for p, _ in settings.candidates}
        self._clients = {
            **({"groq": GroqGenerator(settings)} if "groq" in providers else {}),
            **({"gemini": GeminiGenerator(settings)} if "gemini" in providers else {}),
        }

    def stream(self, system: str, history: list[dict]) -> AsyncIterator[str]:
        pairs = self._settings.candidates
        pairs = [*pairs, pairs[-1]]
        candidates = [
            (f"{p}:{m}", (lambda p=p, m=m: self._clients[p].stream_model(m, system, history))) for p, m in pairs
        ]
        return stream_with_fallback(candidates, self._settings.first_token_timeout, pause=0.6)
