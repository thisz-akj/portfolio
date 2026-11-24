import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRACT_PATH, contractJson } from "@/features/demos/ops-suite/ai/contract";

describe("Python eval contract", () => {
  it("is up to date with the live prompt, schema and golden set (run `npm run ai:contract`)", () => {
    expect(readFileSync(CONTRACT_PATH, "utf8")).toBe(contractJson());
  });
});
