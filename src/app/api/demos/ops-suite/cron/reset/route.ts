import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/features/demos/ops-suite/db/client";
import { seed } from "@/features/demos/ops-suite/db/seed";
import { PORTAL_BASE } from "@/features/demos/ops-suite/nav";
import { resetRateLimits } from "@/features/demos/ops-suite/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Nightly reset of the public demo: replaces all data with a fresh synthetic dataset (one transaction).
 * Called by Vercel Cron (vercel.json) with `Authorization: Bearer $CRON_SECRET`. Disabled when CRON_SECRET is unset.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Reset is not configured", { status: 503 });
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response("Unauthorized", { status: 401 });
  try {
    const started = Date.now();
    const counts = await seed(await getDb());
    resetRateLimits();
    revalidatePath(PORTAL_BASE, "layout");
    return Response.json({ ok: true, ms: Date.now() - started, counts });
  } catch (err) {
    console.error("[ops-suite] nightly reset failed:", err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
