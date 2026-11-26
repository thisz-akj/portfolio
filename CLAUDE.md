# Azad Kumar Jha — AI automation portfolio

Next.js 15 (App Router, TypeScript), GSAP + ScrollTrigger, Lenis, lucide-react, hand-written CSS (no Tailwind), Vitest.
Positioning: **independent applied AI engineer, AI automation first, computer vision second** (owner, 2026-11-25: CV is a strength). Solution order: Workflow Automation 01, Computer Vision & Robotics 02, then the rest; the home bento shows all 7 (no "See more"); cards 01 and 02 share the first two rows as equal halves (`src/lib/bento.ts` PLACEMENTS).
- The Workflow Automation card (01) is the **main client pitch**: `layout: "pitch"` → `src/components/hired/AutomationStory.tsx`, content in `src/content/automation.ts` (`PitchArticle`: cost of manual work, 12 tool families it connects to — phone, WhatsApp, email, calendars, maps, sign-in/OTP, CRM, accounts/payments, documents, sheets, team chat, stores — an end-to-end example, services (section 04), before/after, why me, 8 industries, process, FAQ; no proof/demo section — owner). Customer tool names are fine there; never the stack/models. The article is also in the assistant corpus.
- CV/robotics content comes from the owner's resume (`resume/azad_kumar_full_time_resume.pdf`): perception for AMRs + ADAS at Virya, SurroundSense (360° BEV blind-spot), edge pose estimation (trolleys, 2×), targetless camera–LiDAR calibration (>95% points on mask), plus the owner's SLAM→navigation and edge-quantization work. Fields: computer vision, geometric vision, robotics. Project years for SurroundSense/edge pose are set to 2026 — confirm with owner.
- The CV & Robotics card opens `layout: "chapters"` → `src/components/hired/VisionStory.tsx`: ONE scrollable page — intro + fields, then each project as its own blog-style article (summary, video/render, the project, key figures, "Why it stands out" = `project.usp`, "Where it's used" = `project.industries`, extra real screenshots), sticky contents list marking the current project, calm GSAP reveals on the drawer's own scroller, then "How I can help". Owner rejected the pinned scan/HUD version and wants no demo/try/proof sections here.
- CV projects (5): surroundsense, edge-pose-estimation, targetless-camera-lidar-calibration, visual-slam-to-navigation (merged with the old features-comparison + apartment-twin projects), edge-ai-quantization (was the INT8 study; reframed as edge hardware + precision capability; the old INT8 chart images are not used for it). Hardware renders stay unbranded (no NVIDIA logo/name).
- CV visuals are generated, not real footage: `python3 scripts/render-vision-media.py [--stills] [scene]` (`--frontcam` = the CV card preview frame `public/art/amr-front-camera.webp`; its box %s are printed and must match `Preview.tsx`) → `public/work/cv-*.webp` + `public/video/cv-*.mp4` (credited in `docs/credits.md`). Projects/solutions can carry a looping `clip` (mp4, poster = same name .webp).

## Deployment
Vercel (site, `bom1`) + Neon + Upstash (free-question counts, `aiQuota`) + one VPS running `deploy/docker-compose.yml` (assistant, DocDesk, voice, LiveKit worker, Caddy HTTPS at `/assistant` `/docintel` `/voice`). Steps + env list: `docs/deployment.md`.

## Commands
Node lives in `~/.local/node` — prefix shells with `export PATH=$HOME/.local/node/bin:$PATH`.
- **`./start-portfolio.sh`** starts everything (site :3000, assistant :8001, DocDesk :8002, voice :8003, LiveKit voice agent; checks Postgres/venvs/keys; logs in `.logs/`; Ctrl+C stops only what it started; `./start-portfolio.sh status`). Or individually: `npm run dev` (port 3000) + `npm run assistant:dev` (Python chat service, :8001) — both are needed for the chatbot · `npm run build && npx next start -p 3000`
- Checks before finishing: `npm run lint && npm run typecheck && npm test && npm run build` (+ assistant pytest when `assistant/` changed). `build` overwrites `.next` — stop the :3000 dev server first, restart it after.
- Keep command output short (grep for `✓ Generating|rror`).

## Where things live
- `src/content/*.ts` — **all copy & data** (site/contact info, 7 solutions + side-panel stories/showcases, demos, projects, clients). Edit here first; components never hard-code content. Types in `src/types/content.ts`.
- `src/app/` — root layout is bare (html/body/fonts). `(site)/` group (layout = `SiteChrome`: header, footer, cursor, Lenis, sound) holds `/`, `/solutions`, `/demos`, `/demos/[slug]`, `/work`, `/work/[slug]`, `/about`, `/contact`; `not-found.tsx` wraps itself in `SiteChrome`. `(portal)/` group holds app-style demo UIs without that chrome. `/api/contact`, `/api/assistant` (chat proxy + free-question quota).
- `src/components/layout/` header (section progress, SoundToggle), footer (pen signature sign-off, Mrs Saint Delafield, writes on in view — owner: no tech effects), cursor, Lenis, SoundProvider.
- `src/components/home/` Hero (full-bleed motion film that plays once and holds its last frame, name + rule table bottom-right; no intro loader), AboutFrames (About's arch portrait), Clients (ticker lane).
- `src/components/hired/` "Things I keep getting hired for" bento, mock-UI Previews, SolutionDrawer (**full-screen story** on card click: problem → what it does → how it's used (`industries`) → why it's different (`usp`) → proof from `projects` + screens → note → the demo's showcase via `src/features/demos/lazyShowcase.tsx`, keep in step with `registry.ts`; scripted Showcase when the demo is coming-soon).
- `src/components/shared/` ScrubText, SectionHeading, Poster, WaveField, LoopVideo, ContactForm, AiLimitDialog (free-questions pop-up → `/contact`).
- `src/components/assistant/` site chat: `Assistant` (launcher + panel), `useAssistantChat` (stream, watchdog, quota), `ChatParts`, `AssistantMessage`.
- `src/lib/` motion (gsap/loader events), sound (Web Audio synth — no audio files), fonts, bento grid maths, contact validation, curve maths, `aiQuota` (free AI questions).
- Styles: `src/app/globals.css` (tokens, base, sections) + `src/styles/hired.css` (bento, previews, drawer, lanes, portrait) + `assistant.css`, `ai-limit.css`. The first two are large — edit targeted sections, don't re-read whole files.
- `src/features/demos/registry.ts` — register interactive demos here (Ops Suite, Support Assistant, DocDesk, Front Desk Voice and Autopilot are "limited-preview"; the rest are "coming-soon"; never mark Live without real model execution).
- Ops Suite (the big demo app) — see the section below. Autopilot (workflow automation demo) — its own section.
- Docs: `docs/architecture/overview.md` (motion + sound tables), `docs/development/adding-a-demo.md`, `docs/credits.md`.

## Ops Suite demo (CRM + ERP + data portal + AI) — `/demos/ops-suite/app`
Phases 0–8 built (plan/phase log + deep detail: `docs/demos/ops-suite.md` — read only the section you need).
Portfolio wiring: `/work/ops-suite` (project 01), one flagship tile on `/demos` + `OpsSuiteDemo` showcase, three solution cards deep-link via `demoHref`.

**DB:** Drizzle + Postgres 16 local (`DATABASE_URL` in `.env.local`, db `ops_suite`), Neon on Vercel, PGlite in-memory in tests (`OPS_PGLITE_DIR=memory://`).
`npm run db:generate` (after schema edits — commit `drizzle/`) · `db:migrate` · `db:seed` (deterministic truncate+refill, ~16k rows, Indian B2B ₹) · `db:reset` · `db:studio`. AI tables (`ai_*`) survive reseeds.

**Code map** (`src/features/demos/ops-suite/`):
- `db/schema/{core,crm,erp,portal,ai}.ts` · `db/seed/{reference,generate,index}.ts`
- `filters/` generic list engine: `types` · `parse` (URL ⇄ ListQuery, zod) · `toSql` · `dates` (IST, FY Apr–Mar)
- `entities/<x>.ts` (client meta: fields, views, bulk, board, statusField) + `<x>.server.ts` (field → SQL) → register in `index.ts` + `server.ts`, set `ready` in `nav.ts`. `forms.ts` = create/edit + `validateForm` (browser + server).
- `data/`: `list` · `detail` (sections, timeline, `workflow()` actions/lines) · `mutate` (CRM writes + rules) · `erp` (order-to-cash, auto-reorder, PO, payments, stock) · `importer` · `samples` · `dashboard` · `audit` · `actions.ts` (server actions; `guard()` = role permission + rate limit)
- `auth/permissions.ts` (admin/sales/warehouse matrix) · `auth/persona.server.ts` (cookie persona, no passwords)
- `ai/`: `semantic` (16 metrics, 18 dims) · `plan` (schema + validator) · `prompt` (generated, deterministic) · `golden` (33 cases) · `semantic.server` (read-only executor) · `llm.server` (provider pick) · `groq.server` · `claude.server` · `planCache` · `actions` (askAction: quota → cache → model) · `quality.server` · `contract`
- `ui/{table,record,dashboard,ai}` · `showcase/` · routes in `src/app/(portal)/demos/ops-suite/app/` and `src/app/api/demos/ops-suite/` (export, dataset sample CSV, cron reset)

**AI:** Groq first (`groq.server.ts`, strict JSON schema, `OPS_AI_GROQ_MODELS`), Claude (`claude.server.ts`, `claude-opus-5-5`) only if no Groq key; picked in `llm.server.ts`. Model returns a plan, never SQL. Plan cache + 3 free questions (see AI spend policy). No key → labelled pre-written examples.
Env: `GROQ_API_KEY` (+ optional `OPS_AI_GROQ_MODELS`), `ANTHROPIC_API_KEY` + `OPS_AI_MODEL`/`OPS_AI_EFFORT` (Claude path), `OPS_AI_DAILY_LIMIT`, `AI_FREE_QUESTIONS`, `CRON_SECRET`. After changing prompt/schema/golden: `npm run ai:contract` (a test fails if stale).
**Python** `ops-ai/` (venv `.venv`; ROS is sourced, so always `env -u PYTHONPATH ops-ai/.venv/bin/python -m …`): `pytest -q` · `ops_ai.insights` (dashboard Signals) · `ops_ai.eval` (calls Claude, not yet Groq — **costs money, ask first**). CI: `.github/workflows/ops-ai.yml`.
Screenshots: `npm run shots` (server on :3000, Playwright Chromium installed) → `public/work/ops-suite-*.webp`.

**Gotchas (each cost time once):**
- Correlated subqueries: use `outer(col)` — Drizzle drops table names in single-table queries and the column rebinds silently.
- PGlite has one connection: inside a transaction, query through the `tx` (see `currentActor`), never a fresh `getDb()`.
- Every export of a `"use server"` file is a public endpoint — keep helpers in other modules; re-check inputs in actions.
- No `loading.tsx` under `[entity]` (streaming turns `notFound()` 404s into 200s).
- `.ops-card > h2` is the small label style; titles inside cards need their own class.
- Grepping SSR HTML: strip React's `<!-- -->` markers first. Server action body limit is 2 MB (CSV imports).
- Kill the :3000 server by PID (`ss -ltnp | grep :3000`), not `pkill -f` (matches the shell itself).
- GSAP entrance animations in React: use `gsap.fromTo(... end state ...)` + `revert()` in cleanup, never `gsap.from` — dev StrictMode runs the effect twice and `from` then animates hidden → hidden (chat messages were invisible until refresh).
- "Invalid Server Actions request" = `x-forwarded-host` ≠ `origin` (the owner's browser goes through a proxy at 192.168.0.59:8080). Dev trusts `localhost:3000`/`127.0.0.1:3000` via `serverActions.allowedOrigins` in `next.config.ts`; prod extras via `SERVER_ACTIONS_ALLOWED_ORIGINS`.
- Groq free tier: 8k tokens/min **per model, shared by the assistant and Ops** (1k req/day). Rapid testing exhausts it — tests then see fallbacks, not bugs. Check headers `x-ratelimit-remaining-tokens`.
- Testing AI quota from scripts: send `x-forwarded-for: <fake>` or you burn the owner's own 3 free questions (visitor = IP, "local" in dev).
- Playwright probes: run the script from inside the repo (`scripts/_x.mjs`, delete after) — from the scratchpad `playwright` won't resolve. Use `tsx` with a `main()` (no top-level await).

**Pending:** port `ops_ai.eval` to Groq and run the 33-question golden set (also check `qwen/qwen3.8-27b` handles the strict plan schema) → flip demos to `live` with measured accuracy/latency in the case study; Vercel deploy (`DATABASE_URL` Neon pooled, `CRON_SECRET`, `GROQ_API_KEY`, the Python assistant hosted somewhere + `ASSISTANT_URL`/`ASSISTANT_TOKEN`; GitHub secrets for the Python workflow); move `aiQuota` + caches to a shared store (e.g. Upstash) if deployed serverless. Tests: `npm test` (209) + `ops-ai` pytest (14) + `assistant` pytest (35) + `docintel` pytest (34).

## Portfolio assistant ("Ask about Azad") — `assistant/` + `src/components/assistant/`
Site-wide chat (launcher bottom-right, ⌘K) about Azad's work; separate from Ops Suite AI. Python FastAPI; LLMs via Groq (free tier, httpx) then Gemini (`google-genai`) as fallback chain `ASSISTANT_MODELS` — details in `assistant/README.md`. Only `GROQ_API_KEY` is set right now (Gemini links are skipped). Python reads `.env.local` too; it reads env once at start — restart `assistant:dev` after changing keys (`--reload` only watches code).
- Same ROS caveat as ops-ai: always `env -u PYTHONPATH assistant/.venv/bin/python …`.
- Knowledge = `assistant/corpus/site.json` generated from `src/content` → **run `npm run assistant:corpus` after any content edit** (test fails if stale) + `assistant/about.md` owner notes (comments ignored).
- `npm run assistant:dev` (:8001) · Next proxies via `/api/assistant` (`ASSISTANT_URL`, rate limit) · pytest: `cd assistant && env -u PYTHONPATH .venv/bin/python -m pytest -q`.
- No `GROQ_API_KEY`/`GEMINI_API_KEY` (or all models busy) → labelled offline mode quoting the closest site section. UI renders only allow-listed links (`src/features/assistant/links.ts`).
- Resilience: model fallback on error/429 or no first token in 5 s, stall timeout 15 s mid-answer (server) + 30 s watchdog (browser); partial answers are kept with a note.
- Prompt rules worth keeping: answer only from knowledge, "Azad"/"Azad's" not he/she (unless `about.md` gives pronouns), reply in the visitor's script (Hinglish stays Latin), relative links only, never reveal how things are built or which model.
- Shared chat engine: `useAssistantChat` + `ChatParts` (thread, composer). The same assistant is the **AI Customer Support demo** (`/demos/customer-support`, `src/features/demos/customer-support/SupportDemo.tsx`): scenarios + "under the hood" inspector fed by the `trace` event (topic, route answered/handoff/off_topic, sources, ttft). Live routing comes from a `[[topic; route]]` tag the model appends, stripped server-side (`assistant/app/triage.py`). Floating launcher hides on that page. Status `limited-preview` until a key is set and it's been run live.

## DocDesk — document intelligence product (`docintel/` + `/demos/document-intelligence`)
Phases 0–8 built (deep detail: `docs/demos/document-intelligence.md`, service modules: `docintel/README.md`). Case study `/work/docdesk` (project 02), flagship tile on `/demos`, `DocDeskDemo` showcase, solution card deep-links via `demoHref`.
- App `/demos/document-intelligence/app` (portal, `.dd-*` CSS): Library + 1-page upload · `d/[id]` viewer + Ask / Fields / Checks · Compare (contract redline, PO ↔ invoice) · Review queue · Quality.
- Python FastAPI :8002 (`npm run docintel:dev`) — needed for live questions/uploads. Next proxy `src/app/api/demos/document-intelligence/[...path]` (allow-list, quota `docdesk-ask`/`docdesk-upload`, rate limit); if the service is down it serves `snapshot.json` + `public/demos/docdesk/*.webp` (samples stay browsable).
- pytest: `cd docintel && env -u PYTHONPATH .venv/bin/python -m pytest -q`. Vitest `tests/docdesk.test.ts` (snapshot coverage + confidentiality guard).
- **After changing samples/extraction/answer logic:** `npm run docintel:samples` → `scripts.extract_samples` (model, 8 calls) → `scripts.evaluate` (model, ~50 calls, ~8 min) → `scripts.snapshot` → `npm run shots:docdesk`; update the numbers in `src/content/demos.ts` + `projects.ts` from `docintel/quality/report.json`. Python scripts run from `docintel/` as `env -u PYTHONPATH .venv/bin/python -m scripts.<name>`.
- **Owner rule: visitor uploads are 1 page max** (token limit). UI copy must say this is a demo limit and the product handles multi-page documents (the samples are multi-page).
- Answers only with verified quotes (unverifiable → "not found"); examples/cache/compare/checks/review cost 0 tokens. Same Groq free-tier budget as the others.
- Pending: host the Python service (`DOCINTEL_URL`, `DOCINTEL_TOKEN`); OCR for scans; server-side review/approval storage.

## Front Desk Voice — voice AI / conversational agent (`voice/` + `/demos/voice-ai`)
Clinic phone agent (synthetic Lotus Family Clinic) for solution 05 / demo `voice-ai` (`limited-preview`). Case study `/work/front-desk-voice` (project 03), flagship tile on `/demos`, `VoiceDemo` showcase, solution card deep-links to the app via `demoHref`. Screenshots: `npm run shots:voice` (needs site + assistant + voice service; run against `next start` — the dev badge shows otherwise). Plan + phase log: `docs/demos/voice-agent.md`; modules: `voice/README.md`.
- Python FastAPI :8003 (`npm run voice:dev`); pytest: `cd voice && env -u PYTHONPATH .venv/bin/python -m pytest -q`; golden scenarios `env -u PYTHONPATH .venv/bin/python -m scripts.evaluate --rules` (0 tokens) / `--model-only`.
- Rule: the model only reads the caller's words into fields (dates are computed by rules); every reply is a template filled from the calendar, so it can't invent slots. Rules first; model only when rules find nothing or flag `unsure`.
- Two lines on one voice UI (`/demos/voice-ai/app`, `src/features/demos/voice-ai/`): **Clinic front desk** (this engine) and **Ask about Azad** (site assistant via `/api/assistant`, `channel: "voice"`). **Live calls run on LiveKit Cloud** (owner's project, India South): `npm run voice:agent` (`voice/agent/worker.py`), browser joins via `/api/demos/voice-ai/session` (clinic = `voice-call` quota). Local speech detection + local end-of-turn + `vad` interruptions (keep cloud inference off: free), Groq STT + Groq Orpheus voice. Details: `voice/README.md` "Live calls". Needs `voice:agent` + `assistant:dev` (+ `voice:dev` for the panels's old endpoints/samples). `next.config.ts` Permissions-Policy must keep `microphone=(self)` (it was `microphone=()` and silently blocked every mic).
- Sample calls (0 tokens, also the offline fallback): `voice/scripts/samples.py` → `src/features/demos/voice-ai/samples.json` (pytest fails if stale — rerun after engine/clinic changes).
- Quality: `scripts.evaluate` (golden, model on tricky turns) + `scripts.audio_eval --assistant http://127.0.0.1:8001` (108 synthetic clips, ~7 min, free tier) → `scripts.publish` → `quality.json` (results only; shown in the app).
- About line rewrites he/she → "Azad" client-side (`neutral()` in `speech.ts`) because the model slips on the pronoun rule.
- Phases 1–6 done. Next: real human test recordings (Indian accents) before quoting 88% as accuracy for real callers; phase 7 Hinglish; host the service (`VOICE_URL`, `VOICE_TOKEN`).
- After engine/clinic changes: `scripts.samples` → `scripts.evaluate` → `scripts.publish` → update numbers in `src/content/demos.ts` + `projects.ts` → `npm run assistant:corpus` → `npm run shots:voice`.

## Autopilot — workflow automation demo (`/demos/autopilot`)
Proof for card 01 (the card's `demoHref` → `/demos/autopilot/app`; Ops Suite keeps its own tile). Four fictional Bengaluru businesses: `lead-to-cash` (Kaveri Packaging, WhatsApp), `no-show` (Lotus Family Clinic), `invoice` (Kaveri accounts payable, visitor = supplier's inbox), `service-job` (CoolBreeze AC Care). Visitor plays customer/supplier; business tools update; team decisions are "Your call" prompts; each path ends with a report. Plan: `docs/demos/autopilot.md`.
- Engine `src/features/demos/autopilot/engine/` — deterministic, server-side, stateless: `simulate(scenario, choices)` replays the script; `ctx.ask()` pauses with a `pending`. Browser keeps `choices` and posts them to `/api/demos/autopilot/run`. `?s=<scenario>` deep-links.
- Typed text: rules (`engine/read.ts`) first; model (`model.server.ts`, Groq strict JSON, ≤200 tokens) only when rules miss a required field — once per message (`fields._s`: a = rules only, b/c = model tried; opaque on purpose), quota `autopilot-read`, cap `AUTOPILOT_DAILY_LIMIT`. No model → the flow asks a follow-up. Taps/presets = 0 tokens.
- Tests `tests/autopilot.test.ts` walk every tapped path. Screenshots `npm run shots:autopilot` (site on :3000) → `public/work/autopilot-*.webp`.

## AI spend policy (owner rule — best answers for the fewest tokens)
Every AI feature must follow this; check it when adding or changing one.
- **Free tier first:** Groq (`GROQ_API_KEY`) is the provider for the assistant *and* Ask Ops Suite (`ai/llm.server.ts` picks Groq, else Claude). Free tier ≈ 8k tokens/min/model → model chains fall through on 429/busy.
- **Don't call a model when you don't need one:** fixed answers by rules (assistant contact/pricing → `fallback.contact_reply`), pre-written examples (Ops example chips always use `runExampleAction`), caches (assistant first-turn answers `assistant/app/cache.py`, Ops plans `ai/planCache.ts`, 24 h, keyed by content/prompt version).
- **Small prompts:** assistant sends core profile + page index + top-3 clipped excerpts (~2.5k tokens), last 6 messages, old replies trimmed to 500 chars. Don't put the whole corpus back.
- **Caps:** output ≤600 tokens (assistant) / ≤1200 (Ops plan); low/no reasoning effort; daily caps (`ASSISTANT_DAILY_LIMIT`, `OPS_AI_DAILY_LIMIT`).
- **Free questions:** `src/lib/aiQuota.ts` — `AI_FREE_QUESTIONS` (3) per visitor per tool per day (assistant panel + support demo share one; Ask Ops Suite separate; DocDesk questions and DocDesk uploads separate; `voice-call` = live clinic calls, `autopilot-read` = typed Autopilot messages rules couldn't read, the voice demo's "Ask about Azad" line uses the assistant's), refunded on service errors. Then `AiLimitDialog` invites them to `/contact`.

## Confidentiality (owner rule — the "how" is the USP)
Public pages and the assistant never reveal how systems are built: no architecture diagrams, "how it works" internals, tech-stack chips, "how I build it", case-study approach, model/vendor names, prompts or eval methods. Describe what it does and the results. Demo/solution/project types no longer have `architecture`/`howItWorks`/`stack`/`build`/`approach` fields — don't re-add them; internal detail belongs in `docs/` only. A Vitest guards the assistant corpus. **Exception (owner, 2026-11-26):** the home About section shows a general "Tech I use" icon row (`src/content/techStack.ts` → `TechStack.tsx`, Simple Icons, name on hover) — it lists tools Azad uses, never which ones power a given demo, and stays out of the assistant corpus. This also covers demo app UIs (Ops Suite Ask/AI-quality pages show no model, plan JSON, prompt version or commands) and **what server responses send to the browser** (Ask returns title/explanation/latency only; assistant `trace` has no model or decision method).

## Design rules (keep consistent)
- Dark matte palette: tokens on `:root` (`--black #0a0a0a`, `--ink #0d0d0d`, `--white #f2f0eb`, `--live #4ade80` accent). Hired/clients sections follow Jorge-style: black bg, `#121212` cards, white pill buttons.
- Fonts: Instrument Serif italic (display/title), Open Sauce One (body), Barlow Condensed 800 (poster titles), JetBrains Mono (labels), Ballet / Baby Boomer (“hello” only). Baby Boomer is personal-use only — needs a licence before launch.
- Motion is smooth and calm (expo/power3 eases); respect `prefers-reduced-motion`; clean up GSAP/ScrollTrigger on unmount.
- Sound: subtle and quiet; unlocks on first click/keypress; effects levels in `src/lib/sound.ts`.
- Hero (owner, 2026-11-25): no typing intro/loader. Editorial fashion-style page: the owner's motion film (`azad_folder/atelier-motion-film-optical-9s.webm`, VFR recording → re-timed to 30 fps and **trimmed to end at the original's 0:25** (frame 152, 5.07 s), rich teal/amber grade: saturation 1.3, contrast 1.1, deep blacks, soft vignette) as `public/video/hero-motion.mp4` + `hero-motion-mobile.mp4` (608×1080 centre crop → 720×1280) with same-name .webp posters; first frame holds 2.5 s (`HOLD_MS`), then plays once and stays on its last frame (owner: no loop). Encode: grade → lanczos → `hqdn3d=3:2.5:8:8,unsharp=5:5:0.5:5:5:0` → x264 `-tune film -crf 22` (sharpening without denoise blew it up to 12 MB). Film size (owner: keep actual size, no smaller plate): full-bleed whenever cover-fit stays within `MAX_UPSCALE` 1.25× per device pixel; only on denser desktop screens it is shown at that limit (`.hero.is-window`, `--fw/--fh`), feathered by a `closest-side` radial mask (reaches zero exactly at the plate edge — a larger ellipse left a visible top edge) into `.hero-ambient` (= `hero-motion-ambient.webp`, last frame with the figure painted out, blurred, **same brightness as the film** — darkening comes from one shared vignette, otherwise the plate shows as a box); top/bottom `.hero-shade` gradients are multi-stop eased and end in `--ink`, the hero background is `--ink` and About has no top border, so hero → About has no seam; Phones/tablets: full-bleed. No grain overlay on the hero (owner). Name + tagline + rule table bottom-right. Hero calls `markLoaderDone()` on mount (the assistant waits for it).
- Page order: Intro (hero) → About (`#about`, includes What I do) → Work (bento, clients) → Contact; `nav` matches. The owner rejected the hero→About zoom/dissolve shot (2026-11-26) — don't rebuild it. About = `.about-section.about-v2`: left a sticky arch portrait `src/components/home/AboutFrames.tsx` (z07/z08/z09 in `public/art/hero/`, graded like the film): arch rises from its base, the frames melt into each other with scroll, a dim italic "Azad" drifts behind, handwritten "hello" draws across the arch, a circular text badge turns, a warm light band sweeps once. Owner wants it **artistic, not tech** — no viewfinder/HUD/face-box/frame-counter effects, right the story, pullquote, What I do (philosophy + expertise cards), experience, skills. There is no separate `/about` page (redirects to `/#about`). `body` must stay `overflow-x: clip` (hidden makes body a scroll container and breaks sticky).
- Media: stock is CC0 (Openverse) or Mixkit licence — record every new asset in `docs/credits.md`. Never use other sites' or Awwwards winners' assets.

## Content facts (don't invent)
Ops Suite is a self-initiated product demo (no client); its numbers are synthetic data and real repo counts.
Clients: IIT Madras, IIITDM Kancheepuram, EDLAR Private Limited, Virya (Autonomous Technologies), Fuvii (AI marketing for local businesses).
Contact/socials are in `src/content/site.ts`. Showcase numbers are labelled illustrative/sample data. Experience = Independent (now), Virya Robotics AI Engineer (2026–now), IIT Madras CeRAI intern (2025), from the resume.

## Working style (token-saving)
- Make targeted edits; don't re-read large files or take screenshots unless asked — the owner checks visuals in the browser.
- For Ops Suite, start from the code map above; open `docs/demos/ops-suite.md` only for the section you need.
- Batch related changes, run the checks once at the end, restart the server on :3000 after a build.
