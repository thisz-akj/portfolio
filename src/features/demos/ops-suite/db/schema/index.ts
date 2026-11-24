/**
 * Ops Suite schema — one Postgres database shared by the CRM, ERP and data portal.
 * After changing any file here: `npm run db:generate` (writes SQL to /drizzle, commit it), then `npm run db:migrate`.
 */
export * from "./core";
export * from "./crm";
export * from "./erp";
export * from "./portal";
export * from "./relations";
