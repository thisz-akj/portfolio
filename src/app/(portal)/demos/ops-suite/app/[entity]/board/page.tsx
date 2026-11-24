import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadBoard } from "@/features/demos/ops-suite/data/board";
import { getEntityServer } from "@/features/demos/ops-suite/entities/server";
import { parseListQuery, serializeListQuery } from "@/features/demos/ops-suite/filters/parse";
import { Board } from "@/features/demos/ops-suite/ui/table/Board";
import { ViewToggle } from "@/features/demos/ops-suite/ui/table/ViewToggle";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ entity: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ent = getEntityServer((await params).entity);
  return { title: ent ? `${ent.meta.label} board — Ops Suite` : "Ops Suite" };
}

export default async function BoardPage({ params, searchParams }: Props) {
  const { entity } = await params;
  const ent = getEntityServer(entity);
  if (!ent?.meta.board) notFound();
  const query = parseListQuery(ent.meta, await searchParams);
  let data: Awaited<ReturnType<typeof loadBoard>>;
  try {
    data = await loadBoard(ent, query);
  } catch (err) {
    console.error(`[ops-suite] board ${entity} failed:`, err);
    return (
      <section className="ops-card" role="alert">
        <p>
          <span className="ops-dot is-down" aria-hidden="true" /> Couldn&apos;t load the board — the demo database is unavailable right now.
        </p>
      </section>
    );
  }
  const search = serializeListQuery(ent.meta, { ...query, page: 1, sort: ent.meta.defaultSort, cols: null }).toString();
  return (
    <>
      <div className="ops-head ops-head-row">
        <h1>{ent.meta.label}</h1>
        <ViewToggle entity={entity} current="board" search={search} />
      </div>
      <Board entity={entity} query={query} columns={data.columns} options={data.options} />
    </>
  );
}
