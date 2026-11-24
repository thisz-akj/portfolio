import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, count, eq } from "drizzle-orm";

process.env.OPS_PGLITE_DIR = "memory://";
delete process.env.DATABASE_URL;

const { getHandle, closeDb } = await import("@/features/demos/ops-suite/db/client");
const { seed } = await import("@/features/demos/ops-suite/db/seed");
const s = await import("@/features/demos/ops-suite/db/schema");
const { parseCsv, toCsv } = await import("@/features/demos/ops-suite/lib/csv");
const { runImport } = await import("@/features/demos/ops-suite/data/importer");
const { sampleCsv } = await import("@/features/demos/ops-suite/data/samples");
const { loadDashboard } = await import("@/features/demos/ops-suite/data/dashboard");
const { niceScale } = await import("@/features/demos/ops-suite/ui/dashboard/Charts");
const { todayIST } = await import("@/features/demos/ops-suite/filters/dates");

let db: Awaited<ReturnType<typeof getHandle>>["db"];
const NOW = new Date();

beforeAll(async () => {
  db = (await getHandle()).db;
  const log = console.log;
  console.log = () => {};
  await seed(db, { now: NOW }).finally(() => (console.log = log));
}, 120_000);
afterAll(closeDb);

const dataset = async (slug: string) => (await db.select().from(s.datasets).where(eq(s.datasets.slug, slug)))[0];
const autoMap = (ds: Awaited<ReturnType<typeof dataset>>, headers: string[]) =>
  Object.fromEntries(ds.schema.columns.map((c) => [c.target, headers.find((h) => h.toLowerCase() === c.source.toLowerCase()) ?? ""]).filter(([, h]) => h));

describe("CSV parser", () => {
  it("handles quotes, escaped quotes, newlines in quotes, CRLF and BOM", () => {
    const csv = '﻿Name,Note\r\n"Shah ""& Co.""","line 1\nline 2"\r\nPlain,x\r\n\r\n';
    expect(parseCsv(csv)).toEqual({ headers: ["Name", "Note"], rows: [['Shah "& Co."', "line 1\nline 2"], ["Plain", "x"]] });
  });
  it("detects semicolons and pads short rows", () => {
    expect(parseCsv("a;b;c\n1;2\n")).toEqual({ headers: ["a", "b", "c"], rows: [["1", "2", ""]] });
  });
  it("round-trips our own CSV writer", () => {
    const rows = [["=1+1", 'He said "hi"'], ["a,b", "c\nd"]];
    expect(parseCsv(toCsv(["x", "y"], rows)).rows).toEqual([["'=1+1", 'He said "hi"'], ["a,b", "c\nd"]]);
  });
  it("rejects broken or oversized files", () => {
    expect(() => parseCsv('a\n"open')).toThrow(/never closed/);
    expect(() => parseCsv("a,a\n1,2")).toThrow(/unique/);
    expect(() => parseCsv("")).toThrow(/empty/);
    expect(() => parseCsv(`h\n${"x\n".repeat(5002)}`)).toThrow(/rows/);
  });
});

describe("imports", () => {
  it("previews without writing anything", async () => {
    const ds = await dataset("marketplace-leads");
    const [before] = await db.select({ n: count() }).from(s.leads);
    const jobsBefore = (await db.select({ n: count() }).from(s.importJobs))[0].n;
    const csv = toCsv(["Buyer Name", "Company", "Email", "Mobile", "City"], [["Asha Rao", "Rao Tools", "asha@rao.example", "9876543210", "Pune"]]);
    const res = await runImport(ds.id, csv, autoMap(ds, ["Buyer Name", "Company", "Email", "Mobile", "City"]), { dryRun: true });
    expect(res.ok && res.outcome).toMatchObject({ total: 1, ok: 1, failed: 0 });
    expect((await db.select({ n: count() }).from(s.leads))[0].n).toBe(before.n);
    expect((await db.select({ n: count() }).from(s.importJobs))[0].n).toBe(jobsBefore);
  });

  it("imports good lead rows and records rejected ones with reasons", async () => {
    const ds = await dataset("marketplace-leads");
    const header = ["Buyer Name", "Company", "Email", "Mobile", "City"];
    const csv = toCsv(header, [
      ["Asha Rao", "Rao Tools", "asha@rao.example", "+91 98765 43210", "Pune"],
      ["Bad Email", "X Ltd", "nope", "9876543210", "Pune"],
      ["No City", "Y Ltd", "y@y.example", "9876543210", "Springfield"],
      ["Asha Again", "Rao Tools", "ASHA@rao.example", "9876543210", "Pune"],
      ["Short Phone", "Z Ltd", "z@z.example", "98765", "Chennai"],
    ]);
    const res = await runImport(ds.id, csv, autoMap(ds, header), { dryRun: false, fileName: "test.csv" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.outcome).toMatchObject({ total: 5, ok: 1, failed: 4 });
    const [lead] = await db.select().from(s.leads).where(eq(s.leads.email, "asha@rao.example"));
    expect(lead).toMatchObject({ source: "indiamart", status: "new", city: "Pune", state: "Maharashtra", phone: "+91 98765 43210", ownerId: null });
    const [job] = await db.select().from(s.importJobs).where(eq(s.importJobs.id, res.outcome.jobId!));
    expect(job).toMatchObject({ status: "partial", rowsOk: 1, rowsFailed: 4, fileName: "test.csv" });
    const rejected = await db.select().from(s.importRejectedRows).where(eq(s.importRejectedRows.jobId, job.id)).orderBy(s.importRejectedRows.rowNumber);
    expect(rejected.map((r) => r.errors[0])).toEqual(["Invalid email address", "Unknown city", "Duplicate of an existing lead", "Phone number must have 10 digits"]);
    expect(rejected[0].rowNumber).toBe(3);
    expect((await dataset("marketplace-leads")).lastImportAt).toBeInstanceOf(Date);
  });

  it("requires required columns to be mapped", async () => {
    const ds = await dataset("stock-count");
    const res = await runImport(ds.id, "SKU,Warehouse\nFAS-0001,CHN-01", { sku: "SKU", warehouse_code: "Warehouse" }, { dryRun: true });
    expect(res.ok === false && res.message).toMatch(/Counted Qty/);
  });

  it("applies price lists, stock counts and payment receipts through the business rules", async () => {
    const [p] = await db.select().from(s.products).limit(1);
    const prices = await dataset("distributor-price-list");
    const pl = await runImport(prices.id, toCsv(["SKU", "Description", "Rate", "GST %", "HSN"], [[p.sku, p.name, "1234", "12", "7318"], ["XXX-0001", "?", "10", "18", "7318"]]), autoMap(prices, ["SKU", "Description", "Rate", "GST %", "HSN"]), { dryRun: false });
    expect(pl.ok && pl.outcome).toMatchObject({ ok: 1, failed: 1 });
    expect((await db.select().from(s.products).where(eq(s.products.id, p.id)))[0]).toMatchObject({ price: 1234, gstRate: 12 });

    const stock = await dataset("stock-count");
    const [w] = await db.select().from(s.warehouses).limit(1);
    const sc = await runImport(stock.id, toCsv(["SKU", "Warehouse", "Counted Qty"], [[p.sku, w.code, "0"], [p.sku, "PNQ-02", "4"], [p.sku, w.code, "-1"]]), autoMap(stock, ["SKU", "Warehouse", "Counted Qty"]), { dryRun: false });
    expect(sc.ok && sc.outcome).toMatchObject({ ok: 1, failed: 2 });
    expect((await db.select().from(s.inventory).where(and(eq(s.inventory.productId, p.id), eq(s.inventory.warehouseId, w.id))))[0].qtyOnHand).toBe(0);

    const ledger = await dataset("accounting-ledger-sync");
    const [inv] = await db.select().from(s.invoices).where(eq(s.invoices.status, "sent")).limit(1);
    const today = todayIST();
    const half = Math.round((inv.total - inv.amountPaid) * 50) / 100;
    const pay = await runImport(ledger.id, toCsv(["voucher_ref", "amount", "date"], [[inv.number, String(half), today], [inv.number, String(inv.total), today], [inv.number, "10", "24/11/2026"]]), autoMap(ledger, ["voucher_ref", "amount", "date"]), { dryRun: false });
    expect(pay.ok && pay.outcome).toMatchObject({ ok: 1, failed: 2 });
    if (pay.ok) expect(pay.outcome.sample.filter((r) => !r.ok).map((r) => r.errors[0])).toEqual(["Amount exceeds invoice balance", "Invalid date format (expected YYYY-MM-DD)"]);
    expect((await db.select().from(s.invoices).where(eq(s.invoices.id, inv.id)))[0]).toMatchObject({ status: "partially_paid", amountPaid: Math.round((inv.amountPaid + half) * 100) / 100 });
  });

  it.each(["marketplace-leads", "website-enquiries", "distributor-price-list", "accounting-ledger-sync", "stock-count"])("sample file for %s imports with some rejects", async (slug) => {
    const csv = await sampleCsv(slug);
    expect(csv).toBeTruthy();
    const ds = await dataset(slug);
    const res = await runImport(ds.id, csv!, autoMap(ds, parseCsv(csv!).headers), { dryRun: true });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.outcome.ok).toBeGreaterThan(5);
      expect(res.outcome.failed).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("dashboard", () => {
  it("computes KPIs and chart series consistent with the data", async () => {
    const d = await loadDashboard(NOW);
    expect(d.kpis.map((k) => k.key)).toEqual(["revenue", "pipeline", "overdue", "win", "fulfil", "stock"]);
    expect(d.revenue).toHaveLength(12);
    expect(d.funnel.map((p) => p.label)).toEqual(["New", "Qualified", "Proposal", "Negotiation"]);
    expect(d.aging).toHaveLength(5);
    const open = await db.select().from(s.invoices);
    const overdue = open.filter((i) => (i.status === "sent" || i.status === "partially_paid") && i.dueDate < todayIST(NOW)).reduce((a, i) => a + i.total - i.amountPaid, 0);
    expect(d.kpis.find((k) => k.key === "overdue")!.value).toBeCloseTo(overdue, 0);
    const agingTotal = d.aging.reduce((a, p) => a + p.value, 0);
    const unpaid = open.filter((i) => i.status === "sent" || i.status === "partially_paid").reduce((a, i) => a + i.total - i.amountPaid, 0);
    expect(agingTotal).toBeCloseTo(unpaid, 0);
    for (const k of d.kpis) expect(k.href).toMatch(/^\/demos\/ops-suite\/app\//);
    expect(d.feed.length).toBeGreaterThan(0);
  });

  it("picks readable axis maxima", () => {
    expect(niceScale(87_000_000)).toEqual({ max: 100_000_000, step: 25_000_000 });
    expect(niceScale(0)).toEqual({ max: 1, step: 0.25 });
    expect(niceScale(9)).toEqual({ max: 10, step: 2.5 });
  });
});

describe("portal detail", () => {
  it("opens datasets with an import action and runs with rejected rows", async () => {
    const { getDetail } = await import("@/features/demos/ops-suite/data/detail");
    const ds = await dataset("marketplace-leads");
    const d = await getDetail("datasets", ds.id);
    expect(d?.actions.map((a) => a.key)).toEqual(["import"]);
    expect(JSON.parse(String(d?.context?.schema))).toHaveLength(5);
    const [job] = await db.select().from(s.importJobs).where(eq(s.importJobs.status, "partial")).limit(1);
    const j = await getDetail("imports", job.id);
    expect(j?.sections.find((x) => x.key === "rejected")?.items.length).toBeGreaterThan(0);
  });
});
