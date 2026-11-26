# Ops Suite — CRM, ERP & data portal demo

One Postgres database shared by a CRM, an ERP and a data portal, browsed through an admin portal at
`/demos/ops-suite/app` with generic, URL-driven filtering. Seed data is synthetic (generic Indian B2B, ₹).

## Status by phase
- [x] 0 Setup: Drizzle, Postgres client, migrations, seed/reset scripts, portal shell (`(portal)` route group)
- [x] 1 Full schema (22 tables) + deterministic seed (~16k rows)
- [x] 2 Filter engine + DataTable (Companies)
- [x] 3 CRM: companies, contacts, leads, deals (+ Kanban), record drawer & pages, forms, bulk actions, lead conversion, audit
- [x] 4 ERP: products, inventory, sales/purchase orders, invoices, payments + order-to-cash and procure-to-stock flows · [ ] 5 Data portal + dashboard
- [x] 6 Hardening: personas + role permissions, rate limits, nightly reset cron, phone card layout 

## Database
Real Postgres everywhere the app runs; PGlite (in-process Postgres) only inside tests.

| | Local dev | Production (Vercel) | Tests |
|---|---|---|---|
| Server | Postgres 16 (apt) | Neon | PGlite in memory |
| Config | `DATABASE_URL=postgres://ops:ops@localhost:5432/ops_suite` in `.env.local` | `DATABASE_URL` = Neon **pooled** URL | `OPS_PGLITE_DIR=memory://` (set by the test) |

One-time local setup (Ubuntu):
```bash
sudo apt install -y postgresql
sudo -u postgres psql -c "CREATE USER ops WITH PASSWORD 'ops' CREATEDB;" -c "CREATE DATABASE ops_suite OWNER ops;"
echo 'DATABASE_URL=postgres://ops:ops@localhost:5432/ops_suite' >> .env.local
npm run db:seed
```

Commands (all read `DATABASE_URL` from `.env.local`):
```bash
npm run db:generate   # after editing db/schema.ts → new SQL file in /drizzle (commit it)
npm run db:migrate    # apply migrations
npm run db:seed       # migrate + seed (idempotent)
npm run db:reset      # drop everything, migrate, seed
npm run db:studio     # browse data in Drizzle Studio (or: psql postgres://ops:ops@localhost:5432/ops_suite)
```

## Data model
- **Core** — `users` (9 personas: admin, 6 sales reps, 2 warehouse), `audit_log` (activity feed), `tags` + `entity_tags` (polymorphic)
- **CRM** — `companies` (industry, size, region, lifecycle prospect/customer/churned, GSTIN, payment terms), `contacts`,
  `leads` (source, status, score, converted company), `deals` (stage, ₹ value, probability, expected close, lost reason), `activities`
- **ERP** — `products` (SKU, category, unit, price/cost, GST rate, HSN), `warehouses` (4 DCs), `inventory` (product × warehouse),
  `suppliers`, `purchase_orders` + lines, `sales_orders` + lines (optional `deal_id`), `invoices` (1 per fulfilled order), `payments`
- **Data portal** — `datasets` (column mapping), `import_jobs`, `import_rejected_rows`

Money is `numeric(14,2)` read as JS numbers, in ₹; order/invoice totals include GST. Invoice "overdue" is derived
(`due_date < today` and not paid/void), not stored. DB constraints: stock ≥ 0, line qty > 0, amount paid ≤ total.

## Seed (synthetic)
`db/seed/generate.ts` is a pure function of `(seed, now)`: a generic Indian MRO distributor (~130 SKUs in 10 categories)
selling to 220 companies across 32 cities. One year of history, skewed towards recent months:
leads → deals (stage from age vs. sales cycle) → won deals become sales orders, customers also re-order → fulfilled orders
are invoiced → payments by each customer's payment behaviour (good/slow/bad) → overdue AR. Purchase orders by supplier
speciality; reorder levels from the last 90 days of demand; reservations from confirmed orders; ~30 days of audit events.
Websites and emails use the reserved `.example` domain. `db/seed/index.ts` truncates and refills every table in one
transaction, then resets id sequences. `tests/ops-suite-db.test.ts` checks determinism and the money/status invariants.

## Lists & filters
URL is the state: `?q=…&f=<filter JSON>&sort=-field,field&page=&size=&cols=a,b`. `f` is compact JSON — an array of
`[field, op, value?]` (AND) or `{"or":[…]}` / `{"and":[…]}` groups (max depth 2, max 20 conditions).

- `filters/types.ts` — field types, operators per type, ListQuery, EntityMeta (client-safe)
- `filters/parse.ts` — URL ⇄ ListQuery; every condition validated with zod against field metadata; invalid parts dropped
- `filters/toSql.ts` — server-only: condition tree → Drizzle SQL, search, sort (+ id tiebreak), facets. Values are always
  bound parameters; only fields declared in an entity's server config reach SQL. **Use `outer(col)` for any outer-row column
  inside a correlated subquery** — Drizzle drops the table name in single-table queries, which rebinds e.g. `"id"` to the
  subquery's own table.
- `filters/dates.ts` — presets in IST with Indian FY quarters (Q1 = Apr–Jun)
- `entities/<name>.ts` (meta: fields, options, default columns, saved views) + `entities/<name>.server.ts` (field → SQL,
  incl. computed aggregates like revenue (12 mo), outstanding, open deals) — register in `entities/index.ts` and `entities/server.ts`
- `data/list.ts` — page + total + facet counts (each facet ignores its own filter) + relation/tag options; CSV export rows
- `ui/table/` — DataTable (search `/`, saved views incl. per-browser custom views, column show/hide/reorder, multi-sort
  with shift-click, selection, density, pagination), FilterBar (chips, match all/any), ConditionEditor (typed value
  editors, facet counts, ₹ shorthand like 5L / 1.2Cr)
- `GET /api/demos/ops-suite/<entity>/export` — CSV of the current view or `ids=`, labels not codes, BOM for Excel,
  formula-injection safe, 10k row cap

Adding an entity: write its meta + server config, register both, flip `ready` in `nav.ts`.
Relative date ops `older_than` / `within_last` take a number of days (e.g. "no order in 90 days").

## Records, editing & audit
- **Drawer** (`ui/record/RecordDrawer.tsx`): click a row's name → view/edit/create without leaving the list (Ctrl/⌘-click opens
  the full page). Related records open in the same drawer. **Full page**: `/<entity>/<id>` (`RecordPage`).
- **Detail** (`data/detail.ts`): all fields, related sections with "View all" links into filtered lists, and a timeline merging
  activities (calls, meetings, open tasks first) with audit events for the record.
- **Forms** (`entities/forms.ts`): one definition per entity (keys = Drizzle columns), validated in the browser and again on the
  server (`validateForm`). Supports ₹ shorthand, GSTIN/phone patterns, dependent pickers (deal contact ⊂ company), conditional
  fields (lost reason only when stage = lost).
- **Writes** (`data/mutate.ts`, via server actions in `data/actions.ts`): one transaction per request; entity rules
  (deal stage → default probability, closedAt stamped/cleared, lost reason required, contact must belong to the company;
  one primary contact per company); audit row per changed record with a before/after diff of changed fields only and a
  readable summary. Unique GSTIN violations surface as a field error.
- **Bulk actions** (`ui/table/BulkBar.tsx`): assign owner, set lifecycle/status/stage, add/remove tags — allow-listed per
  entity in `meta.bulk`, max 500 rows, all-or-nothing.
- **Lead conversion**: lead → prospect company + primary contact (+ optional qualified deal); lead marked converted and linked.
- **Kanban** (`/<entity>/board`, entities with `meta.board`; deals today): columns per stage with count and ₹ total under the
  current search/filters, top 40 cards per column, drag-and-drop or a "Move to" picker per card (keyboard friendly);
  moving to Lost asks for a reason; optimistic with rollback on failure.
- Actor: the persona chosen in the top bar (see Personas below).

## ERP flows (`data/erp.ts`)
Every flow runs in one transaction with row locks (`select … for update`), writes audit rows, and fails with a readable
`FlowError` instead of partial changes.

| Trigger | Effect |
|---|---|
| Deal → **won** (form, bulk, Kanban) | Draft sales order (once per deal) at the warehouse serving the customer's region; lines suggested from the customer's order history (else best sellers), sized to the deal value |
| SO **confirm** | Needs ≥ 1 line; reserves stock (`qty_reserved`) |
| SO **fulfil** | Blocks with a list of short SKUs if on-hand is insufficient; deducts stock and reservation; issues `INV-…` due after the customer's payment terms; prospect/churned company → customer; auto-reorder |
| SO **cancel** | Draft/confirmed only; releases reservations |
| **Auto-reorder** | If available + on order < reorder level: top up to 2× reorder level on a draft PO from the product's usual supplier (else best-rated), reusing an open draft for that supplier + warehouse |
| PO **send / receive / cancel** | Receive per line (partial allowed, no over-receipt) adds stock; fully received stamps `receivedAt`; cancel only before any receipt |
| Invoice **send / record payment** | Payment ≤ balance, dated between issue date and today; status → partially paid / paid |
| Inventory **adjust** | Stock count with reason; then auto-reorder |

Draft SO/PO lines are editable in the record drawer (add product, qty, discount ≤ 50 %, remove); totals are recomputed
server-side. Products get a stock row per warehouse on creation. Record detail payloads carry state-dependent
`actions`, an editable `lines` block and `context` for action forms (`data/detail.ts` → `workflow()`); server actions
`runRecordAction` / `editLinesAction` dispatch them. Audit entity names are table names (`data/audit.ts` maps URL slugs).

## Dashboard (`data/dashboard.ts`, `ui/dashboard/`)
Six KPI tiles (orders booked month-to-date vs the same days last month, open pipeline + weighted, overdue receivables,
90-day win rate, orders to fulfil, stock below reorder) and four single-series charts (orders by month, pipeline by
stage, receivables by age, top customers) plus the latest audit events. **Every tile, bar and feed item links to the
filtered list or record behind it.** Charts are plain HTML/CSS bars (no library): one series colour `--viz-1 #3987e5`,
validated for the dark surface with the dataviz palette validator; hover/focus tooltips; a "Show data table" toggle on
every chart.

## Data portal (`data/importer.ts`, `ui/record/ImportWizard.tsx`)
Datasets map source columns onto a target. Open a dataset → **Import CSV**: choose a file (≤ 1 MB, ≤ 5,000 rows) or
download a **sample built from live data** (`/api/demos/ops-suite/datasets/<slug>/sample`, includes a few bad rows) →
columns auto-map from headers → **Preview** (the real import inside a rolled-back transaction, so duplicates and running
balances preview exactly) → **Import**. Each row runs in its own savepoint; rejected rows are stored on the run with reasons.

| Target | Row rules |
|---|---|
| leads | lead form validation, known city (sets state), 10-digit phone, de-duplicated by email (incl. within the file); unassigned, status new |
| products | existing SKU, positive price, GST 5/12/18/28, HSN 4–8 digits → updates price/GST/HSN (and name) |
| inventory | existing SKU + warehouse code, non-negative count → sets on-hand, then auto-reorder |
| invoices | existing invoice, YYYY-MM-DD date, amount ≤ balance → `recordPayment` (same rules as the UI) |

The CSV parser (`lib/csv.ts`) is RFC 4180 with BOM/CRLF/`;`/tab handling and size limits; the server always re-parses.
Server-action body limit is raised to 2 MB in `next.config.ts` for uploads.

## Audit log
`/audit-log` lists every audit event with the usual filters; rows link to the record they describe (`meta.rowHref`).

## Personas, permissions & abuse limits
- **Personas** (`auth/persona.server.ts`): no passwords — the top-bar switcher sets an `ops_persona` cookie
  (Demo Admin, Riya Mehta · Sales, Kavya Iyer · Warehouse). Audit rows are attributed to the persona; outside a
  request (tests, scripts, cron) it's the admin.
- **Permissions** (`auth/permissions.ts`, shared by UI and server):

  | | Admin | Sales | Warehouse |
  |---|---|---|---|
  | Edit/bulk CRM (companies, contacts, leads, deals), convert leads | ✓ | ✓ | — |
  | Draft / confirm / cancel sales orders, create order from deal | ✓ | ✓ | — |
  | Fulfil orders, products, purchase orders (send/receive/cancel), stock counts | ✓ | — | ✓ |
  | Invoices & payments | ✓ | — | — |
  | Imports | all | leads | stock counts |

  The UI hides what a role can't do; every server action re-checks (`guard()` in `data/actions.ts`).
- **Rate limits** (`lib/rateLimit.ts`): per client IP, 40 writes/minute and 8 import previews+runs per 10 minutes.
  In-memory per server instance — on serverless each warm instance limits separately; the nightly reset bounds the rest.
- **Nightly reset**: `vercel.json` cron (21:30 UTC = 03:00 IST) → `GET /api/demos/ops-suite/cron/reset` with
  `Authorization: Bearer $CRON_SECRET` (constant-time compare; 503 when unset) → full re-seed in one transaction.
- **Phones**: list tables turn into labelled cards under 640 px; the Kanban scrolls sideways by column.

## AI layer (`ai/`, `ops-ai/`)
**Ask Ops Suite** (`/ask`): a question → Claude (`claude-opus-5-5`, effort low, structured outputs, server-side refusal
fallback `fallbacks: "default"`) returns a **plan**, never SQL:
- `metric` — a metric from the semantic layer (`ai/semantic.ts`: 16 metrics over 7 facts) with optional group-by,
  dimension filters, period and "vs previous period" (in-progress periods compare the same number of days), or
- `list` — an entity + compact filter in the same format as list URLs, or
- `unsupported` — forecasts, writes, off-topic.

`ai/plan.ts` validates it (schema + semantic checks, label→value normalisation); `ai/semantic.server.ts` runs it from
constant SQL fragments with bound values inside a **read-only transaction** with a 5 s statement timeout. Answers show
the plan ("how it ran"), chart/number/list, model/latency/tokens/cost and 👍/👎. Limits: 12 questions/10 min per IP and
`OPS_AI_DAILY_LIMIT` per day. Without `ANTHROPIC_API_KEY`, example questions run hand-written plans, labelled as such.
The system prompt is generated from the catalogue (`ai/prompt.ts`), deterministic and cached.

**AI quality** (`/ai-quality`): live monitoring from `ai_traces` (valid-plan rate, refusals, p50/p95 latency, cost,
fallbacks, feedback, failures) and offline eval runs from `ai_eval_runs`/`ai_eval_results`, with per-run failure detail.

**Python** (`ops-ai/`, see its README): `python -m ops_ai.eval` runs the 33-question golden set (`ai/golden.ts`) with
the production request read from `ops_ai/contract.json` (generated by `npm run ai:contract`; a test fails if stale) and
grades plans by exact match; `python -m ops_ai.insights` computes dashboard **Signals** (Holt forecast, customers gone
quiet, stock-out risk, weekly order anomaly). CI: `.github/workflows/ops-ai.yml`. AI tables are not touched by the
nightly reset; insights are recomputed after it.

## Portfolio wiring
- `src/content/projects.ts` → `ops-suite` (index 01, `demoUrl` → "Open live demo" on the case study).
- `src/content/demos.ts` → one `flagship` entry `ops-suite` (status **limited-preview** until Claude runs live with an
  API key and evals have results — then flip to `live`); `src/features/demos/registry.ts` renders `OpsSuiteDemo`.
- `src/content/solutions.ts` → Workflow Automation, AI Data Analytics and AI Evaluation cards keep their own panels and
  showcases; only their button deep-links (`demoHref`/`demoLabel`) to the board, Ask and AI quality screens.
- Screenshots: `npm run shots` (server on :3000, seeded DB, Playwright Chromium) → `public/work/ops-suite-*.webp`.

## Layout
- `src/features/demos/ops-suite/db/` — `schema/` (core, crm, erp, portal, relations), `client.ts` (`getDb()`/`getHandle()`, server-only), `seed/` (reference lists, generator, writer), `scripts.ts` (CLI)
- `src/features/demos/ops-suite/lib/format.ts` — `formatINR` (₹12,40,000 / ₹12.4L / ₹1.25Cr)
- `src/features/demos/ops-suite/nav.ts` — portal sidebar; flip `ready` when a screen ships
- `src/features/demos/ops-suite/ui/` — portal components + `portal.css` (`.ops-*` classes)
- `src/app/(portal)/demos/ops-suite/app/` — portal routes; its layout has no site header/footer, cursor or Lenis
- `tests/ops-suite-db.test.ts` — runs against an in-memory PGlite, so tests need no running server

## Vercel setup (when ready)
1. Create a Neon project (or Vercel → Storage → Neon) and copy the pooled connection string.
2. Add `DATABASE_URL` to the Vercel project env (Production + Preview).
3. Add `CRON_SECRET` (any long random string) to the Vercel project env — it enables the nightly reset.
4. Locally, with the Neon URL in `.env.local`: `npm run db:migrate && npm run db:seed`.
On Vercel without `DATABASE_URL`, the portal shows "database unavailable" instead of crashing.
