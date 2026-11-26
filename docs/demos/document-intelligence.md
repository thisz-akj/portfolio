# DocDesk — document intelligence demo (internal)

Internal only — public pages, the app UI and API responses never show any of this (owner rule).

## What it is
`/demos/document-intelligence` (showcase) → `/demos/document-intelligence/app` (portal app, no site chrome):
Library (8 synthetic samples + visitor uploads) · document workspace (page viewer + Ask / Fields / Checks) ·
Compare (contract redline, PO ↔ invoice match) · Review queue · Quality report. Case study: `/work/docdesk`.

## Pieces
| Piece | Where |
|---|---|
| Python service (FastAPI :8002) | `docintel/` — see `docintel/README.md` for modules and env |
| Sample content + ground truth + golden set | `docintel/samples/source.py` (`DOCUMENTS`, `GOLDEN`) |
| Rendered samples | `docintel/samples/pdf/` (`npm run docintel:samples`) |
| Precomputed sample extraction | `docintel/samples/extracted.json` (`scripts.extract_samples`, calls the model once per doc) |
| Quality report | `docintel/quality/report.json` (`scripts.evaluate`, ~35 model calls, free tier, paced ~6 min) |
| Offline snapshot for the site | `src/features/demos/document-intelligence/snapshot.json` + `public/demos/docdesk/*.webp` (`scripts.snapshot`, no model) |
| Next proxy | `src/app/api/demos/document-intelligence/[...path]/route.ts` |
| UI | `src/features/demos/document-intelligence/ui/*`, routes in `src/app/(portal)/demos/document-intelligence/app/` |
| Screenshots | `npm run shots:docdesk` → `public/work/docdesk-*.webp` |

## How answers work (who does what)
| Step | Who | When |
|---|---|---|
| 1. Example / cache | rules | exact example question or `{example: i}`; cache 24 h, first turn only (prompt version + PDF hash + question) — 0 tokens |
| 2. Route | rules (`Asker.plan`) | `whole`: doc ≤ 4k chars (all 1-page uploads) · `keyword`: best of top-3 BM25 chunks covers ≥ 50 % of the question's terms (synonym map counts) · otherwise `ai` |
| 3a. Keyword retrieval | rules | `keyword` route: top-5 chunks ≤ 3.2k chars |
| 3b. **AI retrieval** | Groq (`ai_retrieve`, schema `route`, ≤ 200 output tokens) | `ai` route: model reads an outline (id, page, section, first 14/9/5 words per chunk, ≤ 7k chars) and returns ≤ 5 chunk ids + ≤ 3 search phrases → its picks, then BM25 hits for its phrases, then keyword candidates (≤ 5 chunks). Picks nothing → "not found", no answer call (cached). |
| 4. Derived facts | rules (`derived_facts`) | non-pass checks (rent schedule, renewal deadline, due date, totals) + invoice total GST, ≤ 900 chars, so the model never does arithmetic itself |
| 5. Answer | Groq (schema `answer`, ≤ 600 tokens) | may combine clauses / use derived facts; must cite every passage used |
| 6. Verify | rules | every quote must exist in the PDF (exact, then strict fuzzy); unverifiable dropped; none left → "not found" |
| Fallbacks | rules | daily budget spent / all models busy → "closest passages" (top-2), labelled |

Cost per free-form question: keyword/whole ≈ 1–2k tokens (one call); AI route ≈ +1–2k tokens and +0.5 s (two calls).
`Asker.last_route` and the evaluation's `versions.routes` count are internal only — never sent to the browser.

### Embeddings (decision 2026-11)
Groq has no embedding models (checked the account's model list). Retrieval is therefore keyword + AI-reads-the-outline.
That covers documents up to roughly 150–200 clauses (outline ≈ 7k chars). For longer documents or search across a
whole library, add a local CPU embedding model (zero token cost) and fuse it with BM25 (reciprocal rank fusion) as
the candidate generator in front of the same AI step.

## Extraction
Type by rules (`detect_type`). Invoices/POs: regexes read numbers, dates, GSTINs, party blocks and table rows; the
model is asked only for missing *core* fields. Other types: model fills the field list for that type. A value is
`high` if a rule read it or the model's quote is in the doc and contains the value; otherwise `review`; empty →
`missing`; model unavailable → `pending`. A model text value equal to another rule field's value → `review`
(e.g. invoice number reported as PO number). Uploads: one extraction call at upload time (rules-only past the
daily budget). Checks (`checks.py`) and compare (`compare.py`) are pure rules.

## Spend
- Visitor free questions: `docdesk-ask` (3/day), uploads: `docdesk-upload` (3/day) in `src/lib/aiQuota.ts`.
  Examples, cache hits and passages fallbacks are refunded by the proxy.
- Service daily cap `DOCINTEL_DAILY_LIMIT` (300 model calls). Output caps 600 (answers) / 1200 (extraction).
- Uploads: 1 page (owner rule), 2 MB, in memory, 60-minute TTL.

## Known limits / next
- No OCR (scanned PDFs → `no_text`). Tables are read row-per-line; wrapped rows aren't parsed by rules.
- Review decisions and field edits/approvals are stored in the visitor's browser (localStorage).
- Hosting: the Python service needs a host + `DOCINTEL_URL`/`DOCINTEL_TOKEN` on Vercel. Without it the site serves
  the snapshot (samples, examples, fields, checks, compare, review, quality); free-form questions and uploads say
  they're offline.
- After changing samples: `npm run docintel:samples` → `scripts.extract_samples` → `scripts.evaluate` →
  `scripts.snapshot` → `npm run shots:docdesk`.
