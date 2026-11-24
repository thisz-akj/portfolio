import { count } from "drizzle-orm";
import { getHandle } from "@/features/demos/ops-suite/db/client";
import { auditLog, users } from "@/features/demos/ops-suite/db/schema";

export const dynamic = "force-dynamic";

async function dbStatus() {
  try {
    const { db, driver } = await getHandle();
    const [[u], [a]] = await Promise.all([
      db.select({ n: count() }).from(users),
      db.select({ n: count() }).from(auditLog),
    ]);
    return { ok: true as const, driver, users: u.n, audit: a.n };
  } catch (err) {
    console.error("[ops-suite] database unavailable:", err);
    return { ok: false as const };
  }
}

export default async function Dashboard() {
  const s = await dbStatus();
  return (
    <>
      <div className="ops-head">
        <h1>Dashboard</h1>
        <p>CRM, ERP and data portal on one Postgres database. KPIs and charts land in phase 5.</p>
      </div>
      <section className="ops-card ops-status" aria-live="polite">
        <h2>System status</h2>
        {s.ok ? (
          <dl>
            <div>
              <dt>Database</dt>
              <dd>
                <span className="ops-dot is-ok" aria-hidden="true" /> connected ({s.driver})
              </dd>
            </div>
            <div>
              <dt>Users</dt>
              <dd>{s.users}</dd>
            </div>
            <div>
              <dt>Audit events</dt>
              <dd>{s.audit}</dd>
            </div>
          </dl>
        ) : (
          <p>
            <span className="ops-dot is-down" aria-hidden="true" /> The demo database is unavailable right now.
          </p>
        )}
      </section>
    </>
  );
}
