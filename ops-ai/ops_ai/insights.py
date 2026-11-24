"""
Statistical signals for the dashboard — no LLM involved:

  forecast        Holt's linear-trend exponential smoothing (statsmodels) on monthly orders → this month's total
  customer_drop   customers whose order rate in the last 60 days fell ≥ 60% versus the 180 days before
  stockout_risk   product × warehouse with < 10 days of cover at 90-day demand and nothing on order
  order_anomaly   last full week's order count vs the previous 25 weeks, robust z-score (median / MAD) beyond ±3

    python -m ops_ai.insights            # recompute and replace ai_insights
    python -m ops_ai.insights --dry-run  # print without writing

The analysis functions take DataFrames and return insight dicts, so they are unit-tested without a database.
"""

from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone
from typing import Any

import numpy as np
import pandas as pd
import psycopg
from psycopg.types.json import Jsonb

from .config import database_url

IST = timezone(timedelta(hours=5, minutes=30))
LEAD_TIME_DAYS = 10


def inr(v: float) -> str:
    a = abs(v)
    if a >= 1e7:
        return f"₹{v / 1e7:.2f} Cr"
    if a >= 1e5:
        return f"₹{v / 1e5:.1f} L"
    return f"₹{v:,.0f}"


def insight(kind: str, severity: int, title: str, detail: str, method: str, value: float | None = None, entity: str | None = None, entity_id: int | None = None, data: Any = None) -> dict[str, Any]:
    return {"kind": kind, "severity": severity, "title": title, "detail": detail, "method": method, "value": value, "entity": entity, "entity_id": entity_id, "data": data}


# ── analyses (pure) ──────────────────────────────────────────────────────────
def forecast_month(monthly: pd.DataFrame, today: date) -> dict[str, Any] | None:
    """monthly: columns month (Timestamp, first day) and total. Uses full months only; returns this month's forecast."""
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    this_month = pd.Timestamp(today.replace(day=1))
    series = monthly[monthly["month"] < this_month].set_index("month")["total"].astype(float).sort_index()
    if len(series) < 6:
        return None
    series.index = pd.DatetimeIndex(series.index).to_period("M")
    fit = ExponentialSmoothing(series, trend="add", initialization_method="estimated").fit()
    pred = float(fit.forecast(1).iloc[0])
    resid_sd = float(np.std(fit.resid, ddof=1)) if len(series) > 2 else 0.0
    low, high = max(0.0, pred - 1.28 * resid_sd), pred + 1.28 * resid_sd
    so_far_row = monthly[monthly["month"] == this_month]["total"]
    so_far = float(so_far_row.iloc[0]) if len(so_far_row) else 0.0
    days_in_month = (this_month + pd.offsets.MonthEnd(0)).day
    elapsed = today.day / days_in_month
    pace = so_far / elapsed if elapsed > 0 else 0.0
    status = "ahead of forecast" if pace > high else "behind forecast" if pace < low else "on track"
    return insight(
        "forecast",
        2 if status == "behind forecast" else 1,
        f"Orders this month on pace for {inr(pace)} — {status}",
        f"Booked {inr(so_far)} in {today.day} of {days_in_month} days. Trend forecast {inr(pred)} (80% range {inr(low)}–{inr(high)}).",
        f"Holt linear trend (statsmodels) on {len(series)} full months",
        value=round(pace, 2),
        data={"history": [{"month": str(p), "total": round(v, 2)} for p, v in series.items()], "forecast": round(pred, 2), "low": round(low, 2), "high": round(high, 2)},
    )


def customer_drops(orders: pd.DataFrame, companies: pd.DataFrame, today: date, top: int = 3) -> list[dict[str, Any]]:
    """orders: company_id, order_date (date), total. companies: id, name."""
    if orders.empty:
        return []
    o = orders.copy()
    o["age"] = (pd.Timestamp(today) - pd.to_datetime(o["order_date"])).dt.days
    recent = o[o["age"] < 60].groupby("company_id").agg(n_recent=("total", "size"), v_recent=("total", "sum"))
    prior = o[(o["age"] >= 60) & (o["age"] < 240)].groupby("company_id").agg(n_prior=("total", "size"), v_prior=("total", "sum"))
    df = prior.join(recent, how="left").fillna(0)
    df = df[df["n_prior"] >= 4]
    df["expected"] = df["n_prior"] * 60 / 180
    df["drop"] = 1 - df["n_recent"] / df["expected"]
    df = df[(df["expected"] >= 2) & (df["drop"] >= 0.6)]
    df["value_at_risk"] = df["v_prior"] / 3 - df["v_recent"]  # prior value per 60 days minus recent value
    names = companies.set_index("id")["name"]
    out = []
    for cid, r in df.sort_values("value_at_risk", ascending=False).head(top).iterrows():
        out.append(
            insight(
                "customer_drop",
                3 if r["n_recent"] == 0 else 2,
                f"{names.get(cid, f'Company #{cid}')} has gone quiet",
                f"{int(r['n_recent'])} orders in the last 60 days vs about {r['expected']:.1f} expected from its previous pace — roughly {inr(max(r['value_at_risk'], 0))} of orders missing.",
                "Order rate, last 60 days vs the 180 days before (≥ 60% drop)",
                value=round(float(max(r["value_at_risk"], 0)), 2),
                entity="companies",
                entity_id=int(cid),
            )
        )
    return out


def stockout_risks(stock: pd.DataFrame, top: int = 3) -> list[dict[str, Any]]:
    """stock: inventory_id, sku, name, warehouse, available, on_order, demand_90d, unit_price."""
    if stock.empty:
        return []
    s = stock.copy()
    s["daily"] = s["demand_90d"] / 90
    s = s[s["daily"] > 0]
    s["cover_days"] = s["available"] / s["daily"]
    s = s[(s["cover_days"] < LEAD_TIME_DAYS) & (s["on_order"] <= 0)]
    s["daily_value"] = s["daily"] * s["unit_price"]
    out = []
    for _, r in s.sort_values("daily_value", ascending=False).head(top).iterrows():
        cover = max(float(r["cover_days"]), 0.0)
        out.append(
            insight(
                "stockout_risk",
                3 if r["available"] <= 0 else 2,
                f"{r['sku']} at {r['warehouse']}: {cover:.0f} days of stock left" if r["available"] > 0 else f"{r['sku']} at {r['warehouse']}: nothing left to sell",
                f"{r['name']} sells about {r['daily']:.1f}/day; {int(r.get('on_hand', r['available']))} on hand, {int(r.get('reserved', 0))} reserved for confirmed orders, nothing on order (lead time ~{LEAD_TIME_DAYS} days).",
                "Days of cover at 90-day average demand, no open purchase order",
                value=round(cover, 1),
                entity="inventory",
                entity_id=int(r["inventory_id"]),
            )
        )
    return out


def weekly_anomaly(order_dates: pd.Series, today: date, weeks: int = 26) -> dict[str, Any] | None:
    """Robust z-score of the last full week's order count against the previous weeks."""
    if order_dates.empty:
        return None
    last_monday = pd.Timestamp(today) - pd.Timedelta(days=today.weekday() + 7)
    starts = [last_monday - pd.Timedelta(weeks=i) for i in range(weeks)][::-1]
    d = pd.to_datetime(order_dates)
    counts = np.array([((d >= s) & (d < s + pd.Timedelta(days=7))).sum() for s in starts], dtype=float)
    history, latest = counts[:-1], counts[-1]
    median = float(np.median(history))
    mad = float(np.median(np.abs(history - median))) or 1.0
    z = 0.6745 * (latest - median) / mad
    if abs(z) < 3:
        return None
    direction = "low" if z < 0 else "high"
    return insight(
        "order_anomaly",
        2,
        f"Orders last week were unusually {direction}",
        f"{int(latest)} orders in the week of {last_monday.date():%d %b} vs a typical {median:.0f} (robust z = {z:.1f}).",
        f"Robust z-score (median/MAD) over {weeks - 1} previous weeks",
        value=round(z, 2),
        data={"weeks": [str(s.date()) for s in starts], "counts": counts.tolist()},
    )


# ── I/O ──────────────────────────────────────────────────────────────────────
def frame(conn: psycopg.Connection, query: str, params: tuple = ()) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(query, params)
        cols = [c.name for c in cur.description]
        return pd.DataFrame(cur.fetchall(), columns=cols)


def compute(conn: psycopg.Connection, today: date) -> list[dict[str, Any]]:
    monthly = frame(conn, "select date_trunc('month', order_date)::date as month, sum(total)::float as total from sales_orders where status <> 'cancelled' and order_date >= %s group by 1 order by 1", (today.replace(day=1) - timedelta(days=760),))
    monthly["month"] = pd.to_datetime(monthly["month"])
    orders = frame(conn, "select company_id, order_date, total::float as total from sales_orders where status <> 'cancelled' and order_date > %s", (today - timedelta(days=240),))
    companies = frame(conn, "select id, name from companies")
    stock = frame(
        conn,
        """
        select inv.id as inventory_id, p.sku, p.name, w.code as warehouse, p.price::float as unit_price,
               inv.qty_on_hand as on_hand, inv.qty_reserved as reserved, inv.qty_on_hand - inv.qty_reserved as available,
               coalesce((select sum(pol.qty - pol.qty_received) from purchase_order_lines pol join purchase_orders po on po.id = pol.purchase_order_id
                         where pol.product_id = inv.product_id and po.warehouse_id = inv.warehouse_id and po.status in ('draft','sent','partially_received')), 0) as on_order,
               coalesce((select sum(l.qty) from sales_order_lines l join sales_orders so on so.id = l.sales_order_id
                         where l.product_id = inv.product_id and so.warehouse_id = inv.warehouse_id and so.status <> 'cancelled' and so.order_date > %s), 0) as demand_90d
        from inventory inv join products p on p.id = inv.product_id join warehouses w on w.id = inv.warehouse_id
        where p.active
        """,
        (today - timedelta(days=90),),
    )
    dates = frame(conn, "select order_date from sales_orders where status <> 'cancelled' and order_date > %s", (today - timedelta(days=7 * 28),))["order_date"]

    out: list[dict[str, Any]] = []
    if (f := forecast_month(monthly, today)) is not None:
        out.append(f)
    out += customer_drops(orders, companies, today)
    out += stockout_risks(stock)
    if (a := weekly_anomaly(dates, today)) is not None:
        out.append(a)
    return out


def write(conn: psycopg.Connection, insights: list[dict[str, Any]]) -> None:
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("delete from ai_insights")
        for i in insights:
            cur.execute(
                "insert into ai_insights (kind, severity, title, detail, entity, entity_id, value, data, method) values (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (i["kind"], i["severity"], i["title"], i["detail"], i["entity"], i["entity_id"], i["value"], Jsonb(i["data"]) if i["data"] is not None else None, i["method"]),
            )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Recompute Ops Suite signals")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    today = datetime.now(IST).date()
    with psycopg.connect(database_url()) as conn:
        insights = compute(conn, today)
        if not args.dry_run:
            write(conn, insights)
    for i in insights:
        print(f"[{['', 'info', 'watch', 'act'][i['severity']]:>5}] {i['title']} — {i['detail']}")
    print(f"\n{len(insights)} signals {'(dry run, nothing written)' if args.dry_run else 'written to ai_insights'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
