import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listEntity, type ListResult } from "@/features/demos/ops-suite/data/list";
import { getEntityServer } from "@/features/demos/ops-suite/entities/server";
import { parseListQuery, serializeListQuery } from "@/features/demos/ops-suite/filters/parse";
import { DataTable } from "@/features/demos/ops-suite/ui/table/DataTable";
import { ViewToggle } from "@/features/demos/ops-suite/ui/table/ViewToggle";

// Per-request: rows depend on the URL and live data. (No loading.tsx on purpose: streaming a skeleton
// would send a 200 before notFound() can return a 404 for unknown entities.)
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ entity: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ent = getEntityServer((await params).entity);
  return { title: ent ? `${ent.meta.label} — Ops Suite` : "Ops Suite" };
}

export default async function EntityListPage({ params, searchParams }: Props) {
  const { entity } = await params;
  const ent = getEntityServer(entity);
  if (!ent) notFound();
  const query = parseListQuery(ent.meta, await searchParams);

  let result: ListResult;
  try {
    result = await listEntity(ent, query);
  } catch (err) {
    console.error(`[ops-suite] listing ${entity} failed:`, err);
    return (
      <section className="ops-card" role="alert">
        <p>
          <span className="ops-dot is-down" aria-hidden="true" /> Couldn&apos;t load {ent.meta.label.toLowerCase()} — the demo database is unavailable right now.
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="ops-head ops-head-row">
        <h1>{ent.meta.label}</h1>
        {ent.meta.board && <ViewToggle entity={entity} current="table" search={serializeListQuery(ent.meta, { ...query, page: 1, sort: ent.meta.defaultSort, cols: null }).toString()} />}
      </div>
      <DataTable entity={entity} query={{ ...query, page: result.page }} rows={result.rows} total={result.total} facets={result.facets} options={result.options} />
    </>
  );
}
