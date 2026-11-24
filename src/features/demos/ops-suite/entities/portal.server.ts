import { sql } from "drizzle-orm";
import { auditLog, datasets, importJobs } from "../db/schema";
import { istDate, outer, type EntityServer } from "../filters/toSql";
import { loadAllUsers } from "./options.server";
import { auditMeta, datasetsMeta, importsMeta } from "./portal";
import { asc } from "drizzle-orm";

const dsId = outer(datasets.id);
const num = (q: ReturnType<typeof sql>) => q.mapWith(Number);
const recent = sql`j.started_at >= now() - interval '30 days'`;

export const datasetsServer: EntityServer = {
  meta: datasetsMeta,
  table: datasets,
  id: datasets.id,
  fields: {
    name: { expr: datasets.name, searchable: true },
    source: { expr: datasets.source },
    target: { expr: datasets.targetEntity },
    lastStatus: { expr: sql`(select j.status from import_jobs j where j.dataset_id = ${dsId} order by j.started_at desc nulls last limit 1)` },
    lastImportAt: { expr: istDate(datasets.lastImportAt), select: datasets.lastImportAt },
    jobs30d: { expr: num(sql`(select count(*) from import_jobs j where j.dataset_id = ${dsId} and ${recent})`) },
    rows30d: { expr: num(sql`(select coalesce(sum(j.rows_ok), 0) from import_jobs j where j.dataset_id = ${dsId} and ${recent})`) },
    rejectRate: { expr: num(sql`(select round(coalesce(sum(j.rows_failed), 0) * 100.0 / nullif(sum(j.rows_total), 0), 1) from import_jobs j where j.dataset_id = ${dsId} and ${recent})`) },
    description: { expr: datasets.description, searchable: true },
  },
};

export const importsServer: EntityServer = {
  meta: importsMeta,
  table: importJobs,
  id: importJobs.id,
  fields: {
    label: { expr: sql<string>`coalesce(${outer(importJobs.fileName)}, (select d.name from datasets d where d.id = ${outer(importJobs.datasetId)}) || ' #' || ${outer(importJobs.id)})`, searchable: true },
    dataset: { expr: importJobs.datasetId, label: sql<string>`(select d.name from datasets d where d.id = ${outer(importJobs.datasetId)})` },
    status: { expr: importJobs.status },
    rowsTotal: { expr: importJobs.rowsTotal },
    rowsOk: { expr: importJobs.rowsOk },
    rowsFailed: { expr: importJobs.rowsFailed },
    durationS: { expr: num(sql`round(extract(epoch from (${outer(importJobs.finishedAt)} - ${outer(importJobs.startedAt)}))::numeric, 1)`) },
    error: { expr: importJobs.error, searchable: true },
    createdBy: { expr: importJobs.createdBy, label: sql<string>`(select u.name from users u where u.id = ${outer(importJobs.createdBy)})` },
    startedAt: { expr: istDate(importJobs.startedAt), select: importJobs.startedAt },
  },
  options: async (db) => {
    const [dataset, createdBy] = await Promise.all([
      db.select({ id: datasets.id, name: datasets.name }).from(datasets).orderBy(asc(datasets.name)),
      loadAllUsers(db),
    ]);
    return { dataset: dataset.map((d) => ({ value: String(d.id), label: d.name })), createdBy };
  },
};

export const auditServer: EntityServer = {
  meta: auditMeta,
  table: auditLog,
  id: auditLog.id,
  fields: {
    summary: { expr: auditLog.summary, searchable: true },
    entity: { expr: auditLog.entity },
    action: { expr: auditLog.action, searchable: true },
    actor: { expr: auditLog.actorId, label: sql<string>`(select u.name from users u where u.id = ${outer(auditLog.actorId)})` },
    at: { expr: istDate(auditLog.at), select: auditLog.at },
    entityId: { expr: auditLog.entityId },
  },
  options: async (db) => ({ actor: await loadAllUsers(db) }),
};
