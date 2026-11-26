import { describe, expect, it } from "vitest";
import { neutral, pickVoice, speakable, takeSentences } from "@/features/demos/voice-ai/speech";

describe("speakable", () => {
  it("strips markdown, links, paths and routing tags", () => {
    expect(speakable("See **[Ops Suite](/work/ops-suite)** on the Work page (/work). [[topic: projects; route: answered]]")).toBe(
      "See Ops Suite on the Work page.",
    );
    expect(speakable("- one\n- two https://x.y/z")).toBe("one two");
  });
});

describe("takeSentences", () => {
  it("cuts complete sentences and keeps the rest for later", () => {
    const { sentences, rest } = takeSentences("Azad builds AI automation for teams. He also ships demos that wo");
    expect(sentences).toEqual(["Azad builds AI automation for teams."]);
    expect(rest).toBe("He also ships demos that wo");
  });
  it("doesn't split on titles, decimals or a full stop still streaming in", () => {
    expect(takeSentences("You're booked with Dr. Rao at 4.15 pm tomorrow. ").sentences).toEqual(["You're booked with Dr. Rao at 4.15 pm tomorrow."]);
    expect(takeSentences("This is the end of a long sentence.").sentences).toEqual([]);
  });
});



describe("pickVoice", () => {
  it("prefers Indian English and natural voices", () => {
    const v = (name: string, lang: string) => ({ name, lang, localService: true }) as SpeechSynthesisVoice;
    expect(pickVoice([v("Basic", "en-US"), v("Rishi", "en-IN"), v("French", "fr-FR")])?.name).toBe("Rishi");
    expect(pickVoice([v("Rishi", "en-IN"), v("Microsoft Neerja Online (Natural)", "en-IN")])?.name).toContain("Natural");
  });
});

describe("public snapshots", () => {
  it("sample calls and quality numbers carry results only (confidentiality)", async () => {
    const fs = await import("node:fs");
    for (const f of ["samples.json", "quality.json"]) {
      const text = fs.readFileSync(`src/features/demos/voice-ai/${f}`, "utf8").toLowerCase();
      for (const word of ["groq", "whisper", "llama", "gpt", "qwen", "prompt", "rules", "model", "flite", "unsure"]) {
        expect(text, `${f} mentions ${word}`).not.toContain(word);
      }
    }
  });
  it("every sample call ends with a staff note and only books real offers", async () => {
    const { SAMPLES } = await import("@/features/demos/voice-ai/useSamplePlayer");
    expect(SAMPLES.length).toBeGreaterThanOrEqual(5);
    for (const s of SAMPLES) {
      expect(s.summary.text.length).toBeGreaterThan(10);
      expect(s.turns[0].role).toBe("agent");
      const booked = s.turns.map((t) => t.booking).filter(Boolean);
      if (s.summary.outcome === "booked") expect(booked.length).toBeGreaterThan(0);
    }
  });
});

describe("neutral", () => {
  it("replaces pronouns with Azad's name (owner rule)", () => {
    expect(neutral("He focuses on automation. His clients trust him.")).toBe("Azad focuses on automation. Azad's clients trust Azad.");
    expect(neutral("She built it herself")).toBe("Azad built it Azad");
    expect(neutral("The help desk helps others.")).toBe("The help desk helps others.");
  });
});
