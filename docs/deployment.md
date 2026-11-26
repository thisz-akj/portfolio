# Deployment

| Part | Where |
|---|---|
| Next.js site, demo UIs, API routes, nightly Ops reset (`vercel.json`, region `bom1` Mumbai) | Vercel |
| Ops Suite database | Supabase Postgres (free plan), closest Asia region offered (Southeast Asia/Singapore best; currently Tokyo), **transaction pooler** URL |
| Free-question counts across serverless instances | Upstash Redis (REST) |
| Assistant :8001, DocDesk :8002, voice :8003, LiveKit voice worker, Caddy (HTTPS) | One 4 GB VPS in India, `deploy/docker-compose.yml` |
| Voice calls | LiveKit Cloud (India South) |

Order: Supabase → Upstash → VPS → Vercel (the site needs the VPS URL; the voice worker needs the site URL, so set `SITE_INTERNAL_URL` after the first Vercel deploy and restart `voice-agent`).

## 1. Supabase (database)
1. New project on the **free plan**, region closest to Mumbai that's offered (Southeast Asia/Singapore ≈ 60 ms; Tokyo ≈ 110 ms — Ops pages load in ~0.3 s vs ~0.7 s). Never US/EU. Don't buy the IPv4 add-on.
2. **Connect → Connection String → Method: Transaction pooler** (host `…pooler.supabase.com`, port **6543**, user `postgres.<project-ref>`). The direct `db.<ref>.supabase.co` address is IPv6-only and won't work from Vercel.
3. Keep the password out of chats and git: put `DATABASE_URL='…'` in `.env.supabase` (git-ignored, `.env*`), then migrate + seed once:
   `export NODE_OPTIONS=--network-family-autoselection-attempt-timeout=2000; set -a; . ./.env.supabase; set +a`
   `npm run db:migrate && npm run db:seed`
   (the NODE_OPTIONS flag stops Node giving up after 250 ms per address on a far-away database: `ETIMEDOUT` in ~1 s)
4. The client sets `max_pipeline: 1` (`db/client.ts`): the transaction pooler hangs on pipelined queries. Keep it.
5. Free projects pause after a week idle; the nightly Ops reset (Vercel cron) keeps it active.

## 2. Upstash
Create a Redis database (region Mumbai or nearest) → copy **REST URL** and **REST token** →
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Without them the free-question limit is counted per
instance (still works, just not strict).

## 3. VPS (Python services)
4 GB RAM (the voice worker alone needs ~1.5–2 GB). Ubuntu 24.04, x86 or ARM.
```bash
# on the server
curl -fsSL https://get.docker.com | sh
git clone https://github.com/thisz-akj/portfolio.git && cd portfolio/deploy
cp env.example .env && nano .env        # fill in; generate tokens with: openssl rand -hex 32
docker compose up -d --build            # first build takes a few minutes (voice downloads its models)
docker compose ps && curl https://$API_HOST/assistant/health
```
- Open ports 80 and 443 (cloud firewall / security list too, e.g. Oracle).
- No domain: `API_HOST=api.<ip-with-dashes>.sslip.io` gets a real certificate.
- Update: `git pull && docker compose up -d --build`. Logs: `docker compose logs -f voice-agent`.
- After changing site content, `npm run assistant:corpus` locally, commit, then pull + rebuild `assistant`.

## 4. Vercel
Import `thisz-akj/portfolio` (framework Next.js, defaults). Environment variables (Production):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<your domain or project>.vercel.app` |
| `DATABASE_URL` | Supabase transaction-pooler URL (paste it in Vercel yourself) |
| `CRON_SECRET` | `openssl rand -hex 32` (Vercel cron sends it) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | from Upstash |
| `GROQ_API_KEY` | Groq key (Ops Ask, Autopilot) |
| `ASSISTANT_URL` / `ASSISTANT_TOKEN` | `https://$API_HOST/assistant` / same token as the VPS |
| `DOCINTEL_URL` / `DOCINTEL_TOKEN` | `https://$API_HOST/docintel` / same token |
| `VOICE_URL` / `VOICE_TOKEN` | `https://$API_HOST/voice` / same token |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | same as the VPS (browser tokens + worker callback secret) |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` (+ optional `CONTACT_AUTOREPLY`, `CONTACT_WEBHOOK_URL`) | contact form |
| Optional caps | `AI_FREE_QUESTIONS`, `OPS_AI_DAILY_LIMIT`, `AUTOPILOT_DAILY_LIMIT`, `VOICE_FREE_TURNS` |

Then enable **Analytics** in the Vercel project (the `<Analytics />` tag is already in the root layout).

Custom domain: add it in Vercel, then set `NEXT_PUBLIC_SITE_URL` to it and redeploy. If server actions say
"Invalid Server Actions request" behind another proxy, add that host to `SERVER_ACTIONS_ALLOWED_ORIGINS`.

Resend: until you verify a sending domain, mail only goes to your own Resend account address.

## 5. After the first deploy
- Set `SITE_INTERNAL_URL` on the VPS to the site URL → `docker compose up -d voice-agent`.
- Smoke test: home page, assistant chat (1 question), Ops Suite Ask (an example chip, 0 tokens), DocDesk sample,
  Autopilot path, a voice call, contact form (arrives in your inbox).
- If a service is down, the site falls back to its labelled offline/snapshot mode — check `docker compose ps`.
