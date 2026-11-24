# Ops Suite — CRM, ERP & data portal demo

One Postgres database shared by a CRM, an ERP and a data portal, browsed through an admin portal at
`/demos/ops-suite/app` with generic, URL-driven filtering. Seed data is synthetic (generic Indian B2B, ₹).

## Status by phase
- [x] 0 Setup: Drizzle, Postgres client, migrations, seed/reset scripts, portal shell (`(portal)` route group)
- [ ] 1 Full schema + deterministic seed
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

## Layout
- `src/features/demos/ops-suite/db/` — `schema.ts`, `client.ts` (`getDb()`/`getHandle()`, server-only), `seed.ts`, `scripts.ts` (CLI)
- `src/features/demos/ops-suite/nav.ts` — portal sidebar; flip `ready` when a screen ships
- `src/features/demos/ops-suite/ui/` — portal components + `portal.css` (`.ops-*` classes)
- `src/app/(portal)/demos/ops-suite/app/` — portal routes; its layout has no site header/footer, cursor or Lenis
- `tests/ops-suite-db.test.ts` — runs against an in-memory PGlite, so tests need no running server

## Vercel setup (when ready)
1. Create a Neon project (or Vercel → Storage → Neon) and copy the pooled connection string.
2. Add `DATABASE_URL` to the Vercel project env (Production + Preview).
3. Locally, with that URL in `.env.local`: `npm run db:migrate && npm run db:seed`.
On Vercel without `DATABASE_URL`, the portal shows "database unavailable" instead of crashing.
