import { count } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getHandle } from "@/features/demos/ops-suite/db/client";
import * as s from "@/features/demos/ops-suite/db/schema";

export const dynamic = "force-dynamic";

const modules: { label: string; tables: [string, PgTable][] }[] = [
  { label: "CRM", tables: [["Companies", s.companies], ["Contacts", s.contacts], ["Leads", s.leads], ["Deals", s.deals], ["Activities", s.activities]] },
  { label: "ERP", tables: [["Products", s.products], ["Sales orders", s.salesOrders], ["Purchase orders", s.purchaseOrders], ["Invoices", s.invoices], ["Payments", s.payments]] },
  { label: "Data portal", tables: [["Datasets", s.datasets], ["Import jobs", s.importJobs], ["Audit events", s.auditLog]] },
];

async function dbStatus() {
  try {
    const { db, driver } = await getHandle();
    const counts = await Promise.all(
      modules.map(async (m) => ({
        label: m.label,
        rows: await Promise.all(m.tables.map(async ([name, t]) => ({ name, n: (await db.select({ n: count() }).from(t))[0].n }))),
      })),
    );
    return { ok: true as const, driver, counts };
  } catch (err) {
    console.error("[ops-suite] database unavailable:", err);
    return { ok: false as const };
  }
}

const fmt = new Intl.NumberFormat("en-IN");

export default async function Dashboard() {
  const st = await dbStatus();
  return (
    <>
      <div className="ops-head">
        <h1>Dashboard</h1>
        <p>CRM, ERP and data portal on one Postgres database. KPIs and charts land in phase 5.</p>
      </div>
      {st.ok ? (
        <>
          <p className="ops-conn">
            <span className="ops-dot is-ok" aria-hidden="true" /> Connected to {st.driver}
          </p>
          {st.counts.map((m) => (
            <section key={m.label} className="ops-card ops-status">
              <h2>{m.label}</h2>
              <dl>
                {m.rows.map((r) => (
                  <div key={r.name}>
                    <dt>{r.name}</dt>
                    <dd>{fmt.format(r.n)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </>
      ) : (
        <section className="ops-card ops-status" aria-live="polite">
          <p>
            <span className="ops-dot is-down" aria-hidden="true" /> The demo database is unavailable right now.
          </p>
        </section>
      )}
    </>
  );
}
