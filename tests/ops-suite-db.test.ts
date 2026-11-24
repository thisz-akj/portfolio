import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { count } from "drizzle-orm";

process.env.OPS_PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

const { getHandle, closeDb } = await import("@/features/demos/ops-suite/db/client");
const { seed, personas } = await import("@/features/demos/ops-suite/db/seed");
const { users, auditLog } = await import("@/features/demos/ops-suite/db/schema");
const { portalNav, PORTAL_BASE } = await import("@/features/demos/ops-suite/nav");

describe("ops-suite database", () => {
  beforeAll(async () => {
    await getHandle();
  }, 30_000);
  afterAll(closeDb);

  it("migrates and seeds idempotently", async () => {
    const { db, driver } = await getHandle();
    expect(driver).toBe("pglite");
    await seed(db);
    await seed(db);
    const [{ n }] = await db.select({ n: count() }).from(users);
    expect(n).toBe(personas.length);
  });

  it("writes audit events with jsonb payloads", async () => {
    const { db } = await getHandle();
    const [admin] = await db.select().from(users).limit(1);
    await db.insert(auditLog).values({ actorId: admin.id, action: "create", entity: "users", entityId: String(admin.id), after: { role: admin.role } });
    const [row] = await db.select().from(auditLog);
    expect(row.after).toEqual({ role: admin.role });
  });
});

describe("ops-suite nav", () => {
  it("has unique hrefs under the portal base", () => {
    const hrefs = portalNav.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const h of hrefs) expect(h.startsWith(PORTAL_BASE)).toBe(true);
  });
});
