import type { EntityServer } from "../filters/toSql";
import { companiesServer } from "./companies.server";
import { contactsServer } from "./contacts.server";
import { dealsServer } from "./deals.server";
import { inventoryServer, invoicesServer, paymentsServer, productsServer, purchaseOrdersServer, salesOrdersServer } from "./erp.server";
import { leadsServer } from "./leads.server";
import { auditServer, datasetsServer, importsServer } from "./portal.server";

/** Server-only registry: entity key → SQL config. Never import from a client component. */
const entityServers: Record<string, EntityServer> = {
  companies: companiesServer,
  contacts: contactsServer,
  leads: leadsServer,
  deals: dealsServer,
  products: productsServer,
  inventory: inventoryServer,
  "sales-orders": salesOrdersServer,
  "purchase-orders": purchaseOrdersServer,
  invoices: invoicesServer,
  payments: paymentsServer,
  datasets: datasetsServer,
  imports: importsServer,
  "audit-log": auditServer,
};

export const getEntityServer = (key: string): EntityServer | undefined => (Object.hasOwn(entityServers, key) ? entityServers[key] : undefined);
