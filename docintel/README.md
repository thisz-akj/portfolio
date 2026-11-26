# DocDesk service (document intelligence demo)

Internal README — implementation details stay here and in `docs/demos/document-intelligence.md`, never on public pages.

FastAPI on :8002. `npm run docintel:dev` from the repo root. Python: always `env -u PYTHONPATH .venv/bin/python …` (ROS).

- `samples/source.py` — sample documents as data + ground truth (`fields`, `examples` with supporting quotes, `known_issues`).
  `npm run docintel:samples` re-renders `samples/pdf/` (deterministic). A test fails if an example quote isn't in its PDF.
- `app/pdfdoc.py` — PDF → words with boxes → clause chunks (bold+larger lines = section headings, footer zone dropped);
  `find_quote` (exact, then strict fuzzy, supports "…" elisions) and `rects` (page-fraction highlight boxes).
- `app/search.py` — BM25 with crude stemming + a small query synonym map.
- `app/ask.py` — example → cache → route (`whole` ≤4k chars · `keyword` when BM25 covers ≥50% of the question ·
  `ai`: the model picks clauses from an outline) → derived facts from checks → answer → quote verification → passages
  fallback. Full table in `docs/demos/document-intelligence.md`.
- `app/llm.py` — Groq, models from `DOCINTEL_MODELS` (default gpt-oss-20b → gpt-oss-120b → qwen3.8-27b).
- `app/main.py` — `GET /documents`, `GET /documents/{id}`, `GET /documents/{id}/file`, `POST /documents` (upload),
  `POST /documents/{id}/ask` (`{question, history}` or `{example: i}`), `GET /limits`, `GET /health`.

Env: `GROQ_API_KEY`, `DOCINTEL_MODELS`, `DOCINTEL_DAILY_LIMIT` (300), `DOCINTEL_TOKEN` (shared with the Next proxy),
`DOCINTEL_UPLOAD_MAX_PAGES` (1 — demo limit; the pipeline handles multi-page docs), `DOCINTEL_UPLOAD_MAX_BYTES` (2 MB),
`DOCINTEL_UPLOAD_TTL_S` (3600). Uploads live in memory only.

Tests: `cd docintel && env -u PYTHONPATH .venv/bin/python -m pytest -q`
