import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { projects } from "@/content/projects";
import { resumes } from "@/content/site";
import { knowledgeMarkdown } from "@/features/assistant/corpus";

describe("one portfolio, two audiences (AI automation + CV & robotics)", () => {
  it("every project says which audience it belongs to", () => {
    for (const p of projects) expect(["ai", "cv"]).toContain(p.field);
    expect(projects.some((p) => p.field === "ai")).toBe(true);
    expect(projects.some((p) => p.field === "cv")).toBe(true);
  });

  it("only CV & robotics case studies show method and tools (automation stays outcome-only)", () => {
    for (const p of projects) {
      if (p.field === "ai") {
        expect(p.method, p.slug).toBeUndefined();
        expect(p.tools, p.slug).toBeUndefined();
      } else {
        expect(p.method?.length, p.slug).toBeGreaterThan(0);
      }
    }
  });

  it("method and tools never reach the assistant's knowledge", () => {
    const k = knowledgeMarkdown();
    for (const p of projects) for (const m of p.method ?? []) expect(k.includes(m), m).toBe(false);
  });

  it("the résumés linked from the site exist", () => {
    for (const r of resumes) expect(existsSync(path.join(process.cwd(), "public", r.href)), r.href).toBe(true);
  });
});
