import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CORPUS_PATH, corpusJson, knowledgeMarkdown } from "@/features/assistant/corpus";
import { parseInline, parseMarkdown, safeHref } from "@/features/assistant/markdown";
import { readEvents, validChat, type AssistantEvent } from "@/features/assistant/protocol";

describe("assistant corpus", () => {
  it("is up to date — run `npm run assistant:corpus` after editing src/content", () => {
    expect(readFileSync(CORPUS_PATH, "utf8")).toBe(corpusJson());
  });

  it("leaves out placeholder experience and keeps real facts", () => {
    const k = knowledgeMarkdown();
    expect(k).not.toContain("Company name");
    expect(k).toContain("IIT Madras");
    expect(k).toContain("/work/ops-suite");
  });

  it("never carries implementation details (owner rule: how it's built stays private)", () => {
    const k = knowledgeMarkdown();
    for (const leak of ["Stack:", "How Azad builds", "Approach:", "How it works:", "Postgres", "Drizzle", "Gemini", "Claude", "semantic layer"]) {
      expect(k, leak).not.toContain(leak);
    }
  });
});

describe("assistant markdown", () => {
  it("keeps only known links", () => {
    expect(safeHref("/work/ops-suite")).toEqual({ href: "/work/ops-suite", external: false });
    expect(safeHref("/contact#form")).toEqual({ href: "/contact#form", external: false });
    expect(safeHref("/admin")).toBeNull();
    expect(safeHref("https://evil.example")).toBeNull();
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("https://github.com/thisz-akj")?.external).toBe(true);
  });

  it("renders unknown links as plain text", () => {
    expect(parseInline("see [this](https://evil.example) or [Contact](/contact)")).toEqual([
      { kind: "text", text: "see this or " },
      { kind: "link", text: "Contact", href: "/contact", external: false },
    ]);
  });

  it("parses bold, italics, paragraphs and lists", () => {
    const blocks = parseMarkdown("**Ops Suite** is a *demo*.\n\n- one\n- two\n\n1. first\n2. second\n### Heading");
    expect(blocks.map((b) => b.kind)).toEqual(["p", "list", "list", "p"]);
    expect(blocks[0]).toEqual({
      kind: "p",
      inline: [
        { kind: "strong", text: "Ops Suite" },
        { kind: "text", text: " is a " },
        { kind: "em", text: "demo" },
        { kind: "text", text: "." },
      ],
    });
    expect(blocks[2]).toMatchObject({ kind: "list", ordered: true });
  });
});

describe("assistant protocol", () => {
  const stream = (chunks: string[]) =>
    new ReadableStream<Uint8Array>({
      start(c) {
        const enc = new TextEncoder();
        chunks.forEach((s) => c.enqueue(enc.encode(s)));
        c.close();
      },
    });

  it("reassembles events split across chunks", async () => {
    const seen: AssistantEvent[] = [];
    await readEvents(stream(['{"type":"meta","mo', 'de":"live"}\n{"type":"delta","text":"Hi ₹"}\n', "not json\n", '{"type":"done"}']), (e) =>
      seen.push(e),
    );
    expect(seen).toEqual([{ type: "meta", mode: "live" }, { type: "delta", text: "Hi ₹" }, { type: "done" }]);
  });

  it("validates chat requests", () => {
    expect(validChat({ messages: [{ role: "user", content: "hi" }] })).toBe(true);
    expect(validChat({ messages: [] })).toBe(false);
    expect(validChat({ messages: [{ role: "assistant", content: "hi" }] })).toBe(false);
    expect(validChat({ messages: [{ role: "system", content: "hi" }] })).toBe(false);
    expect(validChat({ messages: [{ role: "user", content: "x".repeat(1001) }] })).toBe(false);
  });
});
