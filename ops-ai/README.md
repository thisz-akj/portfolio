# ops-ai — Python side of the Ops Suite demo

The live app (Next.js, TypeScript) answers questions in **Ask Ops Suite**. This package does the work that suits
Python better, and writes its results to the same Postgres database:

| Command | What it does | Writes |
|---|---|---|
| `python -m ops_ai.eval` | Runs the golden questions through Claude with **exactly** the production request, grades each plan, records latency/tokens/cost | `ai_eval_runs`, `ai_eval_results` → AI quality page |
| `python -m ops_ai.insights` | Holt trend forecast, customers who went quiet, stock-out risk, weekly order anomaly (pandas + statsmodels, no LLM) | `ai_insights` → dashboard Signals |

`ops_ai/contract.json` is generated from the TypeScript source (`npm run ai:contract`) — system prompt, user template,
JSON schema, request settings, pricing and golden set — and a TS test fails if it's stale, so the harness always
evaluates what production sends.

## Setup
```bash
cd ops-ai
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest -q          # grading + insight maths, no network or DB
```
Reads `DATABASE_URL` and `ANTHROPIC_API_KEY` from `../.env.local` (or the environment).
If a ROS (or other) environment is sourced, run with `env -u PYTHONPATH …` so its pytest plugins don't load.

## Evals
```bash
.venv/bin/python -m ops_ai.eval --dry-run                       # how many API calls
.venv/bin/python -m ops_ai.eval                                 # default config from the contract
.venv/bin/python -m ops_ai.eval --effort low --effort medium    # compare configurations
.venv/bin/python -m ops_ai.eval --case region-drop --case aging # a subset
```
Grading is exact-match on the fields that decide correctness (metric, group-by, period, comparison, filters — or list
entity and conditions); wording, sort and limit are not graded; snapshot metrics ignore the period. Alternatives in the
golden set cover plans that are equally correct. Each run costs real API credits.

## CI
`.github/workflows/ops-ai.yml`: tests on every change; insights nightly after the demo reset (needs the `DATABASE_URL`
secret); evals only when started by hand (needs `ANTHROPIC_API_KEY`).
