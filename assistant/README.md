# Portfolio assistant ("Ask about Azad")

Python (FastAPI) backend for the site's chat assistant. Answers questions about Azad's work using
**only** the site's content, streamed from Gemini. The Next.js UI lives in `src/components/assistant/`
and talks to this service through `/api/assistant` (rate-limited proxy).

## Run locally
```bash
cp assistant/.env.example assistant/.env      # add GEMINI_API_KEY (optional — see offline mode)
npm run assistant:dev                          # http://127.0.0.1:8001  (GET /health, POST /chat)
npm run dev                                    # site on :3000, proxies to ASSISTANT_URL (default :8001)
```
Tests: `cd assistant && env -u PYTHONPATH .venv/bin/python -m pytest -q`
Setup: `python3 -m venv assistant/.venv && env -u PYTHONPATH assistant/.venv/bin/pip install -r assistant/requirements.txt`

## How it answers
- **Knowledge** = `corpus/site.json`, generated from `src/content/*` by `npm run assistant:corpus`
  (a Vitest test fails when it's stale) + `about.md` (owner notes; HTML comments are ignored).
  ~7k tokens, so the whole corpus goes into the system prompt — no retrieval step to get wrong.
- **Rules** (`app/prompt.py`): answer only from the knowledge, say "not on the site" otherwise, link only
  to allow-listed pages, no gendered pronouns unless the notes give them, illustrative numbers flagged.
- **Links**: the UI renders only allow-listed site paths, the listed profiles and the contact email.
- **Offline mode** (no key, or `ASSISTANT_DAILY_LIMIT` reached): quotes the
  closest section of the site (`app/fallback.py`), clearly labelled — it never generates text.

## Token budget
Rules answer contact/pricing (0 tokens) · first-turn answers cached 24 h (`app/cache.py`, keyed by corpus+rules fingerprint) ·
compact prompt (core + index + 3 clipped excerpts ≈ 2.5k tokens) · last 6 messages, old replies trimmed · output ≤ 600 tokens.
The Next.js route also enforces `AI_FREE_QUESTIONS` (3/visitor/day) before anything reaches this service.

## Wire format
`POST /chat {messages:[{role:"user"|"assistant", content}]}` → NDJSON lines:
`{"type":"meta","mode":"live|offline|limit"}`, `{"type":"delta","text":…}`, then
`{"type":"trace","topic","route":"answered|handoff|off_topic","sources","mode","ttft_ms","total_ms"}` (no model name or decision method — the owner keeps implementation private)`,
`{"type":"done"}` — or `{"type":"error",…}`. The trace powers the support-console demo (`/demos/customer-support`).
In live mode the model appends `[[topic: …; route: …]]`; `app/triage.py` strips it from the stream (even when split
across chunks) and falls back to rules if it's missing or invalid.

## Env
`GROQ_API_KEY` and/or `GEMINI_API_KEY`, `ASSISTANT_MODELS` (fallback chain of `provider:model`, default Groq gpt-oss-20b → qwen3.8-27b → gpt-oss-120b → Gemini 3.8-flash → 3.5-flash-lite; providers without a key are skipped), `ASSISTANT_FIRST_TOKEN_TIMEOUT` (5 s), `ASSISTANT_THINKING` (`low`),
`ASSISTANT_DAILY_LIMIT` (300), `ASSISTANT_TOKEN` (shared secret; set the same value in Next's env).
Next.js side: `ASSISTANT_URL` (default `http://127.0.0.1:8001`), `ASSISTANT_TOKEN`.

## Voice channel
`POST /chat {messages, channel: "voice"}` (used by the voice demo's "Ask about Azad" line) appends `VOICE_RULES` to the system prompt: ≤3 spoken sentences, no markdown/links, page names instead of paths. Cached under a separate key.
