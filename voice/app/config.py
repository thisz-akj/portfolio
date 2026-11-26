"""Settings from the environment (voice/.env, then the site's .env.local). Real env vars win."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODELS = "openai/gpt-oss-20b,openai/gpt-oss-120b,qwen/qwen3.8-27b"
DEFAULT_STT_MODELS = "whisper-large-v3-turbo,whisper-large-v3"


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class Settings:
    groq_key: str
    models: tuple[str, ...]
    daily_limit: int  # model calls per day across all callers; past it the agent runs on rules only
    token: str  # shared secret with the Next.js proxy (empty = no check, local dev)
    max_turns: int  # caller turns per call before the agent wraps up
    call_ttl_s: int
    max_calls: int  # calls kept in memory
    now: str  # ISO datetime override (tests / recorded samples); empty = real clock (IST)
    stt_models: tuple[str, ...] = ()
    stt_daily_s: int = 3600  # audio seconds per day (free tier allows far more; this caps abuse)
    clip_max_bytes: int = 1_000_000  # ~15 s of compressed speech is ~60 KB; generous for wav

    @property
    def live(self) -> bool:
        return bool(self.groq_key and self.models)

    def fixed_now(self) -> datetime | None:
        return datetime.fromisoformat(self.now) if self.now else None


def get_settings() -> Settings:
    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT.parent / ".env.local")
    env = os.environ
    return Settings(
        groq_key=env.get("GROQ_API_KEY", "").strip(),
        models=tuple(m.strip() for m in (env.get("VOICE_MODELS", "") or DEFAULT_MODELS).split(",") if m.strip()),
        daily_limit=int(env.get("VOICE_DAILY_LIMIT", "300") or 300),
        token=env.get("VOICE_TOKEN", "").strip(),
        max_turns=int(env.get("VOICE_MAX_TURNS", "14") or 14),
        call_ttl_s=int(env.get("VOICE_CALL_TTL_S", "1800") or 1800),
        max_calls=int(env.get("VOICE_MAX_CALLS", "500") or 500),
        now=env.get("VOICE_NOW", "").strip(),
        stt_models=tuple(m.strip() for m in (env.get("VOICE_STT_MODELS", "") or DEFAULT_STT_MODELS).split(",")
                         if m.strip()),
        stt_daily_s=int(env.get("VOICE_STT_DAILY_S", "3600") or 3600),
    )
