import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadRun } from "@/features/demos/ops-suite/ai/quality.server";
import { formatDate } from "@/features/demos/ops-suite/lib/format";
import { PORTAL_BASE } from "@/features/demos/ops-suite/nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Eval run" };

export default async function EvalRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const data = await loadRun(Number(id));
  if (!data) notFound();
  const { run, results } = data;
  return (
    <>
      <Link href={`${PORTAL_BASE}/ai-quality`} className="ops-back-link">
        <ArrowLeft size={14} /> AI quality
      </Link>
      <div className="ops-head">
        <h1>Test run #{run.id}</h1>
        <p>
          {run.passed}/{run.cases} correct · {formatDate(run.startedAt)}
          {run.costUsd !== null && ` · $${run.costUsd.toFixed(4)}`}
          {run.notes && ` · ${run.notes}`}
        </p>
      </div>
      <div className="ops-scroll">
        <table className="ops-table ops-lines">
          <thead>
            <tr>
              <th>Result</th>
              <th>Question</th>
              <th>Why</th>
              <th className="is-end">Latency</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id}>
                <td className={r.pass ? "aq-pass" : "aq-fail"}>{r.pass ? "Pass" : "Fail"}</td>
                <td>{r.question}</td>
                <td>{r.reason ?? ""}</td>
                <td className="is-end">{r.latencyMs === null ? "—" : `${(r.latencyMs / 1000).toFixed(1)} s`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
