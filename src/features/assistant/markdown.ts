import { site } from "@/content/site";
import { assistantLinks } from "./links";

/**
 * A deliberately tiny markdown subset for assistant replies: paragraphs, bullet/numbered lists,
 * **bold**, *italic* and [links](…). Links survive only if they point at a known page of this site,
 * a listed profile or the contact email — anything else is shown as plain text.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "link"; text: string; href: string; external: boolean };

export type Block = { kind: "p"; inline: Inline[] } | { kind: "list"; ordered: boolean; items: Inline[][] };

const INTERNAL = new Set(assistantLinks().map((l) => l.path));
const EXTERNAL = new Set([...site.socials.map((s) => s.href.replace(/\/$/, "")), `mailto:${site.email}`]);

export function safeHref(raw: string): { href: string; external: boolean } | null {
  const href = raw.trim();
  if (href.startsWith("/")) {
    const path = href.split(/[?#]/)[0].replace(/(.)\/$/, "$1");
    return INTERNAL.has(path) ? { href, external: false } : null;
  }
  const bare = href.replace(/\/$/, "");
  if (EXTERNAL.has(bare)) return { href, external: true };
  if (href === site.email) return { href: `mailto:${site.email}`, external: true };
  return null;
}

const TOKEN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(?<![*\w])\*([^*\n]+)\*(?![*\w])/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  const push = (t: string) => {
    if (!t) return;
    const prev = out[out.length - 1];
    if (prev?.kind === "text") prev.text += t;
    else out.push({ kind: "text", text: t });
  };
  for (const m of text.matchAll(TOKEN)) {
    push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push({ kind: "strong", text: m[1] });
    else if (m[2] !== undefined) {
      const safe = safeHref(m[3]);
      if (safe) out.push({ kind: "link", text: m[2], ...safe });
      else push(m[2]);
    } else if (m[4] !== undefined) out.push({ kind: "em", text: m[4] });
    last = (m.index ?? 0) + m[0].length;
  }
  push(text.slice(last));
  return out;
}

const BULLET = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/;

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ kind: "p", inline: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };

  for (const raw of src.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/^#{1,6}\s+/, ""); // headings → plain lines
    const bullet = BULLET.exec(line);
    if (bullet) {
      flushPara();
      const ordered = bullet[1] !== undefined;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(bullet[2]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else if (list && /^\s{2,}/.test(raw)) {
      list.items[list.items.length - 1] += " " + line.trim(); // continuation of a list item
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return blocks;
}
