import { describe, expect, it } from "vitest";
import { solutions } from "@/content/solutions";
import { demos } from "@/content/demos";
import { projects } from "@/content/projects";
import { existsSync } from "node:fs";

describe("content integrity", () => {
  it("has the seven solution categories", () => expect(solutions).toHaveLength(7));
  it("every solution demo link resolves", () => {
    for (const s of solutions) if (s.demoSlug) expect(demos.some((d) => d.slug === s.demoSlug)).toBe(true);
  });
  it("slugs are unique", () => {
    for (const list of [solutions, demos, projects]) expect(new Set(list.map((x) => x.slug)).size).toBe(list.length);
  });
  it("project images exist in /public", () => {
    for (const p of projects) for (const src of [p.cover, ...p.gallery]) expect(existsSync(`public${src}`), src).toBe(true);
  });
  it("solution and hero art exist in /public", () => {
    for (const src of [...solutions.map((s) => s.art), "/video/hero-motion.webp", "/video/hero-motion-mobile.webp"])
      expect(existsSync(`public${src}`), src).toBe(true);
    const clips = [...solutions.map((s) => s.video), "hero-motion", "hero-motion-mobile"].filter(Boolean);
    for (const v of clips) {
      expect(existsSync(`public/video/${v}.mp4`), `${v}.mp4`).toBe(true);
      expect(existsSync(`public/video/${v}.webp`), `${v}.webp`).toBe(true);
    }
  });
  it("every solution has a complete showcase script", () => {
    for (const s of solutions) {
      expect(s.story.length).toBeGreaterThan(100);
      expect(s.showcase.steps.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("no demo is marked live without a registered component", async () => {
    const { demoComponents } = await import("@/features/demos/registry");
    for (const d of demos) if (d.status === "live") expect(demoComponents[d.slug]).toBeDefined();
  });
});
