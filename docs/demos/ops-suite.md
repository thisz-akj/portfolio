# Ops Suite — CRM, ERP & data portal demo

One Postgres database shared by a CRM, an ERP and a data portal, browsed through an admin portal at
`/demos/ops-suite/app` with generic, URL-driven filtering. Seed data is synthetic (generic Indian B2B, ₹).

## Status by phase
- [x] 0 Setup: Drizzle, Postgres client, migrations, seed/reset scripts, portal shell (`(portal)` route group)
- [x] 1 Full schema (22 tables) + deterministic seed (~16k rows)
- [ ] 2 Filter engine + DataTable
- [ ] 3 CRM · [ ] 4 ERP + cross-module flows · [ ] 5 Data portal + dashboard
- [ ] 6 Hardening (rate limit, nightly reset, roles) · [ ] 7 Portfolio integration · [ ] 8 AI "ask your data"

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
3. Locally, with that URL in `.env.local`: `npm run db:migrate && npm run db:seed`.
On Vercel without `DATABASE_URL`, the portal shows "database unavailable" instead of crashing.
