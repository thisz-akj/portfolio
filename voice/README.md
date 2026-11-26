# Front Desk Voice service (internal)

Clinic phone agent behind `/demos/voice-ai`. Plan, phases and decisions: `docs/demos/voice-agent.md`.

```
python3 -m venv .venv && env -u PYTHONPATH .venv/bin/pip install -r requirements.txt
npm run voice:dev                                    # :8003 (from the repo root)
env -u PYTHONPATH .venv/bin/python -m pytest -q      # from voice/
env -u PYTHONPATH .venv/bin/python -m scripts.evaluate --rules   # golden scenarios, 0 tokens
```

| Module | Does |
|---|---|
| `app/clinic.py` | Lotus Family Clinic: doctors, hours, fees, FAQ, synthetic calendar (hash-busy slots, per-call bookings), `find_slots` |
| `app/dates.py` | day/time words → dates and clock times (IST); spoken forms |
| `app/nlu.py` | `rules()` first; `Understander` asks the model (schema `understand`) only when rules find nothing or flag `unsure` |
| `app/dialog.py` | `Engine` (turn logic, templates, booking, handover), `summary()` for staff, `view()` for the browser |
| `app/stt.py` | speech → text (Groq, vocabulary hint `clinic`/`about`), `AudioBudget` |
| `app/main.py` | API: `POST /transcribe` (multipart `audio`, `hint`), `POST /calls`, `POST /calls/{id}/turn {text}`, `GET /calls/{id}`, `GET /health` |
| `app/scenarios.py` | golden calls + `run`/`check` |

Env: `GROQ_API_KEY`, `VOICE_MODELS`, `VOICE_DAILY_LIMIT` (300), `VOICE_TOKEN` (header `x-voice-token`),
`VOICE_MAX_TURNS` (14), `VOICE_CALL_TTL_S`, `VOICE_MAX_CALLS`, `VOICE_NOW` (fixed clock, ISO),
`VOICE_STT_MODELS`, `VOICE_STT_DAILY_S` (3600). Next side: `VOICE_URL`, `VOICE_TOKEN`, `VOICE_CLIPS_PER_DAY`.

Responses never include how a turn was understood (rules vs model), model names or prompts.

## Live calls (LiveKit)
`agent/worker.py` is the voice agent (`npm run voice:agent`, after `... -m agent.worker download-files` once). LiveKit
handles mic/speaker audio, speech detection (local), end-of-turn (local `v1-mini` model), echo-safe interruptions
(local `vad` mode — never the cloud "adaptive" mode) and streaming. Groq does speech-to-text and the voice
(`VOICE_TTS_VOICE`, default `autumn`). Replies: `clinic` → the rules engine (`llm_node` override; a `NoLLM`
placeholder keeps the session's reply step on), `about` → the site's `/api/assistant` with the visitor's address
(same quota + cache). Preemptive generation is OFF (the engine changes state per turn). Calls are capped at
`VOICE_MAX_CALL_S` (180). The browser joins via `/api/demos/voice-ai/session` (token + agent dispatch); transcripts on
`lk.transcription`, panels on `vx.view`, agent state on `lk.agent.state`. Env: `LIVEKIT_URL`, `LIVEKIT_API_KEY`,
`LIVEKIT_API_SECRET`, `SITE_INTERNAL_URL`. Hosting: the worker must run somewhere always-on (or LiveKit Cloud agent
hosting). The SIP URI in the LiveKit project can later route a real phone number to the same agent.
