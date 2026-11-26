"""LiveKit voice agent for the Front Desk Voice demo (two lines on one agent).

  clinic  the Lotus Family Clinic front desk: the rules engine in app/ decides every reply (it can't invent slots)
  about   questions about Azad: answered by the site assistant through the site's /api/assistant (same quota + cache)

Hearing and speaking (speech detection, end-of-turn, echo-safe interruptions, streaming audio) are LiveKit's.
Run from voice/:
  env -u PYTHONPATH .venv/bin/python -m agent.worker download-files   # once: speech/turn models
  env -u PYTHONPATH .venv/bin/python -m agent.worker dev
Env (from ../.env.local): LIVEKIT_URL/API_KEY/API_SECRET, GROQ_API_KEY, SITE_INTERNAL_URL (default http://127.0.0.1:3000),
VOICE_TTS_VOICE (default "autumn"), VOICE_MAX_CALL_S (default 180).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import secrets
import wave
from datetime import datetime
from pathlib import Path

import httpx
from livekit import rtc
from livekit.agents import Agent, AgentSession, JobContext, JobProcess, WorkerOptions, cli, llm, tokenize, tts
from livekit.agents.inference import TurnDetector
from livekit.agents.voice import room_io
from livekit.plugins import groq, silero

from app.clinic import TZ
from app.config import ROOT, get_settings, load_dotenv
from app.dialog import Engine, view
from app.llm import GroqCompleter
from app.nlu import DailyBudget, Understander
from app.stt import HINTS

from .text import neutral, speakable, take_sentences

load_dotenv(ROOT.parent / ".env.local")
log = logging.getLogger("voice.agent")
AGENT_NAME = "front-desk"
VIEW_TOPIC = "vx.view"
ABOUT_GREETING = ("Hi! I can tell you about Azad's work: projects, the kind of problems Azad solves, and how to get "
                  "in touch. What would you like to know?")
ABOUT_LIMIT = "That's all the free questions for today. The contact page is the best way to reach Azad."
TURNS_DONE = "That's the end of today's free demo. Thanks for trying it!"
LAST_TURN = " That was your last free question for today. Thanks for trying the demo!"
VOICE = os.environ.get("VOICE_TTS_VOICE", "autumn")
CACHE = Path(__file__).resolve().parent / "cache"


async def take_turn(visitor: str) -> tuple[bool, int]:
    """Count one caller turn against the visitor's free daily allowance (kept by the site).

    Returns (allowed, remaining after this one). If the site can't be reached the turn is allowed: the demo still has
    its own per-call cap and Groq's limits behind it.
    """
    site = os.environ.get("SITE_INTERNAL_URL", "http://127.0.0.1:3000").rstrip("/")
    secret = os.environ.get("LIVEKIT_API_SECRET", "")
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.post(f"{site}/api/demos/voice-ai/turn", json={"visitor": visitor}, headers={"x-voice-secret": secret})
        if r.status_code in (200, 429):
            body = r.json()
            return bool(body.get("ok")), int(body.get("remaining", 0))
    except (httpx.HTTPError, ValueError) as err:
        log.warning("turn allowance unavailable: %s", err)
    return True, 99


async def greeting_audio(key: str, text: str):
    """The fixed greeting, synthesised once and replayed (saves a voice request per call)."""
    path = CACHE / f"greeting-{key}-{VOICE}.wav"
    if not path.exists():
        try:
            CACHE.mkdir(exist_ok=True)
            async with httpx.AsyncClient(timeout=20) as c:
                r = await c.post("https://api.groq.com/openai/v1/audio/speech",
                                 headers={"Authorization": f"Bearer {os.environ.get('GROQ_API_KEY', '')}"},
                                 json={"model": "canopylabs/orpheus-v1-english", "voice": VOICE, "input": text,
                                       "response_format": "wav"})
            if r.status_code != 200 or not r.content.startswith(b"RIFF"):
                return None
            path.write_bytes(r.content)
        except (httpx.HTTPError, OSError) as err:
            log.warning("greeting cache failed: %s", err)
            return None

    async def frames():
        with wave.open(str(path), "rb") as w:
            sr, ch = w.getframerate(), w.getnchannels()
            step = sr // 50  # 20 ms
            while chunk := w.readframes(step):
                yield rtc.AudioFrame(chunk, sr, ch, len(chunk) // (2 * ch))
    return frames()


class NoLLM(llm.LLM):
    """Placeholder so the session runs its reply step; replies come from the agents' own llm_node, never a model."""

    def chat(self, **_kwargs):  # pragma: no cover - never called
        raise RuntimeError("replies come from the agent, not a language model")


def last_user_text(chat_ctx: llm.ChatContext) -> str:
    for item in reversed(chat_ctx.items):
        if getattr(item, "type", "") == "message" and item.role == "user":
            return (item.text_content or "").strip()
    return ""


class Line(Agent):
    def __init__(self, ctx: JobContext, visitor: str):
        super().__init__(instructions="Replies are produced by code, not a language model.")
        self.ctx = ctx
        self.visitor = visitor
        self.done = False

    async def say_greeting(self, key: str, text: str) -> None:
        audio = await greeting_audio(key, text)
        if audio is not None:
            self.session.say(text, audio=audio)
        else:
            self.session.say(text)

    async def allow_turn(self) -> tuple[bool, bool]:
        """(may answer, this is the last free one)."""
        if self.done:
            return False, True
        ok, remaining = await take_turn(self.visitor)
        if not ok:
            self.done = True
            await self.publish({"type": "limit", "kind": "turns"})
            asyncio.create_task(self.hang_up_after_speech())
            return False, True
        if remaining <= 0:
            self.done = True
            await self.publish({"type": "limit", "kind": "turns", "after": True})
            asyncio.create_task(self.hang_up_after_speech())
            return True, True
        return True, False

    async def publish(self, payload: dict) -> None:
        try:
            await self.ctx.room.local_participant.publish_data(json.dumps(payload), topic=VIEW_TOPIC, reliable=True)
        except Exception as err:  # noqa: BLE001 - the panel is a nice-to-have; the call goes on
            log.warning("publish failed: %s", err)

    async def hang_up_after_speech(self, delay: float = 0.6) -> None:
        await asyncio.sleep(delay)
        handle = self.session.current_speech
        if handle is not None:
            await handle.wait_for_playout()
        await asyncio.sleep(0.8)
        await self.publish({"type": "ended"})
        self.session.shutdown()


class ClinicLine(Line):
    def __init__(self, ctx: JobContext, visitor: str):
        super().__init__(ctx, visitor)
        settings = get_settings()
        completer = GroqCompleter(settings) if settings.live else None
        self.engine = Engine(Understander(completer, DailyBudget(settings.daily_limit)), settings.max_turns)
        self.call, self.greeting = self.engine.start(secrets.token_urlsafe(9), datetime.now(TZ))

    async def on_enter(self) -> None:
        await self.publish({"type": "view", "view": view(self.call, self.greeting)})
        await self.say_greeting("clinic", self.greeting)

    async def llm_node(self, chat_ctx, tools, model_settings):
        text = last_user_text(chat_ctx)
        if not text or self.call.ended:
            return
        allowed, last = await self.allow_turn()
        if not allowed:
            yield TURNS_DONE
            return
        reply = await self.engine.turn(self.call, text)
        await self.publish({"type": "view", "view": view(self.call, reply)})
        if self.call.ended and not last:
            asyncio.create_task(self.hang_up_after_speech())
        yield reply + (LAST_TURN if last and not self.call.ended else "")


class AboutLine(Line):
    def __init__(self, ctx: JobContext, visitor: str):
        super().__init__(ctx, visitor)
        self.site = os.environ.get("SITE_INTERNAL_URL", "http://127.0.0.1:3000").rstrip("/")
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(30, connect=5))

    async def on_enter(self) -> None:
        await self.say_greeting("about", ABOUT_GREETING)

    def history(self, chat_ctx: llm.ChatContext) -> list[dict]:
        msgs = []
        for item in chat_ctx.items:
            if getattr(item, "type", "") == "message" and item.role in ("user", "assistant") and item.text_content:
                msgs.append({"role": item.role, "content": item.text_content[:1500]})
        while msgs and msgs[0]["role"] != "user":
            msgs.pop(0)
        return msgs[-6:]

    async def llm_node(self, chat_ctx, tools, model_settings):
        msgs = self.history(chat_ctx)
        if not msgs or msgs[-1]["role"] != "user":
            return
        allowed, last = await self.allow_turn()
        if not allowed:
            yield TURNS_DONE
            return
        headers = {"content-type": "application/json", "x-forwarded-for": self.visitor}
        buf = ""
        try:
            async with self.client.stream("POST", f"{self.site}/api/assistant", headers=headers,
                                          json={"messages": msgs, "channel": "voice"}) as r:
                if r.status_code == 429:
                    body = json.loads((await r.aread()) or b"{}")
                    if body.get("error") == "quota":
                        await self.publish({"type": "limit", "kind": "questions"})
                        asyncio.create_task(self.hang_up_after_speech())
                        yield ABOUT_LIMIT
                        return
                if r.status_code != 200:
                    yield "Sorry, I can't answer right now. Please try again in a moment."
                    return
                async for line in r.aiter_lines():
                    if not line.strip():
                        continue
                    ev = json.loads(line)
                    if ev.get("type") == "delta":
                        buf += ev.get("text", "")
                        done, buf = take_sentences(buf)
                        for sentence in done:
                            yield neutral(speakable(sentence)) + " "
                    elif ev.get("type") == "error":
                        buf += " " + ev.get("message", "")
                    if r.headers.get("x-ai-remaining") == "0":
                        await self.publish({"type": "limit", "kind": "questions", "after": True})
        except httpx.HTTPError as err:
            log.warning("assistant unreachable: %s", err)
            yield "Sorry, I can't reach my notes right now. Please try again in a moment."
            return
        if buf.strip():
            yield neutral(speakable(buf))
        if last:
            yield LAST_TURN


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext) -> None:
    meta = json.loads(ctx.job.metadata or "{}")
    line = meta.get("line") if meta.get("line") in ("clinic", "about") else "clinic"
    visitor = str(meta.get("visitor") or "unknown")[:64]
    await ctx.connect()
    session = AgentSession(
        stt=groq.STT(model="whisper-large-v3-turbo", language="en", prompt=HINTS[line]),
        # One voice request per reply (Groq's free voice tier allows ~100 requests a day): replies are shorter
        # than the minimum "sentence", so the whole reply is synthesised in one go.
        tts=tts.StreamAdapter(tts=groq.TTS(voice=VOICE),
                              sentence_tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=600)),
        vad=ctx.proc.userdata["vad"],
        llm=NoLLM(),
        turn_handling={
            "turn_detection": TurnDetector(version="v1-mini"),  # local model: free, no cloud inference
            "endpointing": {"min_delay": 0.5, "max_delay": 3.0},
            "interruption": {"enabled": True, "mode": "vad", "min_duration": 0.6},  # local detector, no cloud inference
            "preemptive_generation": {"enabled": False},  # the clinic engine changes state per turn: never run it early
        },
    )
    agent: Line = ClinicLine(ctx, visitor) if line == "clinic" else AboutLine(ctx, visitor)
    await session.start(agent=agent, room=ctx.room,
                        room_options=room_io.RoomOptions(close_on_disconnect=True, delete_room_on_close=True))

    async def cap() -> None:  # hard limit per call (free-tier minutes)
        await asyncio.sleep(float(os.environ.get("VOICE_MAX_CALL_S", "180")))
        session.say("We're out of time for this demo call. Thank you for calling!", allow_interruptions=False)
        await agent.hang_up_after_speech(0.3)

    asyncio.create_task(cap())


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm, agent_name=AGENT_NAME))
