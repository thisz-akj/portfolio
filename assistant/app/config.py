"""Settings from the environment (and assistant/.env when present)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Best first; a busy/slow model falls through to the next (see llm.stream_with_fallback).
# "provider:model"; providers without a key are skipped. Groq first: free tier, fastest first words.
DEFAULT_MODELS = (
    "groq:openai/gpt-oss-20b,groq:qwen/qwen3.8-27b,groq:openai/gpt-oss-120b,"
    "gemini:gemini-3.8-flash,gemini:gemini-3.5-flash-lite"
)
PROVIDERS = ("groq", "gemini")


def parse_model(entry: str) -> tuple[str, str]:
    """"groq:openai/gpt-oss-20b" → ("groq", "openai/gpt-oss-20b"); bare "gemini-…" names mean Gemini."""
    provider, sep, model = entry.partition(":")
    if sep and provider in PROVIDERS:
        return provider, model
    return ("gemini" if entry.startswith("gemini") else "groq"), entry


def load_dotenv(path: Path = ROOT / ".env") -> None:
    """Tiny .env reader: KEY=VALUE lines, # comments. Real env vars win."""
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
    gemini_key: str
    groq_key: str
    models: tuple[str, ...]  # "provider:model", tried in order; later ones are fallbacks
    thinking: str
    first_token_timeout: float
    daily_limit: int
    token: str
    corpus_path: Path
    notes_path: Path

    def key_for(self, provider: str) -> str:
        return {"gemini": self.gemini_key, "groq": self.groq_key}.get(provider, "")

    @property
    def candidates(self) -> list[tuple[str, str]]:
        """(provider, model) pairs whose provider has a key, in order."""
        return [pm for pm in map(parse_model, self.models) if self.key_for(pm[0])]

    @property
    def live(self) -> bool:
        return bool(self.candidates)


def get_settings() -> Settings:
    load_dotenv()  # assistant/.env
    load_dotenv(ROOT.parent / ".env.local")  # the site's env file, so one file can hold everything
    env = os.environ
    return Settings(
        gemini_key=env.get("GEMINI_API_KEY", "").strip(),
        groq_key=env.get("GROQ_API_KEY", "").strip(),
        models=tuple(m.strip() for m in (env.get("ASSISTANT_MODELS", "") or DEFAULT_MODELS).split(",") if m.strip()),
        thinking=env.get("ASSISTANT_THINKING", "low").strip().lower(),
        first_token_timeout=float(env.get("ASSISTANT_FIRST_TOKEN_TIMEOUT", "5") or 5),
        daily_limit=int(env.get("ASSISTANT_DAILY_LIMIT", "300") or 300),
        token=env.get("ASSISTANT_TOKEN", "").strip(),
        corpus_path=Path(env.get("ASSISTANT_CORPUS", ROOT / "corpus" / "site.json")),
        notes_path=Path(env.get("ASSISTANT_NOTES", ROOT / "about.md")),
    )
