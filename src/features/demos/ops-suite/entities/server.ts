import type { EntityServer } from "../filters/toSql";
import { companiesServer } from "./companies.server";
import { contactsServer } from "./contacts.server";
import { dealsServer } from "./deals.server";
import { leadsServer } from "./leads.server";

/** Server-only registry: entity key → SQL config. Never import from a client component. */
const entityServers: Record<string, EntityServer> = {
  companies: companiesServer,
  contacts: contactsServer,
  leads: leadsServer,
  deals: dealsServer,
};

export const getEntityServer = (key: string): EntityServer | undefined => (Object.hasOwn(entityServers, key) ? entityServers[key] : undefined);
