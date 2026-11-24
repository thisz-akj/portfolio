import { index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./columns";
import { users } from "./core";

/** Data portal: registered datasets (feeds into CRM/ERP tables), their import jobs and rejected rows. */

export const datasetSourceEnum = pgEnum("dataset_source", ["csv", "api", "webhook"]);
export const importStatusEnum = pgEnum("import_status", ["queued", "running", "succeeded", "partial", "failed"]);

/** Column mapping from a source file/feed to a target table. */
export interface DatasetSchema {
  columns: { source: string; target: string; required: boolean }[];
}

export const datasets = pgTable("datasets", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  source: datasetSourceEnum("source").notNull(),
  targetEntity: text("target_entity").notNull(), // e.g. "leads", "products"
  schema: jsonb("schema").$type<DatasetSchema>().notNull(),
  ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
  lastImportAt: timestamp("last_import_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const importJobs = pgTable(
  "import_jobs",
  {
    id: serial("id").primaryKey(),
    datasetId: integer("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    status: importStatusEnum("status").notNull().default("queued"),
    fileName: text("file_name"),
    rowsTotal: integer("rows_total").notNull().default(0),
    rowsOk: integer("rows_ok").notNull().default(0),
    rowsFailed: integer("rows_failed").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("import_jobs_dataset_idx").on(t.datasetId), index("import_jobs_created_idx").on(t.createdAt)],
);

export const importRejectedRows = pgTable(
  "import_rejected_rows",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => importJobs.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    raw: jsonb("raw").$type<Record<string, string>>().notNull(),
    errors: jsonb("errors").$type<string[]>().notNull(),
  },
  (t) => [index("rejected_job_idx").on(t.jobId)],
);
