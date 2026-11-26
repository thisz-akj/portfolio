import { describe, expect, it } from "vitest";
import { LIVE_DEMO_TYPE, PROJECT_TYPES, validateContact } from "@/lib/contact";

const good = { name: "Ada", email: "ada@example.com", type: PROJECT_TYPES[0], message: "We need RAG over 2,000 contracts by March." };

describe("validateContact", () => {
  it("accepts a valid enquiry and trims fields", () => {
    const r = validateContact({ ...good, name: "  Ada  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.name).toBe("Ada");
  });
  it("rejects bad email, unknown type and short message", () => {
    const r = validateContact({ ...good, email: "nope", type: "hack", message: "hi" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "message", "type"]);
  });
  it("handles non-object input", () => {
    expect(validateContact(null).ok).toBe(false);
  });
});

describe("live demo requests (LiveDemoDialog)", () => {
  it("accepts the live-demo type, which the contact page's dropdown doesn't offer", () => {
    const v = validateContact({ name: "Asha", email: "asha@example.com", type: LIVE_DEMO_TYPE, message: "Live demo request: DocDesk.\n\nNo note added." });
    expect(v.ok).toBe(true);
    expect(PROJECT_TYPES).not.toContain(LIVE_DEMO_TYPE);
    expect(validateContact({ name: "Asha", email: "asha@example.com", type: "Free money", message: "x".repeat(30) }).ok).toBe(false);
  });
});
