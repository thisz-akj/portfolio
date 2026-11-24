import type { EntityServer } from "../filters/toSql";
import { companiesServer } from "./companies.server";

/** Server-only registry: entity key → SQL config. Never import from a client component. */
const entityServers: Record<string, EntityServer> = {
  companies: companiesServer,
};

export const getEntityServer = (key: string): EntityServer | undefined => (Object.hasOwn(entityServers, key) ? entityServers[key] : undefined);
