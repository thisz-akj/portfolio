# Front Desk Voice — voice AI & conversational agent demo (internal)

Internal only — public pages, the app UI and API responses never show any of this (owner rule).

## What it is
An after-hours phone agent for a synthetic clinic (**Lotus Family Clinic**, Bengaluru, four doctors). It answers,
understands the request, checks the calendar, offers only times that are really free, books, answers clinic
questions, hands over to a person when it should (emergency, asks for a human, can't understand, changes to an
existing appointment) and leaves a summary for staff.

Routes (planned): `/demos/voice-ai` (showcase) → `/demos/voice-ai/app` (portal call screen). Case study
`/work/front-desk-voice` (project 03). Solution card 05 deep-links via `demoHref`.

## Decisions (2026-11-25)
- Self-initiated product demo (no client); numbers are measured on synthetic data.
- One scenario done well: clinic booking + FAQ + handoff. Real-estate lead qualification maybe later.
- English first; Hinglish is a later phase (rules + prompts + test calls).
- Browser microphone, not a phone number (telephony needs hosting + a paid provider → later).
- Public launch: sample calls (0 tokens) + live calls behind a free-calls quota.
- Two lines on one voice front end (owner ask, 2026-11-25): **Clinic front desk** (this engine) and **Ask about Azad**
  (the site assistant, `channel: "voice"` → ≤3 spoken sentences, separate cache key, assistant's free-question quota).
- Spoken replies use the device's built-in voice (free, no round trip). Groq's hosted voice (Orpheus) needs the org
  admin to accept its terms in the Groq console — only worth it for recorded sample calls (phase 4).

## Design principles
- **The model never writes what the agent says.** It only turns the caller's words into fields (intent, doctor,
  day/time *words*, name …). Replies are templates filled from the calendar, so the agent cannot invent a slot,
  a fee or a policy.
- **Rules first, model only when rules can't tell.** Most turns ("yes", "the 4:15 one", "Tuesday afternoon",
  "it's Arjun Mehta") are understood by rules — 0 tokens. The model is asked when rules find nothing or see a
  conflict/negation. Past the daily budget the agent runs on rules only and hands over sooner.
- **Dates are computed by rules** (IST); the model copies the caller's words ("next Tuesday") and never does
  date maths.
- **Speed is the product**: measure delay per turn from day one (speech end → first audio).
- Booking rule: pick a slot with a known name → book at once and read the details back; any correction in the
  same call ("actually Wednesday", "the name is Mehra") rebooks/updates it.

## Phases
| # | What | Status |
|---|---|---|
| 0 | This plan | done |
| 1 | Conversation engine, text only: `voice/` FastAPI :8003 — clinic + calendar, date/time rules, understanding (rules → model), dialogue, staff summary, call API, golden scenarios, pytest | done (71 tests; 21 scenarios: 17 pass on rules alone, 4 need the model — 3/4 passed on the first model run) |
| 2 | Voice loop: mic capture, end-of-speech detection, speech-to-text, spoken replies, barge-in, delay per turn + second line "Ask about Azad" | done (basic app UI at `/demos/voice-ai/app`; needs a real-mic check in Chrome/Safari/Firefox) |
| 3 | Demo app UI (portal): call screen, live transcript, "what the agent did" panel, staff summary | done: two lines, level orb + call timer, tappable offered slots, booking/timeline/staff-note cards, sample-call list, quality card, mobile layout |
| 4 | Spend + resilience: sample calls (0 tokens), `voice-call` quota (3/day), call caps (~14 turns), fallback when the service is down | done: `scripts.samples` → `samples.json` (6 golden calls, rules only, both sides voiced on the device; pytest fails if stale); app checks `/health` and offers samples when offline |
| 5 | Measure: golden scenarios with the model, noisy/accented recordings for transcription, latency | done 2026-11-25 (below). Numbers go into content in phase 6 |
| 6 | Portfolio wiring: demo status, case study, showcase, solution `demoHref`, assistant corpus, screenshots, credits | done 2026-11-25 (`limited-preview`, project 03 `/work/front-desk-voice`, `npm run shots:voice`) |
| 7 | Hinglish | |

## Pieces
| Piece | Where |
|---|---|
| Service (FastAPI :8003) | `voice/` — `npm run voice:dev`, see `voice/README.md` |
| Clinic, doctors, hours, FAQ, calendar | `voice/app/clinic.py` (busy slots are a deterministic hash, per-call bookings) |
| Day/time words → dates | `voice/app/dates.py` |
| Understanding | `voice/app/nlu.py` (rules, then model with strict JSON schema `understand`, ≤ 250 output tokens) |
| Dialogue + summary | `voice/app/dialog.py` |
| Speech-to-text | `voice/app/stt.py` (`whisper-large-v3-turbo` → `whisper-large-v3`, vocabulary hint per line, silence phrases dropped); `POST /transcribe` |
| Next proxy | `src/app/api/demos/voice-ai/[...path]/route.ts` (allow-list, rate limit, `voice-call` quota on `POST calls`, clips/visitor/day) |
| Browser | `src/features/demos/voice-ai/`: `audio.ts` (worklet tap, `Vad`, WAV 16 kHz), `speech.ts` (`speakable`, `takeSentences`, `Speaker`), `useVoiceCall.ts`, `VoiceApp.tsx`, `voice.css`, `copy.ts` |
| Golden scenarios + checker | `voice/app/scenarios.py` (clock fixed at Mon 23 Nov 2026 7:30 pm IST) |
| Evaluation | `voice/scripts/evaluate.py` → `voice/quality/report.json` (`--rules` = 0 tokens, `--model-only`) |

## Spend (planned)
- Understanding call ≈ 600–900 input tokens, ≤ 250 out, only on turns rules can't read.
- Service cap `VOICE_DAILY_LIMIT` (model calls/day, default 300). Visitor quota `voice-call` in `src/lib/aiQuota.ts`.
- Speech-to-text: free tier 2,000 requests/day (header `x-ratelimit-limit-requests`), counted separately from chat
  tokens. Service cap `VOICE_STT_DAILY_S` (3600 audio s/day); proxy cap `VOICE_CLIPS_PER_DAY` (80/visitor).
- About line: one assistant call per question (same budget as the chat panel), streamed and spoken sentence by sentence.

## Quality (2026-11-25) — `quality/report.json`, `quality/audio.json` → public `quality.json`
- Golden calls: **21/21** with the model (4 model calls over 77 turns; rules-only 18/21 — the 3 misses are negation,
  a misheard doctor name, a lowercase name mid-sentence).
- Speech: **88 % of 108 clips** read into exactly the same fields as the written line (12 lines × 3 synthetic voices ×
  clean / pink noise / phone band); WER 4.8 %. By condition: clean 89 %, noise 89 %, phone 86 %. Remaining misses are
  the synthetic voice's Indian names ("Arjun" → "Sgt.", "Vikram Singh" → "the crampsing") and "parking" → "parting"
  in the Scottish voice. Names compare with ≥ 0.85 similarity (spelling variants). **Not yet tested on real human
  callers / Indian accents** — record 20–30 real lines before quoting this as accuracy for Indian callers.
- Fixes from the run: titles stripped from names (Sgt/Mr/…), doctor-name mishearings as aliases, "Indian names" hint.
- Speed: speech-to-text p50 **0.38 s** (p90 0.5 s); agent decision p50 **0.2 ms** on rule turns, **0.7 s** when the
  model is asked; "Ask about Azad" first word p50 **1.1 s** (uncached; re-runs hit the answer cache, so keep the first).

## Latency (measured 2026-11-25, local)
Speech-to-text ≈ 0.45–0.6 s per 6 s clip. Rules-only clinic turn ≈ 10 ms. The UI shows "reply time" = end of the
caller's speech → agent's first sound, including the 0.75 s end-of-speech wait.

## Known limits / next
- Cancelling or moving an existing appointment is taken as a request for the front desk (no patient records lookup).
- One booking per call.
