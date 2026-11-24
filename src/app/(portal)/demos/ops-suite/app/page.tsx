import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { loadDashboard, type Dashboard, type Kpi } from "@/features/demos/ops-suite/data/dashboard";
import { formatINR } from "@/features/demos/ops-suite/lib/format";
import { BarList, ColumnChart } from "@/features/demos/ops-suite/ui/dashboard/Charts";
import { PORTAL_BASE } from "@/features/demos/ops-suite/nav";

export const dynamic = "force-dynamic";

const rel = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });
function ago(iso: string, now: number) {
  const s = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return rel.format(s, "second");
  if (abs < 3600) return rel.format(Math.round(s / 60), "minute");
  if (abs < 86_400) return rel.format(Math.round(s / 3600), "hour");
  return rel.format(Math.round(s / 86_400), "day");
}

function KpiTile({ k }: { k: Kpi }) {
  const value = k.format === "inr" ? formatINR(k.value, { compact: true }) : k.format === "pct" ? `${Math.round(k.value * 100)}%` : k.value.toLocaleString("en-IN");
  const up = (k.delta?.value ?? 0) >= 0;
  return (
    <Link href={k.href} className="ops-kpi">
      <span className="ops-kpi-label">{k.label}</span>
      <strong className="ops-kpi-value" title={k.format === "inr" ? formatINR(k.value) : undefined}>
        {value}
      </strong>
      {k.delta && (
        <span className={`ops-kpi-delta ${up ? "is-up" : "is-down"}`}>
          {up ? <ArrowUpRight size={13} aria-hidden="true" /> : <ArrowDownRight size={13} aria-hidden="true" />}
          {up ? "+" : "−"}
          {Math.abs(Math.round(k.delta.value * 100))}% <em>{k.delta.label}</em>
        </span>
      )}
      {k.sub && <span className="ops-kpi-sub">{k.sub}</span>}
    </Link>
  );
}

export default async function DashboardPage() {
  let d: Dashboard;
  try {
    d = await loadDashboard();
  } catch (err) {
    console.error("[ops-suite] dashboard failed:", err);
    return (
      <section className="ops-card" role="alert">
        <p>
          <span className="ops-dot is-down" aria-hidden="true" /> The demo database is unavailable right now.
        </p>
      </section>
    );
  }
  const now = Date.now();
  return (
    <>
      <div className="ops-head">
        <h1>Dashboard</h1>
        <p>One database behind the CRM, ERP and data portal. Every number links to the records behind it.</p>
      </div>

      <section className="ops-kpis" aria-label="Key figures">
        {d.kpis.map((k) => (
          <KpiTile key={k.key} k={k} />
        ))}
      </section>

      <div className="ops-dash">
        <section className="ops-card ops-dash-wide">
          <ColumnChart title="Orders booked by month" note="₹ incl. GST, excluding cancelled · * month to date" points={d.revenue} valueLabel="Orders (₹)" />
        </section>
        <section className="ops-card">
          <BarList title="Open pipeline by stage" note="Deal value" points={d.funnel} valueLabel="Value (₹)" />
        </section>
        <section className="ops-card">
          <BarList title="Receivables by age" note="Unpaid balance, days past due" points={d.aging} valueLabel="Balance (₹)" />
        </section>
        <section className="ops-card">
          <BarList title="Top customers" note="Orders in the last 12 months" points={d.topCustomers} valueLabel="Orders (₹)" />
        </section>
        <section className="ops-card ops-signals ops-dash-wide" aria-labelledby="signals-title">
          <h2 id="signals-title" className="viz-title">
            Signals <span>forecast and anomalies, computed by the Python insights job</span>
          </h2>
          {d.signals.length ? (
            <ul>
              {d.signals.map((sg) => (
                <li key={sg.id} className={`is-sev-${sg.severity}`}>
                  <span className="ops-signal-sev" aria-label={["", "Info", "Watch", "Act"][sg.severity]}>
                    {["", "Info", "Watch", "Act"][sg.severity]}
                  </span>
                  <div>
                    {sg.href ? <Link href={sg.href}>{sg.title}</Link> : <strong>{sg.title}</strong>}
                    <p>{sg.detail}</p>
                    <p className="ops-feed-meta">
                      {sg.method} · computed {ago(sg.computedAt, now)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="aq-empty">
              No signals yet. They come from <code>ops-ai</code> (pandas + statsmodels): <code>cd ops-ai &amp;&amp; python -m ops_ai.insights</code> — and nightly
              in CI after the demo reset.
            </p>
          )}
        </section>
        <section className="ops-card ops-feed" aria-labelledby="feed-title">
          <h2 id="feed-title" className="viz-title">
            Activity
            <Link href={`${PORTAL_BASE}/audit-log`} className="ops-link">
              Audit log
            </Link>
          </h2>
          <ol>
            {d.feed.map((f) => (
              <li key={f.id}>
                {f.href ? <Link href={f.href}>{f.summary}</Link> : <span>{f.summary}</span>}
                <span className="ops-feed-meta">
                  <time dateTime={f.at}>{ago(f.at, now)}</time>
                  {f.actor && ` · ${f.actor}`}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
