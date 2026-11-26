from datetime import datetime

import pytest

from app.config import Settings
from app.dialog import Engine
from app.nlu import DailyBudget, Understander
from app.scenarios import NOW as NOW_ISO

NOW = datetime.fromisoformat(NOW_ISO)  # Monday 23 Nov 2026, 7:30 pm IST


@pytest.fixture
def settings() -> Settings:
    return Settings(groq_key="", models=(), daily_limit=5, token="", max_turns=14, call_ttl_s=1800,
                    max_calls=50, now=NOW_ISO)


class FakeCompleter:
    """Returns `reply` (or raises it) for every call; records prompts."""

    def __init__(self, reply):
        self.reply, self.calls, self.prompts = reply, 0, []

    async def complete(self, system, user, schema, name, max_tokens):
        self.calls += 1
        self.prompts.append(user)
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


def model_reply(**kw) -> dict:
    base = {"intent": "info", "name": "", "doctor": "", "specialty": "", "day_text": "", "time_text": "",
            "part_of_day": "", "earliest": False, "choice": 0, "topic": "", "reason": ""}
    return base | kw


def rules_engine(limit: int = 0) -> Engine:
    return Engine(Understander(None, DailyBudget(limit)))


@pytest.fixture
def anyio_backend():
    return "asyncio"
