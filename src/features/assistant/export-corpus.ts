/** `npm run assistant:corpus` — writes assistant/corpus/site.json from src/content. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CORPUS_PATH, corpusJson } from "./corpus";

mkdirSync(dirname(CORPUS_PATH), { recursive: true });
writeFileSync(CORPUS_PATH, corpusJson());
console.log(`✓ wrote ${CORPUS_PATH}`);
