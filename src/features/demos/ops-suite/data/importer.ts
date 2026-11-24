import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { datasets, importJobs, importRejectedRows, inventory, invoices, leads, products, warehouses } from "../db/schema";
import type { DatasetSchema } from "../db/schema/portal";
import { CITIES } from "../db/seed/reference";
import { forms, validateForm } from "../entities/forms";
import { parseAmount } from "../lib/format";
import { parseCsv } from "../lib/csv";
import { currentActor, FlowError, writeAudit, type Actor, type Tx } from "./audit";
import { autoReorder, recordPayment } from "./erp";

/**
 * CSV imports for the data portal. Each dataset maps CSV columns onto a target; every row is validated and applied
 * inside its own savepoint, so bad rows are rejected (with reasons) without undoing good ones.
 * A preview runs the exact same import in a transaction that is rolled back — duplicates and running balances
 * are therefore previewed faithfully.
 */

export type Mapping = Record<string, string>; // target field → CSV header
export interface RowResult {
  row: number; // 1-based line number in the file (header = 1)
  ok: boolean;
  errors: string[];
  values: Record<string, string>;
}
export interface ImportOutcome {
  total: number;
  ok: number;
  failed: number;
  sample: RowResult[];
  jobId?: number;
}

const SAMPLE = 15;
const MAX_REJECTED_STORED = 200;

class Reject extends Error {}
class DryRun extends Error {
  constructor(public outcome: ImportOutcome) {
    super("dry run");
  }
}

type Handler = (tx: Tx, v: Record<string, string>, ctx: { actor: Actor; datasetSlug: string; touched: Set<string> }) => Promise<void>;

const reject = (msg: string): never => {
  throw new Reject(msg);
};

const HANDLERS: Record<string, Handler> = {
  async leads(tx, v, ctx) {
    const city = CITIES.find((c) => c.city.toLowerCase() === (v.city ?? "").trim().toLowerCase());
    if (!city) reject(v.city ? "Unknown city" : "City is required");
    const digits = (v.phone ?? "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    if (v.phone && digits.length !== 10) reject("Phone number must have 10 digits");
    const check = validateForm(forms.leads, {
      name: v.name,
      companyName: v.company_name,
      email: v.email,
      phone: digits ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : "",
      source: ctx.datasetSlug === "website-enquiries" ? "website" : "indiamart",
      status: "new",
      score: 40,
      city: city!.city,
      state: city!.state,
    });
    if (!check.ok) {
      const label: Record<string, string> = { name: "Missing name", companyName: "Missing company name", email: "Invalid email address" };
      reject(Object.entries(check.errors).map(([k, e]) => label[k] ?? `${k}: ${e}`).join("; "));
    }
    const values = (check as { values: Record<string, unknown> }).values;
    const [dup] = await tx.select({ id: leads.id }).from(leads).where(sql`lower(${leads.email}) = ${String(values.email)}`).limit(1);
    if (dup) reject("Duplicate of an existing lead");
    await tx.insert(leads).values(values as typeof leads.$inferInsert);
  },

  async products(tx, v) {
    const [p] = await tx.select().from(products).where(eq(products.sku, (v.sku ?? "").toUpperCase()));
    if (!p) reject("Unknown SKU");
    const price = parseAmount(v.price ?? "");
    if (price === null || price <= 0) reject("Price must be a positive number");
    const gst = Number(v.gst_rate);
    if (![5, 12, 18, 28].includes(gst)) reject("GST rate must be 5, 12, 18 or 28");
    if (!/^\d{4,8}$/.test(v.hsn_code ?? "")) reject("Missing HSN code");
    await tx
      .update(products)
      .set({ price: price!, gstRate: gst, hsnCode: v.hsn_code, ...(v.name ? { name: v.name.slice(0, 140) } : {}) })
      .where(eq(products.id, p!.id));
  },

  async inventory(tx, v, ctx) {
    const [p] = await tx.select({ id: products.id }).from(products).where(eq(products.sku, (v.sku ?? "").toUpperCase()));
    if (!p) reject("Unknown SKU");
    const [w] = await tx.select({ id: warehouses.id }).from(warehouses).where(eq(warehouses.code, (v.warehouse_code ?? "").toUpperCase()));
    if (!w) reject("Unknown warehouse code");
    if (!/^\d+$/.test(v.qty_on_hand ?? "")) reject("Quantity must be a non-negative integer");
    const updated = await tx
      .update(inventory)
      .set({ qtyOnHand: Number(v.qty_on_hand) })
      .where(and(eq(inventory.productId, p!.id), eq(inventory.warehouseId, w!.id)))
      .returning({ id: inventory.id });
    if (!updated.length) await tx.insert(inventory).values({ productId: p!.id, warehouseId: w!.id, qtyOnHand: Number(v.qty_on_hand), reorderLevel: 10 });
    ctx.touched.add(`${p!.id}:${w!.id}`);
  },

  async invoices(tx, v, ctx) {
    const [inv] = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.number, (v.invoice_number ?? "").toUpperCase()));
    if (!inv) reject("Invoice number not found");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.paid_on ?? "")) reject("Invalid date format (expected YYYY-MM-DD)");
    const amount = parseAmount(v.amount ?? "");
    if (amount === null) reject("Amount must be a number");
    try {
      await recordPayment(tx, inv!.id, { amount: amount!, method: "neft", reference: `Ledger sync`, paidOn: v.paid_on }, ctx.actor);
    } catch (err) {
      if (err instanceof FlowError) reject(err.message.replace(/^Amount is more than the balance.*/, "Amount exceeds invoice balance"));
      throw err;
    }
  },
};

export const SUPPORTED_TARGETS = Object.keys(HANDLERS);

async function loadDataset(tx: Tx, datasetId: number) {
  const [ds] = await tx.select().from(datasets).where(eq(datasets.id, datasetId));
  if (!ds) throw new FlowError("Dataset not found");
  if (!HANDLERS[ds.targetEntity]) throw new FlowError("This dataset can't be imported from a file");
  return ds;
}

/** Validates the mapping against the dataset schema; returns header index per target field. */
function resolveMapping(schema: DatasetSchema, headers: string[], mapping: Mapping) {
  const index: Record<string, number> = {};
  for (const col of schema.columns) {
    const header = mapping[col.target];
    const i = header ? headers.indexOf(header) : -1;
    if (i < 0 && col.required) throw new FlowError(`Map a column to “${col.source}”`);
    if (i >= 0) index[col.target] = i;
  }
  return index;
}

export async function runImport(datasetId: number, csvText: string, mapping: Mapping, opts: { dryRun: boolean; fileName?: string }): Promise<{ ok: true; outcome: ImportOutcome } | { ok: false; message: string }> {
  let parsed: ReturnType<typeof parseCsv>;
  try {
    parsed = parseCsv(csvText);
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  if (!parsed.rows.length) return { ok: false, message: "The file has a header but no rows" };

  const db = await getDb();
  const started = new Date();
  try {
    const outcome = await db.transaction(async (tx) => {
      const actor = await currentActor(tx);
      const ds = await loadDataset(tx, datasetId);
      const index = resolveMapping(ds.schema, parsed.headers, mapping);
      const handler = HANDLERS[ds.targetEntity];
      const results: RowResult[] = [];
      const touched = new Set<string>();

      for (const [n, cells] of parsed.rows.entries()) {
        const values = Object.fromEntries(Object.entries(index).map(([target, i]) => [target, cells[i] ?? ""]));
        try {
          await tx.transaction(async (sp) => handler(sp, values, { actor, datasetSlug: ds.slug, touched }));
          results.push({ row: n + 2, ok: true, errors: [], values });
        } catch (err) {
          if (!(err instanceof Reject)) throw err;
          results.push({ row: n + 2, ok: false, errors: [err.message], values });
        }
      }

      if (ds.targetEntity === "inventory" && touched.size) {
        const byWh = new Map<number, number[]>();
        for (const k of touched) {
          const [p, w] = k.split(":").map(Number);
          byWh.set(w, [...(byWh.get(w) ?? []), p]);
        }
        for (const [w, ps] of byWh) await autoReorder(tx, ps, w, actor);
      }

      const ok = results.filter((r) => r.ok).length;
      const failed = results.length - ok;
      const outcome: ImportOutcome = { total: results.length, ok, failed, sample: [...results.filter((r) => !r.ok).slice(0, SAMPLE), ...results.filter((r) => r.ok)].slice(0, SAMPLE) };
      if (opts.dryRun) throw new DryRun(outcome);

      const status = failed === 0 ? "succeeded" : ok === 0 ? "failed" : "partial";
      const finished = new Date();
      const [job] = await tx
        .insert(importJobs)
        .values({ datasetId, status, fileName: (opts.fileName ?? "upload.csv").slice(0, 120), rowsTotal: results.length, rowsOk: ok, rowsFailed: failed, error: ok === 0 ? "Every row was rejected" : null, startedAt: started, finishedAt: finished, createdBy: actor?.id ?? null })
        .returning();
      const rejected = results.filter((r) => !r.ok).slice(0, MAX_REJECTED_STORED);
      if (rejected.length) await tx.insert(importRejectedRows).values(rejected.map((r) => ({ jobId: job.id, rowNumber: r.row, raw: r.values, errors: r.errors })));
      await tx.update(datasets).set({ lastImportAt: finished }).where(eq(datasets.id, datasetId));
      await writeAudit(tx, actor, "import_jobs", job.id, `import.${status}`, `${ds.name}: ${ok} rows imported${failed ? `, ${failed} rejected` : ""} from ${job.fileName}`, null, { status, ok, failed });
      return { ...outcome, jobId: job.id };
    });
    return { ok: true, outcome };
  } catch (err) {
    if (err instanceof DryRun) return { ok: true, outcome: err.outcome };
    if (err instanceof FlowError) return { ok: false, message: err.message };
    throw err;
  }
}
