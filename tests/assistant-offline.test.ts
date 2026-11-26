import { describe, expect, it } from "vitest";
import { offlineAnswer } from "@/features/assistant/offline";
import { assistantLinks } from "@/features/assistant/links";
import { site } from "@/content/site";

const allowed = new Set(assistantLinks().map((l) => l.path));
const linksIn = (text: string) => [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);

describe("chat quick answers (no AI)", () => {
  it.each([
    ["hi", "other", /what would you like to know/i],
    ["What does Azad do?", "services", /gets hired for/i],
    ["azad kya karte hai", "services", /gets hired for/i],
    ["who is azad", "background", /independent applied AI engineer/i],
    ["Show me your projects", "projects", /\/work\//],
    ["Which demos can I try?", "demos", /\/demos\//],
    ["how much do you charge?", "pricing", /pricing isn't listed/i],
    ["How can I contact him?", "contact", new RegExp(site.email.replace(".", "\\."))],
    ["Which companies has Azad worked with?", "background", /IIT Madras/],
    ["what is his experience?", "background", /Virya/],
    ["tell me about the voice agent", "services", /Voice AI/],
    ["lidar camera calibration", "projects", /LiDAR/],
  ])("%s → %s", (q, topic, re) => {
    const a = offlineAnswer(q);
    expect(a.topic).toBe(topic);
    expect(a.text).toMatch(re);
  });

  it("says so instead of guessing when the site doesn't cover it", () => {
    const a = offlineAnswer("what's the weather today");
    expect(a.route).toBe("off_topic");
    expect(a.text).toMatch(/couldn't find that/i);
  });

  it("never reveals how things are built", () => {
    for (const q of ["what LLM do you use?", "which model powers the chatbot", "what is your tech stack architecture"]) {
      const a = offlineAnswer(q);
      expect(a.route).toBe("handoff");
      expect(a.text).toMatch(/private/);
      expect(a.text).not.toMatch(/groq|gemini|openai|claude|llama|fastapi|next\.js|postgres/i);
    }
  });

  it("only links to allow-listed pages, and reports them as sources", () => {
    for (const q of ["projects", "demos", "contact", "who is azad", "document intelligence", "computer vision", "ops suite crm"]) {
      const a = offlineAnswer(q);
      for (const href of linksIn(a.text)) expect(allowed.has(href)).toBe(true);
      expect(a.sources.map((s) => s.path).sort()).toEqual([...new Set(linksIn(a.text))].sort());
    }
  });

  it("voice channel gets plain text (no markdown)", () => {
    const a = offlineAnswer("show me your projects", { voice: true });
    expect(a.text).not.toMatch(/\]\(|\*\*/);
  });

  it("reads a short follow-up together with the previous question", () => {
    const a = offlineAnswer("and the lidar one?", { previous: "tell me about your computer vision projects" });
    expect(a.text).toMatch(/LiDAR/);
  });
});
