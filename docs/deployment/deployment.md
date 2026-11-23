# Deployment

Not deployed yet. The owner must approve the host and domain first.

Any Node 20+ host that runs Next.js works (Vercel, a container, etc.):
1. Set `NEXT_PUBLIC_SITE_URL` (and optionally `CONTACT_WEBHOOK_URL`).
2. Run `npm ci && npm run build && npm start`.
3. Check `/sitemap.xml`, `/robots.txt`, the contact form and mobile layout.

Security headers are set in `next.config.ts`. HTTPS is provided by the host.
