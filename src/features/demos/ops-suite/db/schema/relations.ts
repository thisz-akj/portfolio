import { relations } from "drizzle-orm";
import { users } from "./core";
import { activities, companies, contacts, deals, leads } from "./crm";
import {
  inventory,
  invoices,
  payments,
  products,
  purchaseOrderLines,
  purchaseOrders,
  salesOrderLines,
  salesOrders,
  suppliers,
  warehouses,
} from "./erp";
import { datasets, importJobs, importRejectedRows } from "./portal";

/** Relational query API wiring (db.query.x.findMany({ with: … })), used by record drawers and detail pages. */

export const usersRelations = relations(users, ({ many }) => ({
  companies: many(companies),
  deals: many(deals),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  owner: one(users, { fields: [companies.ownerId], references: [users.id] }),
  contacts: many(contacts),
  deals: many(deals),
  activities: many(activities),
  salesOrders: many(salesOrders),
  invoices: many(invoices),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  company: one(companies, { fields: [contacts.companyId], references: [companies.id] }),
  owner: one(users, { fields: [contacts.ownerId], references: [users.id] }),
  activities: many(activities),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  owner: one(users, { fields: [leads.ownerId], references: [users.id] }),
  convertedCompany: one(companies, { fields: [leads.convertedCompanyId], references: [companies.id] }),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  company: one(companies, { fields: [deals.companyId], references: [companies.id] }),
  contact: one(contacts, { fields: [deals.contactId], references: [contacts.id] }),
  owner: one(users, { fields: [deals.ownerId], references: [users.id] }),
  activities: many(activities),
  salesOrders: many(salesOrders),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  company: one(companies, { fields: [activities.companyId], references: [companies.id] }),
  contact: one(contacts, { fields: [activities.contactId], references: [contacts.id] }),
  deal: one(deals, { fields: [activities.dealId], references: [deals.id] }),
  owner: one(users, { fields: [activities.ownerId], references: [users.id] }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  inventory: many(inventory),
  salesOrderLines: many(salesOrderLines),
  purchaseOrderLines: many(purchaseOrderLines),
}));

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  inventory: many(inventory),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  product: one(products, { fields: [inventory.productId], references: [products.id] }),
  warehouse: one(warehouses, { fields: [inventory.warehouseId], references: [warehouses.id] }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [purchaseOrders.supplierId], references: [suppliers.id] }),
  warehouse: one(warehouses, { fields: [purchaseOrders.warehouseId], references: [warehouses.id] }),
  lines: many(purchaseOrderLines),
}));

export const purchaseOrderLinesRelations = relations(purchaseOrderLines, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, { fields: [purchaseOrderLines.purchaseOrderId], references: [purchaseOrders.id] }),
  product: one(products, { fields: [purchaseOrderLines.productId], references: [products.id] }),
}));

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  company: one(companies, { fields: [salesOrders.companyId], references: [companies.id] }),
  deal: one(deals, { fields: [salesOrders.dealId], references: [deals.id] }),
  warehouse: one(warehouses, { fields: [salesOrders.warehouseId], references: [warehouses.id] }),
  owner: one(users, { fields: [salesOrders.ownerId], references: [users.id] }),
  lines: many(salesOrderLines),
  invoice: one(invoices),
}));

export const salesOrderLinesRelations = relations(salesOrderLines, ({ one }) => ({
  salesOrder: one(salesOrders, { fields: [salesOrderLines.salesOrderId], references: [salesOrders.id] }),
  product: one(products, { fields: [salesOrderLines.productId], references: [products.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  salesOrder: one(salesOrders, { fields: [invoices.salesOrderId], references: [salesOrders.id] }),
  company: one(companies, { fields: [invoices.companyId], references: [companies.id] }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));

export const datasetsRelations = relations(datasets, ({ one, many }) => ({
  owner: one(users, { fields: [datasets.ownerId], references: [users.id] }),
  jobs: many(importJobs),
}));

export const importJobsRelations = relations(importJobs, ({ one, many }) => ({
  dataset: one(datasets, { fields: [importJobs.datasetId], references: [datasets.id] }),
  rejectedRows: many(importRejectedRows),
}));

export const importRejectedRowsRelations = relations(importRejectedRows, ({ one }) => ({
  job: one(importJobs, { fields: [importRejectedRows.jobId], references: [importJobs.id] }),
}));
