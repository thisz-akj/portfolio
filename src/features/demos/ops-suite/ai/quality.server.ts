import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { aiEvalResults, aiEvalRuns, aiTraces } from "../db/schema";
import { GOLDEN } from "./golden";

/** Numbers for the AI quality page: live monitoring from traces, offline evals from the Python harness. Server-only. */

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function loadQuality() {
  const db = await getDb();
  const since = sql`now() - interval '7 days'`;
  const live = and(ne(aiTraces.status, "example"), gte(aiTraces.at, since));
  const [[stats], daily, problems, recent, runs] = await Promise.all([
    db
      .select({
        total: sql`count(*)`,
        ok: sql`count(*) filter (where ${aiTraces.status} = 'ok')`,
        invalid: sql`count(*) filter (where ${aiTraces.status} = 'invalid')`,
        refused: sql`count(*) filter (where ${aiTraces.status} = 'refused')`,
        errors: sql`count(*) filter (where ${aiTraces.status} = 'error')`,
        p50: sql`percentile_cont(0.5) within group (order by ${aiTraces.latencyMs})`,
        p95: sql`percentile_cont(0.95) within group (order by ${aiTraces.latencyMs})`,
        cost: sql`coalesce(sum(${aiTraces.costUsd}), 0)`,
        avgCost: sql`avg(${aiTraces.costUsd})`,
        up: sql`count(*) filter (where ${aiTraces.feedback} = 1)`,
        down: sql`count(*) filter (where ${aiTraces.feedback} = -1)`,
        fallbacks: sql`count(*) filter (where ${aiTraces.servedBy} is distinct from ${aiTraces.model})`,
      })
      .from(aiTraces)
      .where(live),
    db
      .select({
        day: sql<string>`to_char((${aiTraces.at} at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD')`,
        total: sql`count(*)`,
        ok: sql`count(*) filter (where ${aiTraces.status} = 'ok')`,
      })
      .from(aiTraces)
      .where(and(ne(aiTraces.status, "example"), gte(aiTraces.at, sql`now() - interval '14 days'`)))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db.select().from(aiTraces).where(inArray(aiTraces.status, ["invalid", "error", "refused"])).orderBy(desc(aiTraces.at)).limit(8),
    db.select().from(aiTraces).where(ne(aiTraces.status, "example")).orderBy(desc(aiTraces.at)).limit(10),
    db.select().from(aiEvalRuns).orderBy(desc(aiEvalRuns.startedAt)).limit(20),
  ]);

  // accuracy by tag for the latest finished run
  const latest = runs.find((r) => r.finishedAt);
  let byTag: { tag: string; passed: number; total: number }[] = [];
  if (latest) {
    const results = await db.select({ caseId: aiEvalResults.caseId, pass: aiEvalResults.pass }).from(aiEvalResults).where(eq(aiEvalResults.runId, latest.id));
    const tags = new Map<string, { passed: number; total: number }>();
    for (const r of results) {
      for (const t of GOLDEN.find((g) => g.id === r.caseId)?.tags ?? []) {
        const cur = tags.get(t) ?? { passed: 0, total: 0 };
        cur.total++;
        if (r.pass) cur.passed++;
        tags.set(t, cur);
      }
    }
    byTag = [...tags.entries()].map(([tag, v]) => ({ tag, ...v })).sort((a, b) => a.passed / a.total - b.passed / b.total);
  }

  return {
    stats: {
      total: n(stats.total) ?? 0,
      ok: n(stats.ok) ?? 0,
      invalid: n(stats.invalid) ?? 0,
      refused: n(stats.refused) ?? 0,
      errors: n(stats.errors) ?? 0,
      p50: n(stats.p50),
      p95: n(stats.p95),
      cost: n(stats.cost) ?? 0,
      avgCost: n(stats.avgCost),
      up: n(stats.up) ?? 0,
      down: n(stats.down) ?? 0,
      fallbacks: n(stats.fallbacks) ?? 0,
    },
    daily: daily.map((d) => ({ day: d.day, total: n(d.total) ?? 0, ok: n(d.ok) ?? 0 })),
    problems,
    recent,
    runs,
    latest: latest ?? null,
    byTag,
    goldenSize: GOLDEN.length,
  };
}

export async function loadRun(id: number) {
  const db = await getDb();
  const [run] = await db.select().from(aiEvalRuns).where(eq(aiEvalRuns.id, id));
  if (!run) return null;
  const results = await db.select().from(aiEvalResults).where(eq(aiEvalResults.runId, id)).orderBy(asc(aiEvalResults.pass), asc(aiEvalResults.caseId));
  return { run, results };
}
