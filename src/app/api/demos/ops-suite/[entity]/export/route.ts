import { exportRows } from "@/features/demos/ops-suite/data/list";
import { getEntityServer } from "@/features/demos/ops-suite/entities/server";
import { todayIST } from "@/features/demos/ops-suite/filters/dates";
import { parseListQuery } from "@/features/demos/ops-suite/filters/parse";
import { fieldOf } from "@/features/demos/ops-suite/filters/types";
import { toCsv } from "@/features/demos/ops-suite/lib/csv";

export const dynamic = "force-dynamic";

/** CSV of the current list view (same filters/sort/columns as the table), or of selected ids. Capped at 10k rows. */
export async function GET(req: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const ent = getEntityServer(entity);
  if (!ent) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const query = parseListQuery(ent.meta, url.searchParams);
  const ids = url.searchParams
    .get("ids")
    ?.split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 1000);

  try {
    const { rows, cols } = await exportRows(ent, query, ids?.length ? ids : null);
    const fields = cols.map((k) => fieldOf(ent.meta, k)!);
    const csv = toCsv(
      fields.map((f) => f.label),
      rows.map((r) =>
        fields.map((f) => {
          if (f.type === "relation" && f.labelKey) return r[f.labelKey];
          if (f.type === "enum") return f.options?.find((o) => o.value === r[f.key])?.label ?? r[f.key];
          return r[f.key];
        }),
      ),
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${entity}-${todayIST()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(`[ops-suite] export ${entity} failed:`, err);
    return new Response("The demo database is unavailable right now.", { status: 503 });
  }
}
