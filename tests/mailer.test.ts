import { describe, expect, it } from "vitest";
import { buildAutoReply, buildNotification, escapeHtml, mailConfigFromEnv } from "@/lib/mailer";
import { PROJECT_TYPES, type ContactInput } from "@/lib/contact";

const d: ContactInput = {
  name: "Ada <script>",
  email: "ada@example.com",
  company: "Acme\r\nBcc: x@evil.com",
  type: PROJECT_TYPES[0],
  message: "We need <b>RAG</b> over 2,000 contracts & more.",
};
const cfg = { from: "Portfolio <hi@example.dev>", to: "me@example.dev" };

describe("mailer", () => {
  it("is off without an API key and defaults the recipient", () => {
    expect(mailConfigFromEnv({} as NodeJS.ProcessEnv, "me@x.dev")).toBeNull();
    const c = mailConfigFromEnv({ RESEND_API_KEY: "re_1" } as unknown as NodeJS.ProcessEnv, "me@x.dev");
    expect(c).toMatchObject({ to: "me@x.dev", autoReply: false });
  });
  it("escapes HTML", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
  it("notification goes to the owner, replies go to the visitor, user text is escaped", () => {
    const n = buildNotification(d, cfg);
    expect(n.to).toEqual(["me@example.dev"]);
    expect(n.reply_to).toBe("ada@example.com");
    expect(n.subject).not.toMatch(/[\r\n]/);
    expect(n.html).not.toContain("<script>");
    expect(n.html).toContain("&lt;b&gt;RAG&lt;/b&gt;");
    expect(n.text).toContain("We need <b>RAG</b>");
  });
  it("auto-reply goes to the visitor with reply-to the owner", () => {
    const a = buildAutoReply(d, cfg);
    expect(a.to).toEqual(["ada@example.com"]);
    expect(a.reply_to).toBe("me@example.dev");
    expect(a.html).toContain("Hi Ada,");
  });
});
