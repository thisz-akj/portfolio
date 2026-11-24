import { sampleCsv } from "@/features/demos/ops-suite/data/samples";

export const dynamic = "force-dynamic";

/** Sample CSV for a dataset (live data + a few deliberately invalid rows). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return new Response("Not found", { status: 404 });
  try {
    const csv = await sampleCsv(slug);
    if (!csv) return new Response("Not found", { status: 404 });
    return new Response(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}-sample.csv"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[ops-suite] sample csv failed:", err);
    return new Response("The demo database is unavailable right now.", { status: 503 });
  }
}
