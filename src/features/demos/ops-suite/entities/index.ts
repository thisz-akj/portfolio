import type { EntityMeta } from "../filters/types";
import { companiesMeta } from "./companies";
import { contactsMeta } from "./contacts";
import { dealsMeta } from "./deals";
import { inventoryMeta, invoicesMeta, paymentsMeta, productsMeta, purchaseOrdersMeta, salesOrdersMeta } from "./erp";
import { leadsMeta } from "./leads";

/** Client-safe registry of list entities. Add an entity here and in ./server.ts, then flip it `ready` in nav.ts. */
export const entityMetas: Record<string, EntityMeta> = {
  companies: companiesMeta,
  contacts: contactsMeta,
  leads: leadsMeta,
  deals: dealsMeta,
  products: productsMeta,
  inventory: inventoryMeta,
  "sales-orders": salesOrdersMeta,
  "purchase-orders": purchaseOrdersMeta,
  invoices: invoicesMeta,
  payments: paymentsMeta,
};

export const getEntityMeta = (key: string): EntityMeta | undefined => (Object.hasOwn(entityMetas, key) ? entityMetas[key] : undefined);
