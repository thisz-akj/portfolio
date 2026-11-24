from ops_ai.contract import contract
from ops_ai.grading import grade

CASES = {c["id"]: c for c in contract()["golden"]}


def metric_plan(**kw):
    m = {"metric": "orders_value", "groupBy": "region", "filters": [], "period": "last_month", "compare": "previous_period", "sort": "asc", "limit": 10}
    m.update(kw)
    return {"kind": "metric", "title": "t", "explanation": "e", "metric": m, "list": None}


def list_plan(entity, filt):
    return {"kind": "list", "title": "t", "explanation": "e", "metric": None, "list": {"entity": entity, "filter": filt, "sort": None}}


def test_metric_match_ignores_wording_sort_and_limit():
    ok, reason = grade(CASES["region-drop"], metric_plan(sort="desc", limit=3))
    assert ok, reason


def test_metric_mismatch_names_the_field():
    ok, reason = grade(CASES["region-drop"], metric_plan(compare="none"))
    assert not ok and reason.startswith("compare")


def test_filter_values_are_case_insensitive():
    ok, _ = grade(CASES["stock-mumbai"], metric_plan(metric="stock_value", groupBy=None, period="all_time", compare="none", filters=[{"dimension": "warehouse", "values": ["bhw-01"]}]))
    assert ok


def test_snapshot_metrics_ignore_period():
    ok, _ = grade(CASES["owed-now"], metric_plan(metric="outstanding", groupBy=None, period="this_month", compare="none"))
    assert ok


def test_list_conditions_are_order_insensitive_and_numbers_normalised():
    ok, reason = grade(CASES["overdue-big"], list_plan("invoices", '[["balance","gt",500000.0],["daysOverdue","gt",0]]'))
    assert ok, reason


def test_alternative_plans_are_accepted():
    ok, reason = grade(CASES["overdue-big"], list_plan("invoices", '[["aging","in",["90_plus","1_30","61_90","31_60"]],["balance","gt",500000]]'))
    assert ok and "alternative" in reason


def test_missing_condition_is_reported():
    ok, reason = grade(CASES["closing-month"], list_plan("deals", '[["expectedClose","preset","this_month"]]'))
    assert not ok and "missing" in reason


def test_unsupported_and_bad_shapes():
    assert grade(CASES["forecast"], {"kind": "unsupported", "metric": None, "list": None})[0]
    assert not grade(CASES["forecast"], metric_plan())[0]
    assert not grade(CASES["late-pos"], list_plan("purchase-orders", "not json"))[0]
    assert not grade(CASES["late-pos"], None)[0]


def test_every_golden_case_grades_itself_as_correct():
    for c in contract()["golden"]:
        e = c["expected"]
        if e["kind"] == "metric":
            plan = metric_plan(metric=e["metric"], groupBy=e["groupBy"], period=e["period"], compare=e["compare"], filters=[{"dimension": d, "values": v} for d, v in e["filters"]])
        elif e["kind"] == "list":
            import json

            plan = list_plan(e["entity"], json.dumps(e["conditions"]))
        else:
            plan = {"kind": "unsupported", "metric": None, "list": None}
        assert grade(c, plan)[0], c["id"]
