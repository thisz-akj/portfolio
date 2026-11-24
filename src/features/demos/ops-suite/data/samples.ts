import { Faker, base, en, en_IN } from "@faker-js/faker";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { inventory, invoices, leads, products, warehouses } from "../db/schema";
import { CITIES } from "../db/seed/reference";
import { toCsv } from "../lib/csv";

/**
 * Downloadable sample files for each dataset, built from live data so they import cleanly — plus a few
 * deliberately bad rows that show how rejections work. Server-only.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function sampleCsv(slug: string): Promise<string | null> {
  const db = await getDb();
  const f = new Faker({ locale: [en_IN, en, base] });
  f.seed(Math.floor(Date.now() / 86_400_000)); // new names each day, stable within a day
  const person = () => {
    const first = f.person.firstName();
    const last = f.person.lastName();
    const company = `${f.helpers.arrayElement(["Surya", "Kaveri", "Deccan", "Apex", "Vertex", "Sahyadri", "Unnati"])} ${f.helpers.arrayElement(["Engineering Works", "Industries", "Auto Components", "Foods", "Logistics"])} Pvt Ltd`;
    const domain = company.toLowerCase().replace(/ pvt ltd$/, "").replace(/[^a-z0-9]+/g, "-");
    return { name: `${first} ${last}`, company, email: `${first}.${last}@${domain}.example`.toLowerCase().replace(/[^a-z0-9.@-]/g, ""), phone: `9${f.string.numeric(9)}`, city: f.helpers.arrayElement(CITIES).city };
  };

  switch (slug) {
    case "marketplace-leads":
    case "website-enquiries": {
      const rows = Array.from({ length: 18 }, person);
      const [existing] = await db.select({ email: leads.email }).from(leads).orderBy(desc(leads.id)).limit(1);
      const bad = [
        { ...person(), email: "not-an-email" },
        { ...person(), city: "Springfield" },
        { ...person(), company: "" },
        ...(existing ? [{ ...person(), email: existing.email }] : []),
      ];
      const all = [...rows.slice(0, 6), bad[0], ...rows.slice(6, 12), bad[1], bad[2], ...rows.slice(12), ...bad.slice(3)];
      const header = slug === "marketplace-leads" ? ["Buyer Name", "Company", "Email", "Mobile", "City"] : ["name", "company", "email", "phone", "city"];
      return toCsv(header, all.map((r) => [r.name, r.company, r.email, r.phone, r.city]));
    }
    case "distributor-price-list": {
      const ps = await db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.sku)).limit(18);
      const rows = ps.map((p) => [p.sku, p.name, String(Math.round(p.price * 1.05)), String(p.gstRate), p.hsnCode]);
      rows.splice(5, 0, ["XXX-0001", "Unknown item", "450", "18", "7318"]);
      rows.splice(11, 0, [ps[0].sku, ps[0].name, "-120", "18", ps[0].hsnCode]);
      rows.push([ps[1].sku, ps[1].name, String(ps[1].price), "15", ps[1].hsnCode]);
      return toCsv(["SKU", "Description", "Rate", "GST %", "HSN"], rows);
    }
    case "accounting-ledger-sync": {
      const open = await db
        .select()
        .from(invoices)
        .where(inArray(invoices.status, ["sent", "partially_paid"]))
        .orderBy(asc(invoices.dueDate))
        .limit(12);
      const today = new Date().toISOString().slice(0, 10);
      const rows = open.map((i, k) => {
        const balance = r2(i.total - i.amountPaid);
        return [i.number, String(k % 3 === 0 ? balance : r2(balance / 2)), today];
      });
      if (open[0]) rows.push([open[0].number, "99999999", today]);
      rows.push(["INV-999999", "15000", today]);
      if (open[1]) rows.push([open[1].number, "5000", today.split("-").reverse().join("/")]);
      return toCsv(["voucher_ref", "amount", "date"], rows);
    }
    case "stock-count": {
      const inv = await db
        .select({ sku: products.sku, code: warehouses.code, qty: inventory.qtyOnHand })
        .from(inventory)
        .innerJoin(products, eq(products.id, inventory.productId))
        .innerJoin(warehouses, eq(warehouses.id, inventory.warehouseId))
        .where(and(eq(products.active, true), sql`${inventory.qtyOnHand} > 0`))
        .orderBy(asc(warehouses.id), asc(products.sku))
        .limit(24);
      const rows = inv.map((r, k) => [r.sku, r.code, String(Math.max(0, r.qty + (k % 4 === 0 ? -Math.ceil(r.qty * 0.6) : k % 5 === 0 ? 3 : 0)))]);
      rows.splice(7, 0, [inv[0]?.sku ?? "FAS-0001", "PNQ-02", "40"]);
      rows.splice(15, 0, [inv[2]?.sku ?? "FAS-0002", inv[2]?.code ?? "CHN-01", "-4"]);
      return toCsv(["SKU", "Warehouse", "Counted Qty"], rows);
    }
  }
  return null;
}
