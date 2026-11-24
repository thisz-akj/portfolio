"""
Exact-match grading of a query plan against the golden expectation. Only the fields that decide correctness are
compared (metric, groupBy, period, compare, filters — or entity + conditions); wording, sort and limit are not.
Snapshot metrics ignore period/compare, mirroring the server's validator. Conditions are order-insensitive.
"""

from __future__ import annotations

import json
from typing import Any

from .contract import timed_metrics


def _norm_value(v: Any) -> Any:
    if isinstance(v, bool) or v is None:
        return v
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        return v.strip().lower()
    if isinstance(v, list):
        return sorted((_norm_value(x) for x in v), key=lambda x: json.dumps(x, sort_keys=True))
    return v


def _conditions(raw: Any) -> set[str] | None:
    """Flattens a compact filter (top-level AND array or {"and": [...]}) into canonical condition strings."""
    if isinstance(raw, str):
        try:
            raw = json.loads(raw or "[]")
        except json.JSONDecodeError:
            return None
    if isinstance(raw, dict) and "and" in raw:
        raw = raw["and"]
    if not isinstance(raw, list):
        return None
    out: set[str] = set()
    for c in raw:
        if isinstance(c, list) and len(c) >= 2:
            field, op = str(c[0]), str(c[1])
            value = _norm_value(c[2]) if len(c) > 2 else None
            out.add(json.dumps([field, op, value], sort_keys=True))
        else:
            out.add(json.dumps(c, sort_keys=True))  # nested OR groups compare as-is
    return out


def _metric_key(plan: dict[str, Any]) -> dict[str, Any] | None:
    m = plan.get("metric")
    if not isinstance(m, dict):
        return None
    timed = m.get("metric") in timed_metrics()
    filters = {}
    for f in m.get("filters") or []:
        if isinstance(f, dict):
            filters[str(f.get("dimension"))] = _norm_value(f.get("values") or [])
    return {
        "metric": m.get("metric"),
        "groupBy": m.get("groupBy"),
        "period": m.get("period") if timed else "all_time",
        "compare": m.get("compare") if timed else "none",
        "filters": filters,
    }


def _expected_metric_key(e: dict[str, Any]) -> dict[str, Any]:
    timed = e["metric"] in timed_metrics()
    return {
        "metric": e["metric"],
        "groupBy": e["groupBy"],
        "period": e["period"] if timed else "all_time",
        "compare": e["compare"] if timed else "none",
        "filters": {d: _norm_value(vals) for d, vals in e["filters"]},
    }


def _grade_one(expected: dict[str, Any], got: dict[str, Any]) -> tuple[bool, str]:
    kind = got.get("kind")
    if kind != expected["kind"]:
        return False, f"kind: expected {expected['kind']}, got {kind}"
    if kind == "unsupported":
        return True, "correctly declined"
    if kind == "metric":
        want, have = _expected_metric_key(expected), _metric_key(got)
        if have is None:
            return False, "metric plan without a metric"
        for field in ("metric", "groupBy", "period", "compare"):
            if want[field] != have[field]:
                return False, f"{field}: expected {want[field]}, got {have[field]}"
        if want["filters"] != have["filters"]:
            return False, f"filters: expected {want['filters']}, got {have['filters']}"
        return True, "match"
    lst = got.get("list")
    if not isinstance(lst, dict):
        return False, "list plan without a list"
    if lst.get("entity") != expected["entity"]:
        return False, f"entity: expected {expected['entity']}, got {lst.get('entity')}"
    want_c, have_c = _conditions(expected["conditions"]), _conditions(lst.get("filter"))
    if have_c is None:
        return False, "filter is not valid JSON"
    if want_c != have_c:
        missing, extra = sorted(want_c - have_c), sorted(have_c - want_c)
        return False, f"conditions differ — missing {missing or '[]'}, unexpected {extra or '[]'}"
    return True, "match"


def grade(case: dict[str, Any], got: dict[str, Any] | None) -> tuple[bool, str]:
    """Returns (pass, reason) against the expected plan or any listed alternative."""
    if not isinstance(got, dict):
        return False, "no plan returned"
    first_reason = ""
    for i, expected in enumerate([case["expected"], *case.get("alternatives", [])]):
        ok, reason = _grade_one(expected, got)
        if ok:
            return True, reason if i == 0 else f"{reason} (accepted alternative)"
        first_reason = first_reason or reason
    return False, first_reason
