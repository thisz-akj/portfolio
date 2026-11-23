# Azad Kumar Jha — AI Engineering Portfolio

A personal engineering site for an independent applied AI engineer. It covers the portfolio, seven AI solution areas, interactive demos (marked with honest statuses), case studies and lead capture.

The visual direction is based on two references. The editorial dark layout and motion come from **spragadheeshraj.com**. The bento project cards, the client wall and the "things I keep getting hired for" list come from **jorgerieraflores.com**. All code, copy and imagery are original. The project images come from the owner's own repositories.

## Stack
Next.js 15 (App Router, TypeScript) · GSAP + ScrollTrigger · Lenis smooth scroll · lucide-react · hand-written CSS with design tokens · Vitest.

## Commands
```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run lint
npm run typecheck
npm test
```

## Where things live
| Path | What |
|---|---|
| `src/content/` | **All editable content**: site info, solutions, demos, projects, clients, hero images |
| `src/app/` | Routes: `/`, `/solutions`, `/demos`, `/demos/[slug]`, `/work`, `/work/[slug]`, `/about`, `/contact`, `/api/contact` |
| `src/components/layout/` | Header (section progress lines), footer (particle name and barrel links), cursor, smooth scroll |
| `src/components/hired/` | "Things I keep getting hired for": bento cards, mock-UI previews, the side panel and the scripted demo showcase |
| `src/components/home/` | Loader, hero, bento and work index (used on /work), clients |
| `src/components/shared/` | Scroll-scrubbed text, U-curve headings, poster titles, reveal, contact form |
| `src/features/demos/` | One folder per interactive demo and the demo registry |
| `src/lib/` | Motion helpers, curve maths, contact validation, fonts |
| `docs/` | Architecture, setup, adding a demo, deployment, decisions, security |

## Before publishing (TODOs for the owner)
- `src/content/site.ts`: the email, social URLs, location and experience entries are placeholders.
- `src/content/clients.ts`: the client tiles are placeholders. Add approved logos under `public/clients/`.
- Set `NEXT_PUBLIC_SITE_URL` and the contact-form email vars (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`, `CONTACT_AUTOREPLY`; optional `CONTACT_WEBHOOK_URL`) (see `.env.example`).
- Fonts: to use a Dirtyline Studio face, follow the instructions in `src/lib/fonts.ts`.
- Your product media: set `media` on a solution in `src/content/solutions.ts` to replace the "In the wild" placeholder in its side panel.
- Stock photos and video are CC0 or Mixkit-licensed; see `docs/credits.md`.

The original brief is in `docs/idea.md`.
