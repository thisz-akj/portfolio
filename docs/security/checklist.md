# Security & privacy checklist
- [x] No secrets in the repo. `.env*` is git-ignored and `.env.example` documents the variables.
- [x] Contact API: server-side validation, size limit, per-IP rate limit (in memory, best effort), honeypot, provider timeout, and logs without message content.
- [x] Security headers: nosniff, frame DENY, referrer policy, permissions policy.
- [x] `robots.txt` disallows `/api/`.
- [ ] Use a shared rate limit (e.g. Redis/KV) when deploying more than one instance.
- [ ] Add a CSP once the analytics and demo providers are known.
- [ ] Demos: upload type and size limits, data retention policy, cost caps, and a restricted tool set (see `adding-a-demo.md`).
