import { numeric, timestamp } from "drizzle-orm/pg-core";

/** ₹ amounts: numeric(14,2), read back as JS numbers (safe well beyond ₹1,000 crore). */
export const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });

export const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
