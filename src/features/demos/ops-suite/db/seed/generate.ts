import { Faker, base, en, en_IN } from "@faker-js/faker";
import type {
  activities,
  auditLog,
  companies,
  contacts,
  datasets,
  deals,
  entityTags,
  importJobs,
  importRejectedRows,
  inventory,
  invoices,
  leads,
  payments,
  products,
  purchaseOrderLines,
  purchaseOrders,
  salesOrderLines,
  salesOrders,
  suppliers,
  tags,
  users,
  warehouses,
} from "../schema";
import type { DatasetSchema } from "../schema/portal";
import { formatINR } from "../../lib/format";
import {
  ACTIVITY_SUBJECTS,
  CATALOGUE,
  CITIES,
  COMPANY_SUFFIXES,
  CONTACT_TITLES,
  DEAL_TITLES,
  IMPORT_ERRORS,
  INDUSTRIES,
  LOST_REASONS,
  NAME_PREFIXES,
  SIZES,
  SUPPLIER_WORDS,
  TAGS,
  USERS,
  WAREHOUSES,
  type Category,
  type City,
  type Industry,
  type Size,
} from "./reference";

/**
 * Pure, deterministic generator for the Ops Suite demo data: the same `seed` and `now` always give the same rows.
 * Produces one year of connected history: leads → deals → sales orders → invoices → payments, purchase orders,
 * stock levels derived from recent demand, data-portal import runs, and a 30-day audit trail.
 * Ids are assigned here so rows can reference each other before insertion.
 */

type Row<T extends { $inferInsert: unknown }> = T["$inferInsert"] & { id: number };

export interface SeedData {
  users: Row<typeof users>[];
  tags: Row<typeof tags>[];
  entityTags: (typeof entityTags.$inferInsert)[];
  companies: Row<typeof companies>[];
  contacts: Row<typeof contacts>[];
  leads: Row<typeof leads>[];
  deals: Row<typeof deals>[];
  activities: Row<typeof activities>[];
  products: Row<typeof products>[];
  warehouses: Row<typeof warehouses>[];
  inventory: (typeof inventory.$inferInsert)[];
  suppliers: Row<typeof suppliers>[];
  purchaseOrders: Row<typeof purchaseOrders>[];
  purchaseOrderLines: Row<typeof purchaseOrderLines>[];
  salesOrders: Row<typeof salesOrders>[];
  salesOrderLines: Row<typeof salesOrderLines>[];
  invoices: Row<typeof invoices>[];
  payments: Row<typeof payments>[];
  datasets: Row<typeof datasets>[];
  importJobs: Row<typeof importJobs>[];
  importRejectedRows: Row<typeof importRejectedRows>[];
  auditLog: Row<typeof auditLog>[];
}

export interface GenerateOptions {
  now?: Date;
  seed?: number;
  companies?: number;
}

const DAY = 86_400_000;

const AFFINITY: Record<Industry, Category[]> = {
  manufacturing: ["fasteners", "bearings", "tools", "lubricants"],
  construction: ["pipes_fittings", "safety", "tools", "fasteners"],
  automotive: ["fasteners", "bearings", "hydraulics", "lubricants"],
  pharma: ["packaging", "safety", "pipes_fittings"],
  food_processing: ["packaging", "bearings", "lubricants"],
  textiles: ["bearings", "lubricants", "electrical"],
  logistics: ["packaging", "safety", "tools"],
  retail: ["packaging", "electrical"],
  hospitality: ["electrical", "pipes_fittings", "adhesives"],
  healthcare: ["electrical", "safety", "adhesives"],
  education: ["electrical", "tools"],
  energy: ["electrical", "safety", "hydraulics"],
};

const STAGE_PROBABILITY = { new: 10, qualified: 25, proposal: 50, negotiation: 75, won: 100, lost: 0 } as const;

export const r2 = (n: number) => Math.round(n * 100) / 100;
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / DAY);
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function generate(opts: GenerateOptions = {}): SeedData {
  const now = opts.now ?? new Date();
  const f = new Faker({ locale: [en_IN, en, base] });
  f.seed(opts.seed ?? 42);

  // ── helpers bound to this faker + clock ────────────────────────────────────
  const int = (min: number, max: number) => f.number.int({ min, max });
  const float = (min: number, max: number) => f.number.float({ min, max });
  const chance = (p: number) => f.number.float() < p;
  const pick = <T>(arr: readonly T[]) => f.helpers.arrayElement(arr as T[]);
  const weighted = <T>(items: { value: T; weight: number }[]) => f.helpers.weightedArrayElement(items);
  const logUniform = (min: number, max: number) => Math.exp(float(Math.log(min), Math.log(max)));
  const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  /** A business-hours timestamp (09:30–19:00 IST) `daysAgo` days before today, never in the future. */
  const at = (daysAgo: number) => {
    const minutes = int(4 * 60, 13 * 60 + 30);
    const t = startOfToday - daysAgo * DAY + minutes * 60_000;
    return new Date(Math.min(t, now.getTime() - (minutes % 97) * 60_000));
  };
  /** Same day as `d`, business hours, capped at now. */
  const sameDay = (d: Date) => at(daysBetween(d, new Date(startOfToday)));
  const notFuture = (d: Date) => (d.getTime() > now.getTime() ? new Date(now.getTime() - int(5, 240) * 60_000) : d);
  /** Days ago in [min, max], skewed towards recent (a growing business). */
  const recentDaysAgo = (min: number, max: number, skew = 1.35) => min + Math.floor((max - min) * Math.pow(f.number.float(), skew));
  const phone = () => `+91 ${pick(["98", "97", "99", "90", "88", "70", "81", "94"])}${f.string.numeric(3)} ${f.string.numeric(5)}`;
  const cityWeights = CITIES.map((c) => ({ value: c, weight: c.weight }));
  const usedGstins = new Set<string>();
  const gstin = (c: City) => {
    for (;;) {
      const pan = `${f.string.alpha({ length: 3, casing: "upper" })}C${f.string.alpha({ length: 1, casing: "upper" })}${f.string.numeric(4)}${f.string.alpha({ length: 1, casing: "upper" })}`;
      const g = `${c.gstCode}${pan}1Z${f.string.alphanumeric({ length: 1, casing: "upper" })}`;
      if (!usedGstins.has(g)) return usedGstins.add(g), g;
    }
  };
  const usedNames = new Set<string>();
  const businessName = (words: string[]) => {
    for (;;) {
      const n = `${pick(NAME_PREFIXES)} ${pick(words)} ${weighted(COMPANY_SUFFIXES)}`.trim();
      if (!usedNames.has(n)) return usedNames.add(n), n;
    }
  };
  const domainOf = (name: string) => `${slugify(name.replace(/\b(Pvt Ltd|Ltd|LLP|& Co\.)$/, ""))}.example`;
  const personEmail = (first: string, last: string, domain: string) =>
    `${slugify(first)}.${slugify(last)}@${domain}`.replace(/-/g, "");
  const fy = (d: Date) => {
    const m = d.getUTCMonth();
    const y = d.getUTCFullYear() + (m >= 3 ? 1 : 0);
    return { q: m >= 3 ? Math.floor((m - 3) / 3) + 1 : 4, fy: `FY${String(y).slice(2)}` };
  };

  // ── users, warehouses, tags ────────────────────────────────────────────────
  const userRows: SeedData["users"] = USERS.map((u, i) => ({ id: i + 1, ...u, createdAt: addDays(now, -420) }));
  const nameOf = (id: number | null | undefined) => userRows.find((u) => u.id === id)?.name ?? "System";
  const reps = userRows.filter((u) => u.role === "sales");
  const repWeights = reps.map((u, i) => ({ value: u.id, weight: [24, 20, 18, 15, 13, 10][i] ?? 10 }));
  const whUsers = userRows.filter((u) => u.role === "warehouse").map((u) => u.id);
  const adminId = userRows.find((u) => u.role === "admin")!.id;

  const whRows: SeedData["warehouses"] = WAREHOUSES.map((w, i) => ({ id: i + 1, code: w.code, name: w.name, city: w.city, state: w.state }));
  const whForRegion = (region: string) => WAREHOUSES.findIndex((w) => (w.serves as string[]).includes(region)) + 1;
  const whCode = (id: number) => whRows[id - 1].code;

  const tagRows: SeedData["tags"] = TAGS.map((t, i) => ({ id: i + 1, ...t }));
  const tagId = (name: string) => tagRows.find((t) => t.name === name)!.id;
  const tagKeys = new Set<string>();
  const entityTagRows: SeedData["entityTags"] = [];
  const tag = (name: string, entity: string, entityId: number) => {
    const key = `${name}:${entity}:${entityId}`;
    if (tagKeys.has(key)) return;
    tagKeys.add(key);
    entityTagRows.push({ tagId: tagId(name), entity, entityId });
  };

  // ── products ───────────────────────────────────────────────────────────────
  const productRows: SeedData["products"] = [];
  const popularity: number[] = [];
  for (const [category, cat] of Object.entries(CATALOGUE) as [Category, (typeof CATALOGUE)[Category]][]) {
    let n = 1;
    for (const item of cat.items) {
      const variants = item.variants ?? [null];
      variants.forEach((variant, vi) => {
        const t = variants.length > 1 ? vi / (variants.length - 1) : float(0, 1);
        const raw = (item.price[0] + (item.price[1] - item.price[0]) * t) * float(0.92, 1.08);
        const price = raw >= 100 ? roundTo(raw, 5) : Math.max(1, Math.round(raw));
        productRows.push({
          id: productRows.length + 1,
          sku: `${cat.sku}-${String(n++).padStart(4, "0")}`,
          name: variant ? `${item.name} ${variant}` : item.name,
          category,
          unit: item.unit,
          price,
          cost: r2(price * float(0.62, 0.8)),
          gstRate: item.gst ?? cat.gst,
          hsnCode: item.hsn ?? cat.hsn,
          active: chance(0.97),
          createdAt: addDays(now, -int(400, 900)),
        });
        popularity.push(logUniform(0.3, 4));
      });
    }
  }
  const activeProducts = productRows.filter((p) => p.active);
  const pickProducts = (cats: Category[], k: number, boost: Category[] = []) => {
    const pool = activeProducts.filter((p) => cats.length === 0 || cats.includes(p.category));
    const chosen: typeof productRows = [];
    const remaining = [...pool];
    while (chosen.length < Math.min(k, pool.length)) {
      const p = weighted(remaining.map((x) => ({ value: x, weight: popularity[x.id - 1] * (boost.includes(x.category) ? 3 : 1) })));
      chosen.push(p);
      remaining.splice(remaining.indexOf(p), 1);
    }
    return chosen;
  };

  // ── companies & contacts ───────────────────────────────────────────────────
  type Kind = "customer" | "prospect" | "churned";
  type PayBehaviour = "good" | "slow" | "bad";
  const companyRows: SeedData["companies"] = [];
  const meta: { kind: Kind; pay: PayBehaviour; industry: Industry; size: Size; domain: string }[] = [];
  const nCompanies = opts.companies ?? 220;
  for (let i = 0; i < nCompanies; i++) {
    const industry = weighted(Object.entries(INDUSTRIES).map(([k, v]) => ({ value: k as Industry, weight: v.weight })));
    const size = weighted(Object.entries(SIZES).map(([k, v]) => ({ value: k as Size, weight: v.weight })));
    const city = weighted(cityWeights);
    const kind = weighted<Kind>([
      { value: "customer", weight: 55 },
      { value: "prospect", weight: 35 },
      { value: "churned", weight: 10 },
    ]);
    const pay = weighted<PayBehaviour>([
      { value: "good", weight: kind === "churned" ? 40 : 70 },
      { value: "slow", weight: 20 },
      { value: "bad", weight: kind === "churned" ? 40 : 10 },
    ]);
    const name = businessName(INDUSTRIES[industry].words);
    const domain = domainOf(name);
    const ageDays = kind === "churned" ? int(420, 1100) : kind === "customer" ? int(20, 1100) : recentDaysAgo(0, 500);
    const createdAt = at(ageDays);
    companyRows.push({
      id: i + 1,
      name,
      industry,
      size,
      lifecycle: kind,
      gstin: size === "micro" && chance(0.3) ? null : gstin(city),
      city: city.city,
      state: city.state,
      region: city.region,
      website: chance(0.8) ? `https://www.${domain}` : null,
      phone: phone(),
      annualRevenue: roundTo(logUniform(...SIZES[size].revenue), 1e5),
      paymentTermsDays: weighted([
        { value: 15, weight: 10 },
        { value: 30, weight: 45 },
        { value: 45, weight: 30 },
        { value: 60, weight: 15 },
      ]),
      ownerId: weighted(repWeights),
      createdAt,
      updatedAt: notFuture(addDays(createdAt, int(0, 200))),
    });
    meta.push({ kind, pay, industry, size, domain });
  }

  const contactRows: SeedData["contacts"] = [];
  const contactsOf = new Map<number, number[]>();
  for (const c of companyRows) {
    const m = meta[c.id - 1];
    const n = int(...SIZES[m.size].contacts);
    const emails = new Set<string>();
    for (let j = 0; j < n; j++) {
      const firstName = f.person.firstName();
      const lastName = f.person.lastName();
      let email = personEmail(firstName, lastName, m.domain);
      if (emails.has(email)) email = email.replace("@", `${j}@`);
      emails.add(email);
      const id = contactRows.length + 1;
      const createdAt = notFuture(addDays(c.createdAt!, int(0, 60)));
      contactRows.push({
        id,
        companyId: c.id,
        firstName,
        lastName,
        email,
        phone: chance(0.9) ? phone() : null,
        title: pick(CONTACT_TITLES),
        isPrimary: j === 0,
        ownerId: c.ownerId,
        createdAt,
        updatedAt: createdAt,
      });
      contactsOf.set(c.id, [...(contactsOf.get(c.id) ?? []), id]);
    }
  }

  // ── leads ──────────────────────────────────────────────────────────────────
  const leadRows: SeedData["leads"] = [];
  for (let i = 0; i < 360; i++) {
    const daysAgo = recentDaysAgo(0, 365);
    const createdAt = at(daysAgo);
    let status = weighted(
      daysAgo < 7
        ? [
            { value: "new" as const, weight: 60 },
            { value: "contacted" as const, weight: 40 },
          ]
        : daysAgo < 30
          ? [
              { value: "new" as const, weight: 15 },
              { value: "contacted" as const, weight: 40 },
              { value: "qualified" as const, weight: 25 },
              { value: "unqualified" as const, weight: 15 },
              { value: "converted" as const, weight: 5 },
            ]
          : [
              { value: "contacted" as const, weight: 15 },
              { value: "qualified" as const, weight: 15 },
              { value: "unqualified" as const, weight: 45 },
              { value: "converted" as const, weight: 25 },
            ],
    );
    let converted: (typeof companyRows)[number] | undefined;
    if (status === "converted") {
      const candidates = companyRows.filter((c) => {
        const d = daysBetween(createdAt, c.createdAt!);
        return d >= 0 && d <= 60;
      });
      if (candidates.length) converted = pick(candidates);
      else status = "qualified";
    }
    const city = converted ? CITIES.find((x) => x.city === converted!.city)! : weighted(cityWeights);
    const firstName = f.person.firstName();
    const lastName = f.person.lastName();
    const companyName = converted?.name ?? businessName(INDUSTRIES[weighted(Object.entries(INDUSTRIES).map(([k, v]) => ({ value: k as Industry, weight: v.weight })))].words);
    const score = { new: [20, 60], contacted: [30, 70], qualified: [60, 95], unqualified: [5, 35], converted: [70, 100] }[status] as [number, number];
    leadRows.push({
      id: i + 1,
      name: `${firstName} ${lastName}`,
      companyName,
      email: personEmail(firstName, lastName, domainOf(companyName)),
      phone: chance(0.85) ? phone() : null,
      source: weighted([
        { value: "indiamart" as const, weight: 30 },
        { value: "website" as const, weight: 22 },
        { value: "referral" as const, weight: 14 },
        { value: "trade_show" as const, weight: 10 },
        { value: "linkedin" as const, weight: 10 },
        { value: "cold_call" as const, weight: 8 },
        { value: "partner" as const, weight: 6 },
      ]),
      status,
      score: int(...score),
      city: city.city,
      state: city.state,
      ownerId: status === "new" && chance(0.35) ? null : (converted?.ownerId ?? weighted(repWeights)),
      convertedCompanyId: converted?.id ?? null,
      createdAt,
      updatedAt: notFuture(addDays(createdAt, int(0, Math.min(daysAgo, 40)))),
    });
  }

  // ── deals & activities ─────────────────────────────────────────────────────
  const dealRows: SeedData["deals"] = [];
  const activityRows: SeedData["activities"] = [];
  const addActivity = (a: Omit<Row<typeof activities>, "id">) => activityRows.push({ id: activityRows.length + 1, ...a });
  const windowStart = 365;
  for (const c of companyRows) {
    const m = meta[c.id - 1];
    const age = daysBetween(c.createdAt!, now);
    const n =
      m.kind === "customer"
        ? int(2, 6)
        : m.kind === "churned"
          ? int(1, 3)
          : weighted([
              { value: 0, weight: 30 },
              { value: 1, weight: 45 },
              { value: 2, weight: 25 },
            ]);
    const minAgo = m.kind === "churned" ? 150 : 0;
    const maxAgo = Math.min(windowStart, age);
    if (maxAgo <= minAgo) continue;
    for (let j = 0; j < n; j++) {
      const daysAgo = recentDaysAgo(minAgo, maxAgo, 1.15);
      const createdAt = at(daysAgo);
      const cycle = int(14, 100);
      let stage: keyof typeof STAGE_PROBABILITY;
      let closedAt: Date | null = null;
      let expectedClose = isoDate(addDays(createdAt, cycle));
      if (daysAgo >= cycle) {
        closedAt = sameDay(addDays(createdAt, cycle));
        expectedClose = isoDate(closedAt);
        const winP = m.kind === "customer" ? 0.65 : m.kind === "churned" ? 0.45 : 0;
        stage = chance(winP) ? "won" : "lost";
      } else {
        const progress = daysAgo / cycle;
        stage = progress < 0.25 ? "new" : progress < 0.5 ? "qualified" : progress < 0.8 ? "proposal" : "negotiation";
        if (chance(0.12)) expectedClose = isoDate(addDays(now, -int(1, 20))); // slipped past its close date
      }
      const category = pick(AFFINITY[m.industry]);
      const { q, fy: fyLabel } = fy(createdAt);
      const id = dealRows.length + 1;
      const ownerId = chance(0.9) ? c.ownerId : weighted(repWeights);
      const contactId = pick(contactsOf.get(c.id)!);
      dealRows.push({
        id,
        title: pick(DEAL_TITLES).replace("{cat}", CATALOGUE[category].label.toLowerCase()).replace("{q}", `Q${q} ${fyLabel}`).replace(/^./, (s) => s.toUpperCase()),
        companyId: c.id,
        contactId,
        ownerId,
        stage,
        value: roundTo(logUniform(...SIZES[m.size].deal), 1000),
        probability: STAGE_PROBABILITY[stage],
        source: pick(["indiamart", "website", "referral", "trade_show", "linkedin", "cold_call", "partner"] as const),
        expectedClose,
        closedAt,
        lostReason: stage === "lost" ? pick(LOST_REASONS) : null,
        createdAt,
        updatedAt: closedAt ?? notFuture(addDays(createdAt, int(0, daysAgo))),
      });
      // activities along the deal's life
      const end = closedAt ?? now;
      const span = Math.max(1, daysBetween(createdAt, end));
      for (let k = 0, nAct = int(1, 5); k < nAct; k++) {
        const type = weighted([
          { value: "call" as const, weight: 30 },
          { value: "email" as const, weight: 30 },
          { value: "meeting" as const, weight: 15 },
          { value: "note" as const, weight: 15 },
          { value: "task" as const, weight: 10 },
        ]);
        const when = notFuture(sameDay(addDays(createdAt, int(0, span))));
        const openTask = type === "task" && !closedAt && chance(0.5);
        addActivity({
          type,
          subject: pick(ACTIVITY_SUBJECTS[type]),
          body: null,
          companyId: c.id,
          contactId,
          dealId: id,
          ownerId,
          dueAt: type === "task" ? (openTask ? addDays(at(0), int(1, 14)) : when) : null,
          completedAt: openTask ? null : type === "task" ? notFuture(addDays(when, int(0, 2))) : when,
          createdAt: when,
        });
      }
    }
    for (let k = 0, nNotes = int(0, 2); k < nNotes; k++) {
      const when = at(int(0, Math.min(windowStart, age)));
      addActivity({
        type: "note",
        subject: pick(ACTIVITY_SUBJECTS.note),
        body: null,
        companyId: c.id,
        contactId: null,
        dealId: null,
        ownerId: c.ownerId,
        dueAt: null,
        completedAt: when,
        createdAt: when,
      });
    }
  }

  // ── sales orders ───────────────────────────────────────────────────────────
  interface PlannedOrder {
    companyId: number;
    dealId: number | null;
    ownerId: number | null | undefined;
    at: Date;
    target: number; // ex-GST
    lines: number;
  }
  const planned: PlannedOrder[] = [];
  for (const d of dealRows) {
    if (d.stage !== "won") continue;
    planned.push({ companyId: d.companyId, dealId: d.id, ownerId: d.ownerId, at: notFuture(sameDay(addDays(d.closedAt!, int(0, 3)))), target: d.value / 1.18, lines: int(3, 8) });
  }
  for (const c of companyRows) {
    const m = meta[c.id - 1];
    if (m.kind === "prospect") continue;
    const from = Math.min(windowStart, daysBetween(c.createdAt!, now));
    const to = m.kind === "churned" ? 150 + int(0, 60) : 0;
    if (from <= to) continue;
    const n = Math.round((int(...SIZES[m.size].ordersPerYear) * (from - to)) / 365);
    for (let k = 0; k < n; k++) {
      planned.push({ companyId: c.id, dealId: null, ownerId: c.ownerId, at: at(int(to, from)), target: logUniform(...SIZES[m.size].order), lines: int(1, 5) });
    }
  }
  planned.sort((a, b) => a.at.getTime() - b.at.getTime());

  const soRows: SeedData["salesOrders"] = [];
  const solRows: SeedData["salesOrderLines"] = [];
  for (const p of planned) {
    const id = soRows.length + 1;
    const c = companyRows[p.companyId - 1];
    const m = meta[c.id - 1];
    const items = pickProducts([], p.lines, AFFINITY[m.industry]);
    const shares = items.map(() => float(0.5, 1.5));
    const shareSum = shares.reduce((a, b) => a + b, 0);
    let subtotal = 0;
    let tax = 0;
    items.forEach((prod, i) => {
      const discountPct = weighted([
        { value: 0, weight: 50 },
        { value: 2, weight: 15 },
        { value: 5, weight: 18 },
        { value: 8, weight: 10 },
        { value: 10, weight: 7 },
      ]);
      const qty = Math.max(1, Math.round((p.target * (shares[i] / shareSum)) / (prod.price * (1 - discountPct / 100))));
      const lineTotal = r2(qty * prod.price * (1 - discountPct / 100));
      subtotal += lineTotal;
      tax += r2((lineTotal * prod.gstRate) / 100);
      solRows.push({ id: solRows.length + 1, salesOrderId: id, productId: prod.id, qty, unitPrice: prod.price, discountPct, gstRate: prod.gstRate, lineTotal });
    });
    const age = daysBetween(p.at, now);
    const status =
      age > 10
        ? chance(0.03)
          ? "cancelled"
          : "fulfilled"
        : age > 3
          ? weighted([
              { value: "fulfilled" as const, weight: 45 },
              { value: "confirmed" as const, weight: 50 },
              { value: "cancelled" as const, weight: 5 },
            ])
          : chance(0.4)
            ? "draft"
            : "confirmed";
    const fulfilledAt = status === "fulfilled" ? notFuture(sameDay(addDays(p.at, int(1, Math.max(1, Math.min(7, age)))))) : null;
    soRows.push({
      id,
      number: `SO-${String(id).padStart(6, "0")}`,
      companyId: c.id,
      dealId: p.dealId,
      warehouseId: whForRegion(c.region),
      ownerId: p.ownerId ?? null,
      status,
      orderDate: isoDate(p.at),
      fulfilledAt,
      subtotal: r2(subtotal),
      tax: r2(tax),
      total: r2(subtotal + tax),
      createdAt: p.at,
      updatedAt: fulfilledAt ?? p.at,
    });
  }

  // ── invoices & payments ────────────────────────────────────────────────────
  const invRows: SeedData["invoices"] = [];
  const payRows: SeedData["payments"] = [];
  const method = () =>
    weighted([
      { value: "neft" as const, weight: 45 },
      { value: "rtgs" as const, weight: 20 },
      { value: "cheque" as const, weight: 18 },
      { value: "upi" as const, weight: 15 },
      { value: "card" as const, weight: 2 },
    ]);
  const reference = (m: string) =>
    m === "cheque" ? `CHQ ${f.string.numeric(6)}` : m === "upi" ? `UPI/${f.string.numeric(12)}` : m === "card" ? `CARD ****${f.string.numeric(4)}` : `UTR${f.string.alphanumeric({ length: 4, casing: "upper" })}${f.string.numeric(12)}`;
  const fulfilled = soRows.filter((s) => s.status === "fulfilled").sort((a, b) => a.fulfilledAt!.getTime() - b.fulfilledAt!.getTime());
  for (const so of fulfilled) {
    const id = invRows.length + 1;
    const c = companyRows[so.companyId - 1];
    const m = meta[c.id - 1];
    const issue = so.fulfilledAt!;
    const due = addDays(issue, c.paymentTermsDays ?? 30);
    const total = so.total;
    const pays: { amount: number; at: Date }[] = [];
    let status: "draft" | "sent" | "partially_paid" | "paid" | "void" = "sent";
    if (daysBetween(issue, now) < 1 && chance(0.5)) status = "draft";
    else if (chance(0.01)) status = "void";
    else {
      const neverPays = m.pay === "bad" && chance(0.5);
      const delay = m.pay === "good" ? int(-10, 5) : m.pay === "slow" ? int(5, 60) : int(30, 120);
      const paidOn = new Date(Math.max(addDays(due, delay).getTime(), addDays(issue, 2).getTime()));
      if (!neverPays && paidOn.getTime() <= now.getTime()) {
        if (chance(0.15)) {
          const first = r2(total * float(0.5, 0.7));
          const firstAt = new Date(Math.max(addDays(paidOn, -int(10, 20)).getTime(), addDays(issue, 1).getTime()));
          pays.push({ amount: first, at: sameDay(firstAt) }, { amount: r2(total - first), at: sameDay(paidOn) });
        } else pays.push({ amount: total, at: sameDay(paidOn) });
        status = "paid";
      } else if (daysBetween(issue, now) > 15 && chance(neverPays ? 0.3 : 0.25)) {
        const partAt = sameDay(addDays(issue, int(5, Math.max(5, daysBetween(issue, now)))));
        pays.push({ amount: r2(total * float(0.3, 0.6)), at: notFuture(partAt) });
        status = "partially_paid";
      }
    }
    const amountPaid = r2(pays.reduce((a, p) => a + p.amount, 0));
    for (const p of pays) {
      const mth = method();
      payRows.push({ id: payRows.length + 1, invoiceId: id, amount: p.amount, method: mth, reference: reference(mth), paidAt: p.at, createdAt: p.at });
    }
    invRows.push({
      id,
      number: `INV-${String(id).padStart(6, "0")}`,
      salesOrderId: so.id,
      companyId: c.id,
      status,
      issueDate: isoDate(issue),
      dueDate: isoDate(due),
      subtotal: so.subtotal,
      tax: so.tax,
      total,
      amountPaid,
      createdAt: issue,
      updatedAt: pays.at(-1)?.at ?? issue,
    });
  }

  // ── suppliers & purchase orders ────────────────────────────────────────────
  const supplierRows: SeedData["suppliers"] = [];
  const supplierCats: Category[][] = [];
  const allCats = Object.keys(CATALOGUE) as Category[];
  for (let i = 0; i < 36; i++) {
    const city = weighted(cityWeights);
    const name = businessName(SUPPLIER_WORDS);
    supplierRows.push({
      id: i + 1,
      name,
      gstin: gstin(city),
      city: city.city,
      state: city.state,
      email: `accounts@${domainOf(name)}`,
      phone: phone(),
      paymentTermsDays: pick([30, 45, 60]),
      rating: weighted([
        { value: 2, weight: 5 },
        { value: 3, weight: 25 },
        { value: 4, weight: 45 },
        { value: 5, weight: 25 },
      ]),
      createdAt: at(int(400, 1500)),
    });
    supplierCats.push(f.helpers.arrayElements(allCats, { min: 1, max: 3 }));
  }

  const poPlans = Array.from({ length: 280 }, () => ({ at: at(recentDaysAgo(0, 365, 1.1)), supplier: int(1, supplierRows.length) })).sort((a, b) => a.at.getTime() - b.at.getTime());
  const poRows: SeedData["purchaseOrders"] = [];
  const polRows: SeedData["purchaseOrderLines"] = [];
  for (const plan of poPlans) {
    const id = poRows.length + 1;
    const age = daysBetween(plan.at, now);
    const status =
      age > 20
        ? weighted([
            { value: "received" as const, weight: 90 },
            { value: "partially_received" as const, weight: 4 },
            { value: "cancelled" as const, weight: 6 },
          ])
        : age >= 7
          ? weighted([
              { value: "sent" as const, weight: 45 },
              { value: "partially_received" as const, weight: 20 },
              { value: "received" as const, weight: 35 },
            ])
          : weighted([
              { value: "draft" as const, weight: 35 },
              { value: "sent" as const, weight: 65 },
            ]);
    let subtotal = 0;
    let tax = 0;
    for (const prod of pickProducts(supplierCats[plan.supplier - 1], int(2, 7))) {
      const unitCost = r2(prod.cost * float(0.95, 1.05));
      const qty = Math.max(5, roundTo(logUniform(2e4, 3e5) / unitCost, unitCost > 2000 ? 1 : 10));
      const qtyReceived = status === "received" ? qty : status === "partially_received" && chance(0.7) ? Math.round(qty * float(0.3, 0.8)) : 0;
      const line = r2(qty * unitCost);
      subtotal += line;
      tax += r2((line * prod.gstRate) / 100);
      polRows.push({ id: polRows.length + 1, purchaseOrderId: id, productId: prod.id, qty, qtyReceived, unitCost, gstRate: prod.gstRate });
    }
    const receivedAt = status === "received" ? notFuture(sameDay(addDays(plan.at, int(5, 15)))) : null;
    poRows.push({
      id,
      number: `PO-${String(id).padStart(6, "0")}`,
      supplierId: plan.supplier,
      warehouseId: weighted([
        { value: 1, weight: 32 },
        { value: 2, weight: 32 },
        { value: 3, weight: 24 },
        { value: 4, weight: 12 },
      ]),
      status,
      orderDate: isoDate(plan.at),
      expectedDate: isoDate(addDays(plan.at, int(7, 14))),
      receivedAt,
      subtotal: r2(subtotal),
      tax: r2(tax),
      total: r2(subtotal + tax),
      createdBy: chance(0.8) ? pick(whUsers) : adminId,
      createdAt: plan.at,
      updatedAt: receivedAt ?? plan.at,
    });
  }

  // ── inventory: reorder levels from the last 90 days of demand, reservations from open orders ──
  const demand = new Map<string, number>();
  const reserved = new Map<string, number>();
  const key = (p: number, w: number) => `${p}:${w}`;
  for (const l of solRows) {
    const so = soRows[l.salesOrderId - 1];
    const k = key(l.productId, so.warehouseId);
    if (so.status === "confirmed") reserved.set(k, (reserved.get(k) ?? 0) + l.qty);
    if (so.status !== "cancelled" && daysBetween(so.createdAt!, now) <= 90) demand.set(k, (demand.get(k) ?? 0) + l.qty);
  }
  const invRowsStock: SeedData["inventory"] = [];
  for (const p of productRows) {
    for (const w of whRows) {
      const k = key(p.id, w.id);
      const daily = (demand.get(k) ?? 0) / 90;
      const reorderLevel = p.active ? Math.max(5, Math.ceil(daily * 21)) : 0;
      const roll = f.number.float();
      const qtyOnHand = !p.active
        ? int(0, 10)
        : roll < 0.03
          ? 0
          : roll < 0.13
            ? int(0, Math.max(0, Math.floor(reorderLevel * 0.9)))
            : Math.ceil(reorderLevel * float(1.2, 4));
      invRowsStock.push({ productId: p.id, warehouseId: w.id, qtyOnHand, qtyReserved: reserved.get(k) ?? 0, reorderLevel, updatedAt: at(int(0, 10)) });
    }
  }

  // ── tags ───────────────────────────────────────────────────────────────────
  for (const c of companyRows) {
    const m = meta[c.id - 1];
    if (m.kind === "customer" && (m.size === "large" || m.size === "enterprise")) tag("key-account", "companies", c.id);
    if (["education", "healthcare", "energy"].includes(m.industry) && chance(0.35)) tag("government", "companies", c.id);
    if ((m.size === "micro" || m.size === "small") && chance(0.4)) tag("msme", "companies", c.id);
    if ((m.kind === "churned" && chance(0.6)) || (m.kind === "customer" && m.pay === "bad")) tag("at-risk", "companies", c.id);
    if (m.kind === "customer" && daysBetween(c.createdAt!, now) <= 120) tag("new-logo", "companies", c.id);
    if (["manufacturing", "textiles", "pharma"].includes(m.industry) && chance(0.15)) tag("export", "companies", c.id);
  }
  const openDeals = dealRows.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const strategicCut = [...openDeals].sort((a, b) => b.value - a.value)[Math.floor(openDeals.length * 0.1)]?.value ?? Infinity;
  for (const d of openDeals) if (d.value >= strategicCut) tag("strategic", "deals", d.id);
  for (const d of dealRows) if (tagKeys.has(`government:companies:${d.companyId}`) && chance(0.5)) tag("gem-portal", "deals", d.id);

  // ── data portal ────────────────────────────────────────────────────────────
  const col = (source: string, target: string, required = true) => ({ source, target, required });
  const datasetDefs: { slug: string; name: string; description: string; source: "csv" | "api" | "webhook"; target: string; schema: DatasetSchema; every: number; count: number; rows: [number, number] }[] = [
    { slug: "marketplace-leads", name: "Marketplace leads export", description: "Weekly CSV of buyer enquiries from B2B marketplaces.", source: "csv", target: "leads", schema: { columns: [col("Buyer Name", "name"), col("Company", "company_name"), col("Email", "email"), col("Mobile", "phone", false), col("City", "city")] }, every: 7, count: 26, rows: [40, 180] },
    { slug: "website-enquiries", name: "Website enquiries", description: "Contact-form submissions pushed by webhook, batched daily.", source: "webhook", target: "leads", schema: { columns: [col("name", "name"), col("company", "company_name"), col("email", "email"), col("phone", "phone", false), col("city", "city", false)] }, every: 1, count: 20, rows: [1, 14] },
    { slug: "distributor-price-list", name: "Distributor price list", description: "Monthly price and GST update from principal manufacturers.", source: "csv", target: "products", schema: { columns: [col("SKU", "sku"), col("Description", "name"), col("Rate", "price"), col("GST %", "gst_rate"), col("HSN", "hsn_code")] }, every: 30, count: 12, rows: [80, 140] },
    { slug: "accounting-ledger-sync", name: "Accounting ledger sync", description: "Daily pull of payment receipts from the accounting system's API.", source: "api", target: "invoices", schema: { columns: [col("voucher_ref", "invoice_number"), col("amount", "amount"), col("date", "paid_on")] }, every: 1, count: 30, rows: [5, 60] },
    { slug: "stock-count", name: "Cycle stock count", description: "Monthly physical stock count uploaded by each warehouse.", source: "csv", target: "inventory", schema: { columns: [col("SKU", "sku"), col("Warehouse", "warehouse_code"), col("Counted Qty", "qty_on_hand")] }, every: 30, count: 12, rows: [300, 540] },
  ];
  const sampleRaw = (target: string, err: string): Record<string, string> => {
    const first = f.person.firstName();
    const last = f.person.lastName();
    const raw: Record<string, string> =
      target === "leads"
        ? { name: `${first} ${last}`, company: businessName(INDUSTRIES.manufacturing.words), email: `${first}.${last}@mail.example`.toLowerCase(), phone: f.string.numeric(10), city: weighted(cityWeights).city }
        : target === "products"
          ? { sku: pick(productRows).sku, name: pick(productRows).name, price: String(int(100, 5000)), gst_rate: "18", hsn: "7318" }
          : target === "invoices"
            ? { invoice_no: `INV-${String(int(1, Math.max(1, invRows.length))).padStart(6, "0")}`, amount: String(int(5000, 400000)), paid_on: isoDate(at(int(0, 30))) }
            : { sku: pick(productRows).sku, warehouse: pick(whRows).code, qty: String(int(0, 900)) };
    const mutate: Record<string, () => void> = {
      "Invalid email address": () => (raw.email = raw.email.split("@")[0]),
      "Missing company name": () => (raw.company = ""),
      "Phone number must have 10 digits": () => (raw.phone = f.string.numeric(9)),
      "Unknown city": () => (raw.city = "Springfield"),
      "Unknown SKU": () => (raw.sku = `XXX-${f.string.numeric(4)}`),
      "Price must be a positive number": () => (raw.price = `-${int(10, 500)}`),
      "GST rate must be 5, 12, 18 or 28": () => (raw.gst_rate = pick(["15", "20", "8"])),
      "Missing HSN code": () => (raw.hsn = ""),
      "Invoice number not found": () => (raw.invoice_no = `INV-9${f.string.numeric(5)}`),
      "Amount exceeds invoice balance": () => (raw.amount = String(int(500000, 900000))),
      "Invalid date format (expected YYYY-MM-DD)": () => (raw.paid_on = raw.paid_on.split("-").reverse().join("/")),
      "Quantity must be a non-negative integer": () => (raw.qty = `-${int(1, 20)}`),
      "Unknown warehouse code": () => (raw.warehouse = "PNQ-02"),
    };
    mutate[err]?.();
    return raw;
  };
  const datasetRows: SeedData["datasets"] = [];
  const jobRows: SeedData["importJobs"] = [];
  const rejectedRows: SeedData["importRejectedRows"] = [];
  for (const def of datasetDefs) {
    const datasetId = datasetRows.length + 1;
    const jobs: Row<typeof importJobs>[] = [];
    for (let k = def.count - 1; k >= 0; k--) {
      const startedAt = at(k * def.every + (def.every > 1 ? int(0, 2) : 0));
      const status = weighted([
        { value: "succeeded" as const, weight: 76 },
        { value: "partial" as const, weight: 18 },
        { value: "failed" as const, weight: 6 },
      ]);
      const rowsTotal = status === "failed" ? 0 : int(...def.rows);
      const rowsFailed = status === "partial" ? int(1, Math.max(1, Math.round(rowsTotal * 0.06))) : 0;
      const job: Row<typeof importJobs> = {
        id: 0,
        datasetId,
        status,
        fileName: def.source === "csv" ? `${def.slug}-${isoDate(startedAt)}.csv` : null,
        rowsTotal,
        rowsOk: rowsTotal - rowsFailed,
        rowsFailed,
        error:
          status === "failed"
            ? def.source === "csv"
              ? pick(["Header row is missing a required column", "File is not valid UTF-8", "File exceeds the 5 MB limit"])
              : pick(["Upstream API timed out after 30 s", "Authentication failed (token expired)"])
            : null,
        startedAt,
        finishedAt: new Date(startedAt.getTime() + int(2, 90) * 1000),
        createdBy: def.target === "inventory" ? pick(whUsers) : adminId,
        createdAt: startedAt,
      };
      jobs.push(job);
    }
    jobs.sort((a, b) => a.startedAt!.getTime() - b.startedAt!.getTime());
    for (const job of jobs) {
      job.id = jobRows.length + 1;
      jobRows.push(job);
      for (let r = 0; r < Math.min(job.rowsFailed ?? 0, 6); r++) {
        const err = pick(IMPORT_ERRORS[def.target]);
        rejectedRows.push({ id: rejectedRows.length + 1, jobId: job.id, rowNumber: int(2, (job.rowsTotal ?? 2) + 1), raw: sampleRaw(def.target, err), errors: [err] });
      }
    }
    datasetRows.push({
      id: datasetId,
      slug: def.slug,
      name: def.name,
      description: def.description,
      source: def.source,
      targetEntity: def.target,
      schema: def.schema,
      ownerId: adminId,
      lastImportAt: jobs.at(-1)?.finishedAt ?? null,
      createdAt: addDays(now, -400),
      updatedAt: jobs.at(-1)?.finishedAt ?? addDays(now, -400),
    });
  }

  // ── audit trail for the last 30 days ───────────────────────────────────────
  const events: Omit<Row<typeof auditLog>, "id">[] = [];
  const recent = (d: Date | null | undefined) => !!d && daysBetween(d, now) <= 30;
  const companyName = (id: number) => companyRows[id - 1].name;
  for (const l of leadRows) if (recent(l.createdAt)) events.push({ actorId: l.ownerId ?? adminId, action: "create", entity: "leads", entityId: String(l.id), summary: `New lead ${l.name} (${l.companyName}) via ${l.source}`, before: null, after: { status: l.status }, at: l.createdAt! });
  for (const d of dealRows) {
    if (recent(d.createdAt)) events.push({ actorId: d.ownerId ?? null, action: "create", entity: "deals", entityId: String(d.id), summary: `${nameOf(d.ownerId)} opened "${d.title}" with ${companyName(d.companyId)} (${formatINR(d.value, { compact: true })})`, before: null, after: { stage: "new" }, at: d.createdAt! });
    if (recent(d.closedAt)) events.push({ actorId: d.ownerId ?? null, action: d.stage === "won" ? "deal.won" : "deal.lost", entity: "deals", entityId: String(d.id), summary: `${nameOf(d.ownerId)} marked "${d.title}" as ${d.stage} (${formatINR(d.value, { compact: true })})`, before: { stage: "negotiation" }, after: { stage: d.stage }, at: d.closedAt! });
  }
  for (const so of soRows) if (recent(so.fulfilledAt)) events.push({ actorId: pick(whUsers), action: "sales_order.fulfilled", entity: "sales_orders", entityId: String(so.id), summary: `${so.number} for ${companyName(so.companyId)} dispatched from ${whCode(so.warehouseId)}`, before: { status: "confirmed" }, after: { status: "fulfilled" }, at: so.fulfilledAt! });
  for (const p of payRows) if (recent(p.paidAt)) events.push({ actorId: adminId, action: "payment.received", entity: "invoices", entityId: String(p.invoiceId), summary: `${formatINR(p.amount)} received against ${invRows[p.invoiceId - 1].number} by ${p.method.toUpperCase()}`, before: null, after: { amount: p.amount }, at: p.paidAt });
  for (const po of poRows) if (recent(po.receivedAt)) events.push({ actorId: po.createdBy ?? null, action: "purchase_order.received", entity: "purchase_orders", entityId: String(po.id), summary: `${po.number} from ${supplierRows[po.supplierId - 1].name} received at ${whCode(po.warehouseId)}`, before: { status: "sent" }, after: { status: "received" }, at: po.receivedAt! });
  for (const j of jobRows) if (recent(j.finishedAt)) events.push({ actorId: j.createdBy ?? null, action: `import.${j.status}`, entity: "import_jobs", entityId: String(j.id), summary: `${datasetRows[j.datasetId - 1].name}: ${j.status === "failed" ? `failed — ${j.error}` : `${j.rowsOk} rows imported${j.rowsFailed ? `, ${j.rowsFailed} rejected` : ""}`}`, before: null, after: { status: j.status }, at: j.finishedAt! });
  events.sort((a, b) => a.at!.getTime() - b.at!.getTime());

  return {
    users: userRows,
    tags: tagRows,
    entityTags: entityTagRows,
    companies: companyRows,
    contacts: contactRows,
    leads: leadRows,
    deals: dealRows,
    activities: activityRows,
    products: productRows,
    warehouses: whRows,
    inventory: invRowsStock,
    suppliers: supplierRows,
    purchaseOrders: poRows,
    purchaseOrderLines: polRows,
    salesOrders: soRows,
    salesOrderLines: solRows,
    invoices: invRows,
    payments: payRows,
    datasets: datasetRows,
    importJobs: jobRows,
    importRejectedRows: rejectedRows,
    auditLog: events.map((e, i) => ({ id: i + 1, ...e })),
  };
}
