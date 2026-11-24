import { bigserial, index, integer, jsonb, pgEnum, pgTable, primaryKey, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createdAt } from "./columns";

/** Shared core: demo users (role switcher personas + sales owners), audit log, tags. */

export const roleEnum = pgEnum("role", ["admin", "sales", "warehouse"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: roleEnum("role").notNull(),
  createdAt: createdAt(),
});

/** Every write in the suite appends a row here; the portal shows it as the activity feed. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(), // "create" | "update" | "delete" | "deal.won" | "invoice.paid" | …
    entity: text("entity").notNull(), // table name, e.g. "deals"
    entityId: text("entity_id").notNull(),
    summary: text("summary"), // human-readable line for the activity feed
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId), index("audit_log_at_idx").on(t.at)],
);

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull(), // hex, used for chips
});

/** Polymorphic tagging: any entity (companies, deals, products…) by table name + id. */
export const entityTags = pgTable(
  "entity_tags",
  {
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    entity: text("entity").notNull(),
    entityId: integer("entity_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.tagId, t.entity, t.entityId] }), index("entity_tags_target_idx").on(t.entity, t.entityId)],
);

export type User = typeof users.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
