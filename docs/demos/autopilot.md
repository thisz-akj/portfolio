# Autopilot — workflow automation demo (internal)

Internal only — public pages, the app UI and API responses never show any of this (owner rule).

## What it is
A sandbox of four small Indian businesses whose tools are wired together. The visitor plays the customer (or the
supplier) on a phone/inbox on the left; the business side (CRM, stock, documents, calendar, sheet, team chat,
payments, maps) updates live on the right; the middle is the run timeline with a simulated clock. Each run ends with
a report: steps done automatically, people involved, time from first message to done, manual minutes saved.

It is the proof behind solution card 01 (Workflow Automation). Routes: `/demos/autopilot` (showcase) →
`/demos/autopilot/app` (portal). Nothing is really sent: every channel is a mock.

## Scenarios
| id | Business | Visitor plays | Flow |
|---|---|---|---|
| `lead-to-cash` | Kaveri Packaging (cartons, Peenya) | customer on WhatsApp | enquiry → read → CRM match/new lead → stock → quote PDF → manager approval → payment link → (bargain / no reply → follow-ups) → paid → GST invoice → sales register → dispatch booked → delivery update |
| `no-show` | Lotus Family Clinic (same clinic as Front Desk Voice) | patient on WhatsApp | evening reminder → confirm / cancel / move / no reply → waitlist refills the slot, patient rebooked, call reminder, no-show flag, review request (low rating → manager) |
| `invoice` | Kaveri Packaging, accounts payable | supplier's inbox | invoice email → read → duplicate check → PO ↔ goods receipt ↔ invoice match → accounts manager decision → credit note request → booked → payment batch approval → remittance advice |
| `service-job` | CoolBreeze AC Care (Bengaluru) | customer on WhatsApp | complaint → read → ticket → nearest free technician by travel time → booked → ETA + OTP → job card → OTP closes job → UPI payment → service register → next AMC visit → feedback |

## Design
- **Engine is deterministic and server-side** (`src/features/demos/autopilot/engine/`). `simulate(scenario, choices)`
  replays the whole script; a step that needs a person calls `ask()`, which either returns the stored choice or
  pauses the run with a `pending` prompt. The browser stores choices and posts them back (stateless server).
- **Rules read messages first** (`engine/read.ts`: products, quantities, days, areas, reply intents). The model is
  only asked when a visitor types their own text and rules miss a required field; its fields are returned to the
  browser and sent back with later requests, so one message costs at most one call. No key / quota used / model
  busy → the automation asks the customer a follow-up question instead (that is what a real flow does too).
- Model: Groq strict JSON (`model.server.ts`, ≤200 output tokens). Quota `autopilot-read` (3/visitor/day) and
  `AUTOPILOT_DAILY_LIMIT` model calls/day (default 200). Presets and taps cost 0 tokens.
- Event cards are three kinds only: `fields`, `doc` (quote/invoice lines + totals), `table`.
- Manual minutes per step are rough desk-work estimates, labelled as estimates in the UI.

## Pieces
| Piece | Where |
|---|---|
| Types (shared) | `src/features/demos/autopilot/types.ts` |
| Scenario metadata + presets (client-safe) | `scenarios.ts` |
| Engine | `engine/{index,ctx,data,read,leadToCash,noShow,invoice,serviceJob}.ts` |
| Model fallback | `model.server.ts` |
| API | `src/app/api/demos/autopilot/run/route.ts` (zod, rate limit, quota) |
| App | `src/app/(portal)/demos/autopilot/app/page.tsx` → `AutopilotApp.tsx`, `autopilot.css` |
| Showcase | `showcase/AutopilotDemo.tsx` |
| Tests | `tests/autopilot.test.ts` (every preset path finishes, no pause loops, rules extraction) |

## Phases
| # | What | Status |
|---|---|---|
| 0 | This plan | done 2026-11-26 |
| 1 | Engine + 4 scenarios + rules + tests | done 2026-11-26 |
| 2 | API + model fallback + quota | done 2026-11-26 |
| 3 | App UI (phone, timeline, business tools, report, mobile tabs) | done 2026-11-26 |
| 4 | Portfolio wiring: demo entry, showcase, registry, solution deep link, corpus | done 2026-11-26 |
| 5 | Screenshots (`npm run shots:autopilot`) done 2026-11-26; case study (`/work/autopilot`) and owner review of copy pending | |
