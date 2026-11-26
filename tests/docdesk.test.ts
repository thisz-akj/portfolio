import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { csvCell, fieldsExport, money } from "@/features/demos/document-intelligence/ui/format";
import { snapshotLookup } from "@/features/demos/document-intelligence/snapshot.server";
import snapshot from "@/features/demos/document-intelligence/snapshot.json";
import { getDemo } from "@/content/demos";
import type { DocDetail, Extraction } from "@/features/demos/document-intelligence/types";

const ROOT = "src/features/demos/document-intelligence";

describe("DocDesk formatting and export", () => {
  it("formats rupees with Indian grouping", () => {
    expect(money(217356)).toBe("₹2,17,356");
    expect(money(null)).toBe("—");
  });

  it("guards CSV cells against formula injection and quotes commas", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("a, b")).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("exports typed values with human edits applied", () => {
    const doc = { id: "x", title: "T" } as DocDetail;
    const x = {
      type: "invoice",
      fields: [
        { key: "total", label: "Total", kind: "money", value: 100, display: "₹100", confidence: "high", source: { quote: "Total 100", page: 1, rects: [] } },
        { key: "due_date", label: "Due", kind: "date", value: null, display: "Not in document", confidence: "missing", source: null },
      ],
      lineItems: [],
    } as unknown as Extraction;
    const out = fieldsExport(doc, x, { due_date: "2026-12-01" });
    expect(out.fields).toEqual({ total: 100, due_date: "2026-12-01" });
    expect(out.review.due_date.status).toBe("edited");
    expect(out.review.total).toEqual({ status: "high", page: 1, quote: "Total 100" });
  });
});

describe("DocDesk offline snapshot", () => {
  const snap = snapshot as Record<string, unknown>;
  const docs = (snap.documents as { documents: { id: string; examples: string[]; pages: number }[] }).documents;

  it("covers every sample: detail, extraction, examples and page images", async () => {
    expect(docs).toHaveLength(8);
    const images = new Set(readdirSync("public/demos/docdesk"));
    for (const d of docs) {
      expect(snap[`documents/${d.id}`]).toBeTruthy();
      expect(snap[`documents/${d.id}/extract`]).toBeTruthy();
      for (let i = 0; i < d.examples.length; i++) expect(await snapshotLookup(`documents/${d.id}/ask`, new URLSearchParams({ example: String(i) }))).toBeTruthy();
      for (let p = 1; p <= d.pages; p++) expect(images.has(`${d.id}-${p}.webp`)).toBe(true);
    }
    expect(await snapshotLookup("compare", new URLSearchParams({ a: "po-saffron-0932", b: "invoice-kaveri-1187" }))).toBeTruthy();
    const img = await snapshotLookup("documents/msa-kestrel-v1/pages/2", new URLSearchParams());
    expect(img).toBeInstanceOf(Response);
    expect(await snapshotLookup("documents/u-unknown/pages/1", new URLSearchParams())).toBeUndefined();
  });

  it("has a published quality run", () => {
    const q = snap.quality as { available: boolean; qa?: { questions: number } };
    expect(q.available).toBe(true);
    expect(q.qa!.questions).toBeGreaterThanOrEqual(30);
  });
});

describe("DocDesk confidentiality (owner rule: how it's built stays private)", () => {
  const LEAKS = [/groq/i, /\bgpt/i, /qwen/i, /llama/i, /claude/i, /gemini/i, /\bbm25\b/i, /\bprompt\b/i, /pdfplumber/i, /pdfium/i, /fastapi/i, /\bembedding/i, /\bLLM\b/];
  const files = [
    ...readdirSync(join(ROOT, "ui")).map((f) => join(ROOT, "ui", f)),
    join(ROOT, "showcase", "DocDeskDemo.tsx"),
    join(ROOT, "snapshot.json"),
    "src/app/(portal)/demos/document-intelligence/app/layout.tsx",
  ];

  it("UI, showcase and everything sent to the browser name no models, vendors or methods", () => {
    for (const f of files) {
      const text = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      // Sample documents legitimately say "prompt written notice"; that word is only checked in code.
      const leaks = f.endsWith(".json") ? LEAKS.filter((re) => !re.source.includes("prompt")) : LEAKS;
      for (const re of leaks) expect(re.test(text), `${f} matches ${re}`).toBe(false);
    }
    expect(JSON.stringify((snapshot as Record<string, unknown>).quality)).not.toContain("versions");
  });

  it("the public demo entry is a limited preview with no build details", () => {
    const d = getDemo("document-intelligence")!;
    expect(d.status).toBe("limited-preview");
    expect(JSON.stringify(d)).not.toMatch(/groq|gpt|qwen|python|bm25|fastapi/i);
  });
});
