/** `npm run ai:contract` — writes ops-ai/ops_ai/contract.json from the live prompt, schema and golden set. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CONTRACT_PATH, contractJson } from "./contract";

mkdirSync(dirname(CONTRACT_PATH), { recursive: true });
writeFileSync(CONTRACT_PATH, contractJson());
console.log(`✓ wrote ${CONTRACT_PATH}`);
