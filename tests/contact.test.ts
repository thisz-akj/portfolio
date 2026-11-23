import { describe, expect, it } from "vitest";
import { PROJECT_TYPES, validateContact } from "@/lib/contact";

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
