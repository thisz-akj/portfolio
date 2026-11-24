import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.OPS_PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

const { canAction, canImport, canWrite } = await import("@/features/demos/ops-suite/auth/permissions");
const { allow } = await import("@/features/demos/ops-suite/lib/rateLimit");

describe("permissions", () => {
  it("lets sales run the CRM and draft orders, but not the warehouse or finance", () => {
    for (const e of ["companies", "contacts", "leads", "deals", "sales-orders"]) expect(canWrite("sales", e)).toBe(true);
    for (const e of ["products", "purchase-orders"]) expect(canWrite("sales", e)).toBe(false);
    expect(canAction("sales", "sales-orders", "confirm")).toBe(true);
    expect(canAction("sales", "sales-orders", "fulfil")).toBe(false);
    expect(canAction("sales", "invoices", "payment")).toBe(false);
    expect(canAction("sales", "leads", "convert")).toBe(true);
    expect(canImport("sales", "leads")).toBe(true);
    expect(canImport("sales", "invoices")).toBe(false);
  });
  it("lets the warehouse fulfil, receive and count stock, but not touch the CRM or money", () => {
    expect(canWrite("warehouse", "deals")).toBe(false);
    expect(canWrite("warehouse", "products")).toBe(true);
    expect(canAction("warehouse", "sales-orders", "fulfil")).toBe(true);
    expect(canAction("warehouse", "purchase-orders", "receive")).toBe(true);
    expect(canAction("warehouse", "inventory", "adjust")).toBe(true);
    expect(canAction("warehouse", "invoices", "payment")).toBe(false);
    expect(canAction("warehouse", "deals", "create-order")).toBe(false);
    expect(canImport("warehouse", "inventory")).toBe(true);
    expect(canImport("warehouse", "leads")).toBe(false);
  });
  it("lets admin do everything", () => {
    expect(canWrite("admin", "products") && canAction("admin", "invoices", "payment") && canImport("admin", "invoices")).toBe(true);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit per window, per key", () => {
    const lim = { max: 3, windowMs: 1000 };
    const t = 1_000_000;
    expect([allow("a", lim, t), allow("a", lim, t + 1), allow("a", lim, t + 2), allow("a", lim, t + 3)]).toEqual([true, true, true, false]);
    expect(allow("b", lim, t + 3)).toBe(true);
    expect(allow("a", lim, t + 1001)).toBe(true); // first hit slid out of the window
  });
});

const { getHandle, closeDb } = await import("@/features/demos/ops-suite/db/client");

describe("personas and reset endpoint", () => {
  beforeAll(async () => {
    const { seed } = await import("@/features/demos/ops-suite/db/seed");
    const log = console.log;
    console.log = () => {};
    await seed((await getHandle()).db).finally(() => (console.log = log));
  }, 120_000);
  afterAll(closeDb);

  it("falls back to the admin persona outside a request and attributes writes to it", async () => {
    const { getPersona, listPersonas } = await import("@/features/demos/ops-suite/auth/persona.server");
    const { currentActor } = await import("@/features/demos/ops-suite/data/audit");
    expect((await getPersona())?.role).toBe("admin");
    expect((await listPersonas()).map((p) => p.role)).toEqual(["admin", "sales", "warehouse"]);
    expect((await currentActor((await getHandle()).db))?.name).toBe("Demo Admin");
  });

  it("refuses the reset without the right secret", async () => {
    const { GET } = await import("@/app/api/demos/ops-suite/cron/reset/route");
    delete process.env.CRON_SECRET;
    expect((await GET(new Request("http://x/api"))).status).toBe(503);
    process.env.CRON_SECRET = "s3cret-value";
    expect((await GET(new Request("http://x/api"))).status).toBe(401);
    expect((await GET(new Request("http://x/api", { headers: { authorization: "Bearer wrong-value" } }))).status).toBe(401);
    delete process.env.CRON_SECRET;
  });
});
