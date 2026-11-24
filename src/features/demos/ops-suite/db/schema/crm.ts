import { boolean, date, index, integer, pgEnum, pgTable, serial, smallint, text, timestamp } from "drizzle-orm/pg-core";
import { createdAt, money, updatedAt } from "./columns";
import { users } from "./core";

/** CRM: companies (accounts), contacts, leads, deals, activities. */

export const industryEnum = pgEnum("industry", [
  "manufacturing",
  "construction",
  "automotive",
  "pharma",
  "food_processing",
  "textiles",
  "logistics",
  "retail",
  "hospitality",
  "healthcare",
  "education",
  "energy",
]);
export const companySizeEnum = pgEnum("company_size", ["micro", "small", "medium", "large", "enterprise"]);
export const regionEnum = pgEnum("region", ["north", "south", "east", "west", "central", "north_east"]);
export const lifecycleEnum = pgEnum("lifecycle", ["prospect", "customer", "churned"]);
export const leadSourceEnum = pgEnum("lead_source", [
  "website",
  "referral",
  "indiamart",
  "trade_show",
  "cold_call",
  "linkedin",
  "partner",
]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "qualified", "unqualified", "converted"]);
export const dealStageEnum = pgEnum("deal_stage", ["new", "qualified", "proposal", "negotiation", "won", "lost"]);
export const activityTypeEnum = pgEnum("activity_type", ["call", "email", "meeting", "note", "task"]);

export const companies = pgTable(
  "companies",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    industry: industryEnum("industry").notNull(),
    size: companySizeEnum("size").notNull(),
    lifecycle: lifecycleEnum("lifecycle").notNull().default("prospect"),
    gstin: text("gstin").unique(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    region: regionEnum("region").notNull(),
    website: text("website"),
    phone: text("phone"),
    annualRevenue: money("annual_revenue"), // ₹, self-reported estimate
    paymentTermsDays: smallint("payment_terms_days").notNull().default(30),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("companies_owner_idx").on(t.ownerId),
    index("companies_lifecycle_idx").on(t.lifecycle),
    index("companies_region_idx").on(t.region),
    index("companies_created_idx").on(t.createdAt),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    title: text("title"),
    isPrimary: boolean("is_primary").notNull().default(false),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("contacts_company_idx").on(t.companyId), index("contacts_email_idx").on(t.email)],
);

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(), // person
    companyName: text("company_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    source: leadSourceEnum("source").notNull(),
    status: leadStatusEnum("status").notNull().default("new"),
    score: smallint("score").notNull().default(0), // 0–100
    city: text("city").notNull(),
    state: text("state").notNull(),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    convertedCompanyId: integer("converted_company_id").references(() => companies.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("leads_status_idx").on(t.status),
    index("leads_owner_idx").on(t.ownerId),
    index("leads_created_idx").on(t.createdAt),
  ],
);

export const deals = pgTable(
  "deals",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    stage: dealStageEnum("stage").notNull().default("new"),
    value: money("value").notNull(),
    probability: smallint("probability").notNull(), // %
    source: leadSourceEnum("source"),
    expectedClose: date("expected_close", { mode: "string" }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    lostReason: text("lost_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("deals_stage_idx").on(t.stage),
    index("deals_owner_idx").on(t.ownerId),
    index("deals_company_idx").on(t.companyId),
    index("deals_expected_close_idx").on(t.expectedClose),
  ],
);

export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    type: activityTypeEnum("type").notNull(),
    subject: text("subject").notNull(),
    body: text("body"),
    companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    dealId: integer("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("activities_deal_idx").on(t.dealId),
    index("activities_company_idx").on(t.companyId),
    index("activities_created_idx").on(t.createdAt),
  ],
);
