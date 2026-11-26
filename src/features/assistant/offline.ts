/**
 * Quick answers for the site chat with no AI model: used when the assistant service isn't reachable
 * (e.g. not hosted yet). Rules + keyword search over the site's own content (src/content via the corpus
 * builder), so answers can't be invented or drift from the site. 0 tokens; never counts as a free question.
 *
 * 1. Intents (greeting, contact/pricing, services, projects, demos, clients, experience, skills, location,
 *    "how is it built" → confidential) answered in full sentences from content.
 * 2. Named things (a solution, project or demo) → its summary + link.
 * 3. Anything else → the best-matching section of the site (TF-IDF with light stemming and synonyms).
 * Links are only ever pages from assistantLinks(), the chat's allow-list.
 */

import { experience, site, skills } from "@/content/site";
import { solutions } from "@/content/solutions";
import { demos, statusLabel } from "@/content/demos";
import { projects } from "@/content/projects";
import { clients } from "@/content/clients";
import { knowledgeMarkdown } from "./corpus";
import { assistantLinks, type AssistantLink } from "./links";
import type { AssistantRoute, AssistantTopic } from "./protocol";

export interface OfflineAnswer {
  text: string;
  topic: AssistantTopic;
  route: AssistantRoute;
  sources: AssistantLink[];
}

const FIRST = site.name.split(" ")[0]; // "Azad"

// ---- text helpers ------------------------------------------------------------------------------

const STOP = new Set(
  (
    "a an the and or of to in on for with is are was were be been being it its this that these those what which who whom " +
    "how why when do does did can could would should will shall may might must you your yours he she they them his her " +
    "their about me my i we our us tell show give any some there have has had from at by as if into more most please " +
    "just also so than then very really much many get got know like want need let lets i'm im it's " +
    "today now time day week new best good thing things stuff something build builds make makes create develop use using " +
    "azad azads kumar jha" +
    // Hinglish fillers, so "azad kya karte hai" still finds "karte"-free keywords
    " kya kaun kaise kab kahan hai hain ho hu tha thi the karte karta karti karo batao bataiye mujhe aap aapka apna ke ki ka ko se par mein me bhi aur ya"
  ).split(" "),
);

const SYNONYMS: Record<string, string> = {
  chatbot: "support", bot: "support", helpdesk: "support", ticket: "support", tickets: "support",
  pdf: "document", pdfs: "document", invoice: "document", invoices: "document", contract: "document", contracts: "document", ocr: "document",
  phone: "voice", calls: "voice", receptionist: "voice", ivr: "voice",
  dashboard: "analytics", dashboards: "analytics", sql: "analytics", reports: "analytics", reporting: "analytics",
  robot: "robotics", robots: "robotics", amr: "robotics", amrs: "robotics", autonomous: "robotics",
  cv: "vision", camera: "vision", cameras: "vision", image: "vision", images: "vision", video: "vision", detection: "vision",
  crm: "ops", erp: "ops", inventory: "ops",
  evals: "evaluation", eval: "evaluation", testing: "evaluation", monitoring: "evaluation",
  workflow: "automation", workflows: "automation", automate: "automation", automating: "automation", automated: "automation",
  rpa: "automation", zapier: "automation", n8n: "automation",
  whatsapp: "whatsapp", kaam: "work",
};

/** Light stemmer: "automating/automated/automation" → "autom", "documents" → "document". */
function stem(w: string) {
  for (const suf of ["ations", "ation", "ating", "ated", "ates", "ate", "ings", "ing", "ers", "ed", "es", "s"]) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length);
  }
  return w;
}

const rawWords = (text: string) => text.toLowerCase().replace(/[’']/g, "").match(/[\p{L}\p{N}]+/gu) ?? [];
const terms = (text: string) =>
  rawWords(text)
    .filter((w) => !STOP.has(w) && w.length > 1)
    .map((w) => stem(SYNONYMS[w] ?? SYNONYMS[stem(w)] ?? w));
const hasAny = (words: Set<string>, list: string[]) => list.some((w) => words.has(w));

// ---- links -------------------------------------------------------------------------------------

const LINKS = assistantLinks();
const linkFor = (path: string) => LINKS.find((l) => l.path === path);
const md = (path: string, label?: string) => {
  const l = linkFor(path);
  return l ? `[${label ?? l.label}](${l.path})` : label ?? "";
};
const sourcesIn = (text: string): AssistantLink[] => {
  const seen = new Map<string, AssistantLink>();
  for (const m of text.matchAll(/\]\((\/[^)]*)\)/g)) {
    const l = linkFor(m[1]);
    if (l) seen.set(l.path, l);
  }
  return [...seen.values()];
};

// ---- searchable items: solutions, projects, demos, and the site's knowledge sections -----------

interface Item {
  kind: "solution" | "project" | "demo" | "section";
  title: string;
  body: string;
  path?: string;
  terms: Set<string>;
  titleTerms: Set<string>;
}

let cache: { items: Item[]; df: Map<string, number> } | null = null;

function index() {
  if (cache) return cache;
  const items: Item[] = [];
  /** `extra` is searchable but not shown (tags, customer lists). */
  const add = (kind: Item["kind"], title: string, body: string, path?: string, extra = "") =>
    items.push({ kind, title, body, path, terms: new Set(terms(`${title} ${body} ${extra}`)), titleTerms: new Set(terms(title)) });

  for (const s of solutions)
    add("solution", s.title, `${s.hook} ${s.problem}\nWhat it covers: ${s.capabilities.join(", ")}.`, "/solutions", s.customers.join(" "));
  for (const p of projects) add("project", p.title, p.summary, `/work/${p.slug}`, `${p.tags.join(" ")} ${p.client}`);
  for (const d of demos) add("demo", d.name, d.summary, `/demos/${d.slug}`, d.problem ?? "");
  for (const block of knowledgeMarkdown().split(/\n(?=#{2,3} )/)) {
    const [head, ...rest] = block.split("\n");
    if (!/^#{2,3} /.test(head)) continue;
    const title = head.replace(/^#+\s*/, "").replace(/\s*\(source: [^)]+\)\s*$/, "").trim();
    const path = head.match(/\(source: (\/[^)]*)\)/)?.[1];
    const body = rest.join("\n").trim();
    if (body.length > 40) add("section", title, body, path && linkFor(path) ? path : undefined);
  }
  const df = new Map<string, number>();
  for (const it of items) for (const t of it.terms) df.set(t, (df.get(t) ?? 0) + 1);
  cache = { items, df };
  return cache;
}

function search(question: string) {
  const { items, df } = index();
  const q = [...new Set(terms(question))];
  if (!q.length) return [];
  const n = items.length;
  return items
    .map((it) => {
      let score = 0;
      for (const t of q) if (it.terms.has(t)) score += Math.log(1 + n / (df.get(t) ?? 1)) * (it.titleTerms.has(t) ? 3 : 1);
      // a named thing beats a long section mentioning the same words
      if (it.kind !== "section") score *= 1.25;
      return { it, score };
    })
    .filter((r) => r.score > 0)
    .map((r) => ({ ...r, coverage: q.filter((t) => r.it.terms.has(t)).length / q.length }))
    .sort((a, b) => b.score - a.score);
}

const excerpt = (body: string, limit = 420) => {
  let out = "";
  for (const line of body.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const clean = line.replace(/^(Hook|Problem|Summary|In Azad's words):\s*/i, "");
    if (out && out.length + clean.length > limit) break;
    out += (out ? "\n" : "") + clean;
  }
  return out.length > limit + 120 ? `${out.slice(0, limit).replace(/\s+\S*$/, "")}…` : out;
};

// ---- intents -----------------------------------------------------------------------------------

const GREET = ["hi", "hello", "hey", "hii", "hiii", "namaste", "namaskar", "hola", "yo", "sup", "morning", "evening", "afternoon"];
const THANKS = ["thanks", "thank", "thx", "ty", "shukriya", "dhanyavad", "great", "awesome", "cool", "ok", "okay", "bye", "goodbye"];
const CONTACT = ["contact", "email", "mail", "reach", "hire", "hiring", "available", "availability", "book", "meeting", "touch", "number", "connect", "freelance", "engage"];
const PRICING = ["price", "pricing", "cost", "costs", "rate", "rates", "budget", "charge", "charges", "fee", "fees", "quote", "expensive", "cheap", "paisa", "kitna"];
const BUILT = ["llm", "llms", "gpt", "openai", "groq", "gemini", "claude", "model", "models", "architecture", "stack", "framework", "frameworks", "prompt", "prompts", "langchain", "rag", "backend", "hosting", "hosted", "database"];
const SERVICES = ["services", "service", "offer", "offering", "offerings", "solutions", "solution", "help", "specialise", "specialize", "specialty", "expertise", "provide"];
const PROJECTS = ["projects", "project", "portfolio", "case", "studies", "study", "examples", "built", "previous"];
const DEMOS = ["demo", "demos", "try", "playground", "live"];
const CLIENTS = ["clients", "client", "companies", "company", "customers", "organisations", "organizations", "worked"];
const EXPERIENCE = ["experience", "background", "career", "resume", "job", "jobs", "history", "education", "studied", "intern", "internship"];
const SKILLS = ["skills", "skill", "tech", "technologies", "technology", "tools", "languages", "good"];
const LOCATION = ["where", "location", "located", "based", "city", "country", "timezone", "kahan"];
const WHO = ["who", "yourself", "introduce", "introduction", "kaun"];

function intentAnswer(q: string, words: Set<string>, voice: boolean): OfflineAnswer | null {
  const contactLine = `You can reach ${FIRST} at ${site.email} or ${site.phone.display}, or through the ${md("/contact", "contact form")}.`;
  const contactLower = contactLine.charAt(0).toLowerCase() + contactLine.slice(1);
  const count = words.size;

  if (count <= 4 && hasAny(words, GREET))
    return {
      text: `Hi! I can tell you about ${FIRST}'s work: what ${FIRST} builds, projects, demos you can try, experience, or how to get in touch. What would you like to know?`,
      topic: "other",
      route: "answered",
      sources: [],
    };
  if (count <= 4 && hasAny(words, THANKS))
    return { text: `You're welcome! If you'd like to talk about a project, ${contactLower}`, topic: "contact", route: "handoff", sources: [] };

  if (hasAny(words, BUILT) && !hasAny(words, ["projects", "demos"]))
    return {
      text: `${FIRST} keeps the details of how each system is built private, since that's the craft clients pay for. Happy to walk through what it does and the results on a call: ${contactLine}`,
      topic: "other",
      route: "handoff",
      sources: [],
    };

  if (hasAny(words, PRICING))
    return {
      text: `Pricing isn't listed on the site: it depends on the scope, so the quickest way is to describe what you need. ${contactLine}`,
      topic: "pricing",
      route: "handoff",
      sources: [],
    };
  if (hasAny(words, CONTACT))
    return { text: `${FIRST} is ${site.status.toLowerCase()}. ${contactLine}`, topic: "contact", route: "handoff", sources: [] };

  if (hasAny(words, LOCATION))
    return { text: `${FIRST} is based in ${site.location.city} and works with clients remotely. ${contactLine}`, topic: "background", route: "answered", sources: [] };

  if (hasAny(words, CLIENTS) && !hasAny(words, ["projects", "demos"])) {
    const list = clients
      .filter((c) => !c.placeholder)
      .map((c) => (c.sub && !c.name.toLowerCase().includes(c.sub.toLowerCase()) && !c.sub.toLowerCase().includes("limited") ? `${c.name} (${c.sub})` : c.name));
    return { text: `${FIRST} has worked with ${joinList(list)}. More in ${md("/work")}.`, topic: "background", route: "answered", sources: [] };
  }

  if (hasAny(words, EXPERIENCE)) {
    const roles = experience.filter((r) => !r.placeholder).map((r) => `- **${r.title}**, ${r.company} (${r.period})`);
    return { text: `${FIRST}'s experience:\n${roles.join("\n")}\n\nMore in ${md("/about", "About")}.`, topic: "background", route: "answered", sources: [] };
  }

  if (hasAny(words, SKILLS) && !hasAny(words, SERVICES)) {
    const lines = skills.map((s) => `- **${s.title}:** ${s.items.join(", ")}`);
    return { text: `What ${FIRST} works on:\n${lines.join("\n")}`, topic: "background", route: "answered", sources: [] };
  }

  if (hasAny(words, DEMOS) && !hasAny(words, ["voice", "docdesk", "autopilot", "ops", "support", "document"])) {
    const lines = demos.map((d) => `- ${md(`/demos/${d.slug}`, d.name)} (${statusLabel[d.status].toLowerCase()}): ${firstSentence(d.summary)}`);
    return { text: `Demos you can try:\n${lines.join("\n")}\n\nAll of them are on ${md("/demos")}.`, topic: "demos", route: "answered", sources: [] };
  }

  if (hasAny(words, PROJECTS) && !hasAny(words, SERVICES)) {
    const lines = projects.map((p) => `- ${md(`/work/${p.slug}`, p.title.split(":")[0])}: ${firstSentence(p.summary)}`);
    return { text: `Some of ${FIRST}'s projects:\n${lines.join("\n")}\n\nSee everything in ${md("/work")}.`, topic: "projects", route: "answered", sources: [] };
  }

  if (hasAny(words, SERVICES) || /\bwhat (do|does|can) (you|he|she|azad|they)\b/.test(q) || /\bkya kar(te|ta|ti|tey)\b/.test(q)) {
    const lines = solutions.map((s) => `- **${s.title}**: ${s.hook}`);
    return {
      text: `${FIRST} gets hired for:\n${lines.join("\n")}\n\nDetails in ${md("/solutions")}.`,
      topic: "services",
      route: "answered",
      sources: [],
    };
  }

  if ((hasAny(words, WHO) && count <= 6) || /^(tell me )?about (azad|him|you|yourself)\b/.test(q)) {
    const roles = experience.filter((r) => !r.placeholder && r.company !== "Independent").map((r) => `${r.title} at ${r.company} (${r.period})`);
    const desc = site.description.charAt(0).toLowerCase() + site.description.slice(1);
    return {
      text: `${site.name} is an ${desc}\n\nExperience includes ${joinList(roles)}.\n\nMore in ${md("/about", "About")}, or see the ${md("/work", "work")}.`,
      topic: "background",
      route: "answered",
      sources: [],
    };
  }
  void voice;
  return null;
}

const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();
const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

// ---- main --------------------------------------------------------------------------------------

const MIN_SCORE = 2.2;

function searchAnswer(question: string): OfflineAnswer | null {
  const hits = search(question);
  const top = hits[0];
  // enough signal, and most of the question's words actually found (so "weather today" doesn't match a random section)
  if (!top || top.score < MIN_SCORE || top.coverage < 0.6) return null;
  const it = top.it;
  const link = it.path ? `\n\n${md(it.path, it.kind === "section" ? undefined : it.title.split(":")[0])}` : "";
  const topic: AssistantTopic =
    it.kind === "demo" ? "demos" : it.kind === "project" ? "projects" : it.kind === "solution" ? "services" : it.path?.startsWith("/work") ? "projects" : it.path?.startsWith("/demos") ? "demos" : "other";
  return { text: `**${it.title}**\n\n${excerpt(it.body)}${link}`, topic, route: "answered", sources: [] };
}

/** Answers `question` from the site's content; `previous` = the visitor's earlier message, for short follow-ups. */
export function offlineAnswer(question: string, opts: { previous?: string; voice?: boolean } = {}): OfflineAnswer {
  const q = question.toLowerCase();
  const words = new Set(rawWords(question));
  let ans = intentAnswer(q, words, !!opts.voice) ?? searchAnswer(question);
  // "tell me more" / "and the voice one?" → read it together with the previous question
  if (!ans && opts.previous && terms(question).length <= 3) ans = searchAnswer(`${opts.previous} ${question}`);
  if (!ans)
    ans = {
      text: `I couldn't find that on the site. I can answer questions about ${FIRST}'s services, projects, demos, experience or how to get in touch. Or ask ${FIRST} directly via the ${md("/contact", "contact form")}.`,
      topic: "other",
      route: "off_topic",
      sources: [],
    };
  let text = ans.text;
  if (opts.voice) text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "").replace(/^- /gm, "");
  return { ...ans, text, sources: sourcesIn(ans.text) };
}
