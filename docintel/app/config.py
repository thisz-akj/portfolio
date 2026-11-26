"""Settings from the environment (docintel/.env, then the site's .env.local). Real env vars win."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODELS = "openai/gpt-oss-20b,openai/gpt-oss-120b,qwen/qwen3.8-27b"


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
    daily_limit: int  # model calls per day across all visitors; past it, answers fall back to passages
    token: str  # shared secret with the Next.js proxy (empty = no check, local dev)
    upload_max_pages: int
    upload_max_bytes: int
    upload_ttl_s: int
    samples_dir: Path

    @property
    def live(self) -> bool:
        return bool(self.groq_key and self.models)


def get_settings() -> Settings:
    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT.parent / ".env.local")
    env = os.environ
    return Settings(
        groq_key=env.get("GROQ_API_KEY", "").strip(),
        models=tuple(m.strip() for m in (env.get("DOCINTEL_MODELS", "") or DEFAULT_MODELS).split(",") if m.strip()),
        daily_limit=int(env.get("DOCINTEL_DAILY_LIMIT", "300") or 300),
        token=env.get("DOCINTEL_TOKEN", "").strip(),
        # Demo limit: 1-page uploads keep each question small. The pipeline itself handles long documents
        # (the multi-page samples go through exactly the same code).
        upload_max_pages=int(env.get("DOCINTEL_UPLOAD_MAX_PAGES", "1") or 1),
        upload_max_bytes=int(env.get("DOCINTEL_UPLOAD_MAX_BYTES", str(2 * 1024 * 1024))),
        upload_ttl_s=int(env.get("DOCINTEL_UPLOAD_TTL_S", "3600") or 3600),
        samples_dir=Path(env.get("DOCINTEL_SAMPLES", ROOT / "samples")),
    )
