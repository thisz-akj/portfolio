import { bigserial, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Ops Suite schema. Phase 0 holds only the shared core (demo users + audit log);
 * CRM, ERP and data-portal tables are added in phase 1.
 * After changing this file: `npm run db:generate` (writes SQL to /drizzle), then `npm run db:migrate`.
 */

export const roleEnum = pgEnum("role", ["admin", "sales", "warehouse"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: roleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every write in the suite appends a row here; the portal shows it as the activity feed. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(), // e.g. "create" | "update" | "delete" | "deal.won"
    entity: text("entity").notNull(), // table name, e.g. "deals"
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId), index("audit_log_at_idx").on(t.at)],
);

export type User = typeof users.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
