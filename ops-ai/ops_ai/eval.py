"""
Eval harness for "Ask Ops Suite": runs the golden questions through Claude with exactly the production request
(system prompt, user template, JSON schema, fallbacks — all from contract.json), grades each plan, and records the
run in Postgres for the AI quality page.

    python -m ops_ai.eval                               # default model/effort from the contract
    python -m ops_ai.eval --effort low --effort medium  # compare configurations
    python -m ops_ai.eval --model claude-sonnet-5-5 --case region-drop --case aging

Every run calls the API (it costs money) and needs ANTHROPIC_API_KEY. --dry-run prints what would run.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import anthropic
import psycopg
from psycopg.types.json import Jsonb

from .config import database_url, load_env
from .contract import contract, cost_usd
from .grading import grade

IST = timezone(timedelta(hours=5, minutes=30))
PERSONA = "Eval harness (Admin)"


def user_message(question: str) -> str:
    c = contract()
    today = datetime.now(IST).date().isoformat()
    return c["userTemplate"].replace("{today}", today).replace("{persona}", PERSONA).replace("{question}", question)


async def ask(client: anthropic.AsyncAnthropic, model: str, effort: str, question: str) -> dict[str, Any]:
    c = contract()
    started = time.perf_counter()
    result: dict[str, Any] = {"plan": None, "error": None, "served_by": model, "usage": {}}
    try:
        response = await client.beta.messages.create(
            model=model,
            max_tokens=c["request"]["max_tokens"],
            betas=c["request"]["betas"],
            fallbacks=c["request"]["fallbacks"],
            output_config={"effort": effort, "format": {"type": "json_schema", "schema": c["schema"]}},
            system=[{"type": "text", "text": c["system"], "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_message(question)}],
        )
        u = response.usage
        result["served_by"] = response.model
        result["usage"] = {
            "input": u.input_tokens,
            "output": u.output_tokens,
            "cache_read": u.cache_read_input_tokens or 0,
            "cache_write": u.cache_creation_input_tokens or 0,
        }
        if response.stop_reason == "refusal":
            result["error"] = "refused"
        elif response.stop_reason == "max_tokens":
            result["error"] = "cut off at max_tokens"
        else:
            text = "".join(b.text for b in response.content if b.type == "text")
            try:
                result["plan"] = json.loads(text)
            except json.JSONDecodeError:
                result["error"] = "reply was not valid JSON"
    except anthropic.AuthenticationError:
        raise SystemExit("ANTHROPIC_API_KEY was rejected")
    except anthropic.RateLimitError:
        result["error"] = "rate limited"
    except anthropic.APIStatusError as e:
        result["error"] = f"API error {e.status_code}"
    except anthropic.APIConnectionError:
        result["error"] = "network error"
    result["latency_ms"] = round((time.perf_counter() - started) * 1000)
    result["cost"] = cost_usd(result["served_by"], result["usage"])
    return result


def percentile(values: list[int], p: float) -> int | None:
    if not values:
        return None
    if len(values) == 1:
        return values[0]
    return round(statistics.quantiles(values, n=100, method="inclusive")[int(p * 100) - 1])


async def run_config(conn: psycopg.Connection, client: anthropic.AsyncAnthropic, model: str, effort: str, cases: list[dict], concurrency: int) -> dict[str, Any]:
    c = contract()
    label = f"{model} · effort {effort} · prompt {c['promptVersion']}"
    with conn.cursor() as cur:
        cur.execute(
            "insert into ai_eval_runs (label, model, effort, prompt_version, cases) values (%s, %s, %s, %s, %s) returning id",
            (label, model, effort, c["promptVersion"], len(cases)),
        )
        run_id = cur.fetchone()[0]
    conn.commit()

    sem = asyncio.Semaphore(concurrency)

    async def one(case: dict) -> tuple[dict, dict]:
        async with sem:
            return case, await ask(client, model, effort, case["question"])

    results = await asyncio.gather(*(one(case) for case in cases))
    passed, latencies, total_cost = 0, [], 0.0
    with conn.cursor() as cur:
        for case, r in results:
            ok, reason = grade(case, r["plan"]) if r["plan"] is not None else (False, r["error"] or "no plan")
            if r["served_by"] != model:
                reason += f" (served by fallback {r['served_by']})"
            passed += ok
            latencies.append(r["latency_ms"])
            total_cost += r["cost"]
            cur.execute(
                "insert into ai_eval_results (run_id, case_id, question, expected, got, pass, reason, latency_ms, cost_usd) values (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (run_id, case["id"], case["question"], Jsonb(case["expected"]), Jsonb(r["plan"]) if r["plan"] is not None else None, ok, reason, r["latency_ms"], r["cost"]),
            )
        cur.execute(
            "update ai_eval_runs set finished_at = now(), passed = %s, p50_ms = %s, p95_ms = %s, cost_usd = %s where id = %s",
            (passed, percentile(latencies, 0.5), percentile(latencies, 0.95), total_cost, run_id),
        )
    conn.commit()
    return {"id": run_id, "label": label, "passed": passed, "cases": len(cases), "p50": percentile(latencies, 0.5), "p95": percentile(latencies, 0.95), "cost": total_cost}


async def main(argv: list[str] | None = None) -> int:
    c = contract()
    parser = argparse.ArgumentParser(description="Evaluate Ask Ops Suite on the golden set")
    parser.add_argument("--model", default=c["defaults"]["model"])
    parser.add_argument("--effort", action="append", choices=["low", "medium", "high", "xhigh", "max"], help="repeat to compare (default: contract default)")
    parser.add_argument("--case", action="append", help="only these golden case ids")
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    cases = [g for g in c["golden"] if not args.case or g["id"] in args.case]
    efforts = args.effort or [c["defaults"]["effort"]]
    if not cases:
        print("No matching cases", file=sys.stderr)
        return 1
    if args.dry_run:
        print(f"Would run {len(cases)} cases × {len(efforts)} configuration(s) on {args.model} ({', '.join(efforts)}) = {len(cases) * len(efforts)} API calls")
        return 0

    load_env()
    async with anthropic.AsyncAnthropic(timeout=60, max_retries=2) as client:
        with psycopg.connect(database_url()) as conn:
            summaries = [await run_config(conn, client, args.model, effort, cases, args.concurrency) for effort in efforts]
    print(f"\n{'configuration':<52} {'accuracy':>10} {'p50':>8} {'p95':>8} {'cost':>9}")
    for s in summaries:
        acc = f"{s['passed']}/{s['cases']}"
        print(f"{s['label']:<52} {acc:>10} {s['p50'] or 0:>6}ms {s['p95'] or 0:>6}ms ${s['cost']:>8.4f}")
    print("\nResults are on the AI quality page (/demos/ops-suite/app/ai-quality).")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
