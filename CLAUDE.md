# Azad Kumar Jha — AI automation portfolio

Next.js 15 (App Router, TypeScript), GSAP + ScrollTrigger, Lenis, lucide-react, hand-written CSS (no Tailwind), Vitest.
Positioning: **independent applied AI engineer, AI automation first.** Robotics/CV work is secondary (lives on `/work`, not the home spotlight).

## Commands
Node lives in `~/.local/node` — prefix shells with `export PATH=$HOME/.local/node/bin:$PATH`.
- `npm run dev` (port 3000) · `npm run build && npx next start -p 3000`
- Checks before finishing: `npm run lint && npm run typecheck && npm test && npm run build`
- Keep command output short (grep for `✓ Generating|rror`).

## Where things live
- `src/content/*.ts` — **all copy & data** (site/contact info, 7 solutions + side-panel stories/showcases, demos, projects, clients, hero tiles). Edit here first; components never hard-code content. Types in `src/types/content.ts`.
- `src/app/` — root layout is bare (html/body/fonts). `(site)/` group (layout = `SiteChrome`: header, footer, cursor, Lenis, sound) holds `/`, `/solutions`, `/demos`, `/demos/[slug]`, `/work`, `/work/[slug]`, `/about`, `/contact`; `not-found.tsx` wraps itself in `SiteChrome`. `(portal)/` group holds app-style demo UIs without that chrome. `/api/contact`.
- `src/components/layout/` header (section progress, SoundToggle), footer (particle/glitch name), cursor, Lenis, SoundProvider.
- `src/components/home/` Loader (typed name + iris), Hero (tiles, gathering choreography), HeroMesh (canvas), starAssembly (glints), Clients (ticker lane).
- `src/components/hired/` "Things I keep getting hired for" bento, mock-UI Previews, SolutionDrawer (right half-panel), Showcase (scripted demo).
- `src/components/shared/` ScrubText, SectionHeading, Poster, AboutPortrait (cut-out + arch + "hello"), WaveField, LoopVideo, ContactForm.
- `src/lib/` motion (gsap/loader events), sound (Web Audio synth — no audio files), fonts, bento grid maths, contact validation, curve maths.
- Styles: `src/app/globals.css` (tokens, base, sections) + `src/styles/hired.css` (bento, previews, drawer, lanes, portrait). Both are large — edit targeted sections, don't re-read whole files.
- `src/features/demos/registry.ts` — register interactive demos here (all demos are "coming-soon"; never mark Live without real model execution).
- Ops Suite AI: TS `src/features/demos/ops-suite/ai/` (Ask Ops Suite) + Python `ops-ai/` (evals, insights; run with `env -u PYTHONPATH ops-ai/.venv/bin/python -m …` because ROS is sourced). After changing the AI prompt/schema/golden set run `npm run ai:contract`.
- Ops Suite demo (CRM + ERP + data portal, Drizzle + Postgres 16 locally via `DATABASE_URL` in `.env.local`, PGlite only in tests): `src/features/demos/ops-suite/`, portal at `/demos/ops-suite/app`. Plan, phases & DB commands (`npm run db:*`): `docs/demos/ops-suite.md`.
- Docs: `docs/architecture/overview.md` (motion + sound tables), `docs/development/adding-a-demo.md`, `docs/credits.md`.

## Design rules (keep consistent)
- Dark matte palette: tokens on `:root` (`--black #0a0a0a`, `--ink #0d0d0d`, `--white #f2f0eb`, `--live #4ade80` accent). Hired/clients sections follow Jorge-style: black bg, `#121212` cards, white pill buttons.
- Fonts: Instrument Serif italic (display/title), Open Sauce One (body), Barlow Condensed 800 (poster titles), JetBrains Mono (labels), Ballet / Baby Boomer (“hello” only). Baby Boomer is personal-use only — needs a licence before launch.
- Motion is smooth and calm (expo/power3 eases); respect `prefers-reduced-motion`; clean up GSAP/ScrollTrigger on unmount.
- Sound: subtle and quiet; unlocks on first click/keypress; effects levels in `src/lib/sound.ts`.
- Intro: Loader types the name **exactly over** `.hero-name` (copies its box/metrics), opens an iris, sets `window.__heroHandoff`; Hero then ripples content in by distance from the name. Changing the hero title's size/position is safe; changing its markup (`.hn-letter`/`.hn-space` spans) must be mirrored in Loader.
- Media: stock is CC0 (Openverse) or Mixkit licence — record every new asset in `docs/credits.md`. Never use other sites' or Awwwards winners' assets.

## Content facts (don't invent)
Clients: IIT Madras, IIITDM Kancheepuram, EDLAR Private Limited, Virya (Autonomous Technologies), Fuvii (AI marketing for local businesses).
Contact/socials are in `src/content/site.ts`. Showcase numbers are labelled illustrative/sample data. Experience entry "Company name" is still a placeholder.

## Working style (token-saving)
- Make targeted edits; don't re-read large files or take screenshots unless asked — the owner checks visuals in the browser.
- Batch related changes, run the checks once at the end, restart the server on :3000 after a build.
