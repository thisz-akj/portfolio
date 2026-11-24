from datetime import date

import numpy as np
import pandas as pd

from ops_ai.insights import customer_drops, forecast_month, stockout_risks, weekly_anomaly

TODAY = date(2026, 11, 24)


def test_forecast_follows_a_linear_trend_and_reports_pace():
    months = pd.date_range("2025-11-01", "2026-11-01", freq="MS")
    totals = [10_000_000 + i * 1_000_000 for i in range(len(months))]
    totals[-1] = 18_000_000  # current month so far
    f = forecast_month(pd.DataFrame({"month": months, "total": totals}), TODAY)
    assert f is not None and f["kind"] == "forecast"
    assert "₹2.2" in f["detail"]  # next step of the trend ≈ ₹2.2 Cr
    assert "on pace" in f["title"] and "forecast" in f["detail"]


def test_forecast_needs_six_full_months():
    months = pd.date_range("2026-07-01", "2026-11-01", freq="MS")
    assert forecast_month(pd.DataFrame({"month": months, "total": [1.0] * len(months)}), TODAY) is None


def test_customer_drop_flags_only_real_drops():
    rows = []
    for cid, recent in [(1, 0), (2, 3)]:  # company 1 stops ordering, 2 keeps its pace
        for d in range(70, 240, 20):
            rows.append({"company_id": cid, "order_date": TODAY - pd.Timedelta(days=d), "total": 100_000.0})
        for d in range(5, 60, 60 // max(recent, 1))[:recent]:
            rows.append({"company_id": cid, "order_date": TODAY - pd.Timedelta(days=d), "total": 100_000.0})
    out = customer_drops(pd.DataFrame(rows), pd.DataFrame({"id": [1, 2], "name": ["Quiet Co", "Steady Co"]}), TODAY)
    assert [o["entity_id"] for o in out] == [1]
    assert out[0]["severity"] == 3 and "Quiet Co" in out[0]["title"]


def test_stockout_risk_respects_cover_and_open_orders():
    stock = pd.DataFrame(
        [
            {"inventory_id": 1, "sku": "A", "name": "a", "warehouse": "CHN-01", "available": 5, "on_order": 0, "demand_90d": 180, "unit_price": 100.0},  # 2.5 days
            {"inventory_id": 2, "sku": "B", "name": "b", "warehouse": "CHN-01", "available": 5, "on_order": 50, "demand_90d": 180, "unit_price": 100.0},  # covered by PO
            {"inventory_id": 3, "sku": "C", "name": "c", "warehouse": "CHN-01", "available": 500, "on_order": 0, "demand_90d": 180, "unit_price": 100.0},  # 250 days
            {"inventory_id": 4, "sku": "D", "name": "d", "warehouse": "CHN-01", "available": 0, "on_order": 0, "demand_90d": 90, "unit_price": 10.0},  # out
        ]
    )
    out = stockout_risks(stock)
    assert [o["entity_id"] for o in out] == [1, 4]
    assert out[1]["severity"] == 3 and "nothing left" in out[1]["title"]


def test_weekly_anomaly_uses_robust_z():
    rng = np.random.default_rng(1)
    last_monday = pd.Timestamp(TODAY) - pd.Timedelta(days=TODAY.weekday() + 7)
    dates = []
    for w in range(1, 26):
        start = last_monday - pd.Timedelta(weeks=w)
        dates += [start + pd.Timedelta(days=int(d)) for d in rng.integers(0, 7, 40)]
    normal = pd.Series(dates + [last_monday + pd.Timedelta(days=int(d)) for d in rng.integers(0, 7, 41)])
    assert weekly_anomaly(normal, TODAY) is None
    quiet = pd.Series(dates + [last_monday + pd.Timedelta(days=1)] * 5)
    a = weekly_anomaly(quiet, TODAY)
    assert a is not None and "low" in a["title"]
