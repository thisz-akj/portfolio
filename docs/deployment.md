# Deployment

| Part | Where |
|---|---|
| Next.js site, demo UIs, API routes, nightly Ops reset (`vercel.json`, region `bom1` Mumbai) | Vercel |
| Ops Suite database | Neon Postgres (Mumbai), pooled URL |
| Free-question counts across serverless instances | Upstash Redis (REST) |
| Assistant :8001, DocDesk :8002, voice :8003, LiveKit voice worker, Caddy (HTTPS) | One 4 GB VPS in India, `deploy/docker-compose.yml` |
| Voice calls | LiveKit Cloud (India South) |

Order: Neon → Upstash → VPS → Vercel (the site needs the VPS URL; the voice worker needs the site URL, so set `SITE_INTERNAL_URL` after the first Vercel deploy and restart `voice-agent`).

## 1. Neon
1. Create a project in **AWS ap-south-1 (Mumbai)**.
2. Copy the **pooled** connection string (host contains `-pooler`) → `DATABASE_URL`.
3. From this machine, migrate and seed it once:
   `DATABASE_URL='<pooled url>' npm run db:migrate && DATABASE_URL='<pooled url>' npm run db:seed`

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
| `DATABASE_URL` | Neon pooled URL |
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
