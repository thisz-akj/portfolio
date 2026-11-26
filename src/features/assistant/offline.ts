/**
 * Quick answers for the site chat with no AI model: used when the assistant service isn't reachable
 * (e.g. not hosted yet). Rules + keyword search over the site's own content (src/content via the corpus
 * builder), so answers can't be invented or drift from the site. 0 tokens; never counts as a free question.
 *
 * Order of decisions for one question:
 * 1. Normalise (contractions, chat shorthand "u/ur", Hinglish fillers) and fix small typos against the
 *    vocabulary the matcher knows ("servises" → services).
 * 2. "Always" intents: greeting, thanks, how-is-it-built (confidential), pricing, contact/hiring, location,
 *    process, timeline, ownership/languages (FAQ). These win even if the question names a topic.
 * 3. Follow-ups ("tell me more") → the previous question again, with a longer excerpt.
 * 4. If the question names a topic (e.g. "computer vision projects", "voice demo") → search the site:
 *    solutions, projects, demos, FAQs and every knowledge section (TF-IDF, stemming, synonyms).
 * 5. Otherwise "list" intents: services, projects, demos, clients, experience, skills, industries, about.
 * 6. Nothing but "Azad/you" left ("what azad does", "azad?") → an overview. Truly unknown → say so.
 * Links are only ever pages from assistantLinks(), the chat's allow-list.
 */

import { experience, site, skills } from "@/content/site";
import { solutions } from "@/content/solutions";
import { demos, statusLabel } from "@/content/demos";
import { projects } from "@/content/projects";
import { clients } from "@/content/clients";
import { automationArticle } from "@/content/automation";
import { knowledgeMarkdown } from "./corpus";
import { assistantLinks, type AssistantLink } from "./links";
import type { AssistantRoute, AssistantTopic } from "./protocol";

export interface OfflineAnswer {
  text: string;
  topic: AssistantTopic;
  route: AssistantRoute;
  sources: AssistantLink[];
  /** Which rule answered (for tests and the support demo's inspector). */
  intent: string;
}

const FIRST = site.name.split(" ")[0]; // "Azad"

// ---- normalising -------------------------------------------------------------------------------

const EXPAND: [RegExp, string][] = [
  [/[’`]/g, "'"],
  [/\bwhat's\b/g, "what is"], [/\bwho's\b/g, "who is"], [/\bwhere's\b/g, "where is"], [/\bhow's\b/g, "how is"],
  [/\b(he|she|it|that)'s\b/g, "$1 is"], [/\b(i|you|we|they)'re\b/g, "$1 are"], [/\b(i|you|we|they)'ve\b/g, "$1 have"],
  [/\b(do|does|did|is|are|can|could|would|wo|ca)n't\b/g, "$1 not"], [/\bi'm\b/g, "i am"],
  [/\bu\b/g, "you"], [/\bur\b/g, "your"], [/\br\b/g, "are"], [/\bpls\b|\bplz\b/g, "please"], [/\bthx\b|\bty\b/g, "thanks"],
  [/\bwanna\b/g, "want to"], [/\bgonna\b/g, "going to"],
  [/'s\b/g, ""],
];

function normalise(text: string) {
  let s = text.toLowerCase();
  for (const [re, to] of EXPAND) s = s.replace(re, to);
  return s.replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();
}

/** Words that never carry a topic. Azad's own name is here: "what azad does" has no topic, it's about Azad. */
const STOP = new Set(
  (
    "a an the and or of to in on for with is are was were be been being it its this that these those what which who whom whose " +
    "how why when do does did doing done can could would should will shall may might must you your yours he she they them his her hers " +
    "their him about me my i we our us tell show give any some there have has had from at by as if into more most please just also so " +
    "than then very really much many get got know like want need let lets am not no yes ok okay hey well ever here " +
    "today now time day week new best good thing things stuff something someone one ones part bit kind sort build builds make makes create develop use using work works working worked " +
    "azad kumar jha sir mam bro bhai dude " +
    // Hinglish fillers
    "kya kaun kaise kab kahan kaha hai hain ho hu tha thi the karte karta karti karo kar batao bataiye bata mujhe aap aapka aapke apna apne ke ki ka ko se par mein me bhi aur ya hum humko yeh ye woh wo"
  ).split(" "),
);

/** Visitor words → words the site uses. Applied before and after stemming. */
const SYNONYMS: Record<string, string> = {
  chatbot: "support", bot: "support", helpdesk: "support", ticket: "support", copilot: "support",
  pdf: "document", invoice: "document", contract: "document", ocr: "document", paperwork: "document", kyc: "document",
  phone: "voice", call: "voice", receptionist: "voice", ivr: "voice", telecall: "voice", speech: "voice",
  dashboard: "analytics", sql: "analytics", report: "analytics", reporting: "analytics", bi: "analytics", insight: "analytics",
  robot: "robotics", amr: "robotics", autonomous: "robotics", drone: "robotics", agv: "robotics",
  cv: "vision", camera: "vision", image: "vision", video: "vision", detection: "vision", perception: "vision", yolo: "vision",
  crm: "ops", erp: "ops", inventory: "ops", order: "ops",
  eval: "evaluation", evals: "evaluation", testing: "evaluation", monitoring: "evaluation", accuracy: "evaluation",
  workflow: "automation", automate: "automation", automating: "automation", automated: "automation", rpa: "automation",
  zapier: "automation", n8n: "automation", integration: "automation", agent: "automation", agentic: "automation",
  kaam: "work",
};

function stem(w: string) {
  for (const suf of ["ations", "ation", "ating", "ated", "ates", "ate", "ings", "ing", "ers", "ies", "ed", "es", "s"]) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) return suf === "ies" ? `${w.slice(0, -3)}y` : w.slice(0, -suf.length);
  }
  return w;
}
const canon = (w: string) => stem(SYNONYMS[w] ?? SYNONYMS[stem(w)] ?? w);

// ---- typo tolerance ----------------------------------------------------------------------------

function editDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let prev2 = prev;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // adjacent swap ("contcat") counts as one edit
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

let vocab: Set<string> | null = null;
/** Fixes a misspelt word to the closest known word (intent keys + site vocabulary), if close enough. */
function fixTypo(w: string): string {
  if (w.length < 5 || STOP.has(w) || /\d/.test(w)) return w;
  vocab ??= new Set([...INTENT_KEYS, ...index().rawVocab]);
  if (vocab.has(w)) return w;
  const max = w.length >= 8 ? 2 : 1;
  let best = w;
  let bestD = max + 1;
  for (const v of vocab) {
    if (Math.abs(v.length - w.length) > max || v[0] !== w[0]) continue;
    const d = editDistance(w, v, max);
    if (d < bestD) [best, bestD] = [v, d];
  }
  return best;
}

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

// ---- search index: solutions, projects, demos, FAQs and the site's knowledge sections ----------

interface Item {
  kind: "solution" | "project" | "demo" | "faq" | "section";
  title: string;
  body: string;
  path?: string;
  terms: Set<string>;
  titleTerms: Set<string>;
}

const toTerms = (text: string) =>
  normalise(text)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(canon);

let cache: { items: Item[]; df: Map<string, number>; rawVocab: Set<string> } | null = null;

function index() {
  if (cache) return cache;
  const items: Item[] = [];
  const rawVocab = new Set<string>();
  /** `extra` is searchable but not shown (tags, customer lists). */
  const add = (kind: Item["kind"], title: string, body: string, path?: string, extra = "") => {
    const all = `${title} ${body} ${extra}`;
    for (const w of normalise(all).split(" ")) if (w.length >= 5) rawVocab.add(w);
    items.push({ kind, title, body, path, terms: new Set(toTerms(all)), titleTerms: new Set(toTerms(title)) });
  };

  for (const s of solutions)
    add("solution", s.title, `${s.hook} ${s.problem}\nWhat it covers: ${s.capabilities.join(", ")}.`, "/solutions", s.customers.join(" "));
  for (const p of projects) add("project", p.title, p.summary, `/work/${p.slug}`, `${p.tags.join(" ")} ${p.client}`);
  for (const d of demos) add("demo", d.name, d.summary, `/demos/${d.slug}`, d.problem ?? "");
  for (const s of solutions) for (const f of s.article?.faq ?? []) add("faq", f.q, f.a, "/solutions");
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
  cache = { items, df, rawVocab };
  return cache;
}

function search(terms: string[]) {
  const { items, df } = index();
  const q = [...new Set(terms)];
  if (!q.length) return [];
  const n = items.length;
  return items
    .map((it) => {
      let score = 0;
      for (const t of q) if (it.terms.has(t)) score += Math.log(1 + n / (df.get(t) ?? 1)) * (it.titleTerms.has(t) ? 3 : 1);
      if (it.kind !== "section") score *= 1.25; // a named thing beats a long section mentioning the same words
      const coverage = q.filter((t) => it.terms.has(t)).length / q.length;
      return { it, score, coverage };
    })
    .filter((r) => r.score > 0)
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

// ---- answers built from content ----------------------------------------------------------------

const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();
const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const contactLine = () => `You can reach ${FIRST} at ${site.email} or ${site.phone.display}, or through the ${md("/contact", "contact form")}.`;
const roles = () => experience.filter((r) => !r.placeholder && r.company !== "Independent");
const solutionList = () => solutions.map((s) => `- **${s.title}**: ${s.hook}`).join("\n");
const faq = (needle: RegExp) => automationArticle.faq.find((f) => needle.test(f.q));

type Reply = Omit<OfflineAnswer, "sources" | "intent">;
const say = (text: string, topic: AssistantTopic, route: AssistantRoute = "answered"): Reply => ({ text, topic, route });

const A = {
  greeting: () =>
    say(`Hi! I can tell you about ${FIRST}'s work: what ${FIRST} builds, projects, demos you can try, experience, or how to get in touch. What would you like to know?`, "other"),
  thanks: () => say(`You're welcome! If you'd like to talk about a project, ${lowerFirst(contactLine())}`, "contact", "handoff"),
  confidential: () =>
    say(
      `${FIRST} keeps the details of how each system is built private, since that's the craft clients pay for. Happy to walk through what it does and the results on a call. ${contactLine()}`,
      "other",
      "handoff",
    ),
  pricing: () => {
    const run = faq(/cost/i);
    return say(
      `Pricing isn't listed on the site: it depends on the scope, so the quickest way is to describe what you need.${run ? ` On running costs: ${lowerFirst(run.a)}` : ""}\n\n${contactLine()}`,
      "pricing",
      "handoff",
    );
  },
  contact: () => say(`${FIRST} is ${site.status.toLowerCase()}. ${contactLine()}`, "contact", "handoff"),
  hiring: () =>
    say(`${FIRST} is ${site.status.toLowerCase()}: independent projects and part-time engineering collaborations. ${contactLine()}`, "contact", "handoff"),
  location: () => say(`${FIRST} is based in ${site.location.city} and works with clients remotely. ${contactLine()}`, "background"),
  profiles: () => say(`${FIRST} is on ${site.socials.map((s) => `${s.label} (${s.href})`).join(" and ")}. ${contactLine()}`, "contact", "handoff"),
  process: () => {
    const steps = automationArticle.process.map((p, i) => `${i + 1}. **${p.step}**: ${p.text}`).join("\n");
    return say(`How a project with ${FIRST} usually runs:\n${steps}\n\nMore in ${md("/solutions")}.`, "services");
  },
  timeline: () => {
    const f = faq(/how soon/i);
    return say(`${f ? f.a : "It starts with one workflow, so you see it working early."} Exact timelines depend on the scope. ${contactLine()}`, "services");
  },
  ownership: () => {
    const f = faq(/owns/i);
    return say(f ? f.a : `You do. ${contactLine()}`, "services");
  },
  robotic: () => {
    const f = faq(/robot/i);
    return say(f ? f.a : `It follows your tone. ${contactLine()}`, "services");
  },
  languages: () => {
    // the FAQ answers "Will it sound like a robot?" with "No. …" — for a language question that "No" is wrong
    const f = faq(/robot/i);
    return say(f ? `Yes. ${f.a.replace(/^No\.\s*/, "")}` : `Replies can follow the customer's language. ${contactLine()}`, "services");
  },
  education: () =>
    say(
      `The site doesn't list education details. Experience includes ${joinList(roles().map((r) => `${r.title} at ${r.company} (${r.period})`))}. For the full background, see ${FIRST}'s LinkedIn (${site.socials.find((s) => s.icon === "linkedin")?.href ?? ""}) or ${lowerFirst(contactLine())}`,
      "background",
    ),
  services: () => say(`${FIRST} gets hired for:\n${solutionList()}\n\nDetails in ${md("/solutions")}.`, "services"),
  projects: () => {
    const lines = projects.map((p) => `- ${md(`/work/${p.slug}`, p.title.split(":")[0])}: ${firstSentence(p.summary)}`);
    return say(`Some of ${FIRST}'s projects:\n${lines.join("\n")}\n\nSee everything in ${md("/work")}.`, "projects");
  },
  demos: () => {
    const lines = demos.map((d) => `- ${md(`/demos/${d.slug}`, d.name)} (${statusLabel[d.status].toLowerCase()}): ${firstSentence(d.summary)}`);
    return say(`Demos you can try:\n${lines.join("\n")}\n\nAll of them are on ${md("/demos")}.`, "demos");
  },
  clients: () => {
    const list = clients
      .filter((c) => !c.placeholder)
      .map((c) => (c.sub && !c.name.toLowerCase().includes(c.sub.toLowerCase()) && !/limited/i.test(c.sub) ? `${c.name} (${c.sub})` : c.name));
    return say(`${FIRST} has worked with ${joinList(list)}. More in ${md("/work")}.`, "background");
  },
  experience: () => {
    const lines = experience.filter((r) => !r.placeholder).map((r) => `- **${r.title}**, ${r.company} (${r.period})`);
    return say(`${FIRST}'s experience:\n${lines.join("\n")}\n\nMore in ${md("/about", "About")}.`, "background");
  },
  skills: () => say(`What ${FIRST} works on:\n${skills.map((s) => `- **${s.title}:** ${s.items.join(", ")}`).join("\n")}`, "background"),
  industries: () => {
    const sectors = skills.filter((s) => /sector/i.test(s.title)).map((s) => `- **${s.title}:** ${s.items.join(", ")}`);
    return say(`Sectors ${FIRST} works with:\n${sectors.join("\n")}\n\nIndustry examples are in ${md("/solutions")}.`, "background");
  },
  about: () => {
    const desc = lowerFirst(site.description);
    return say(
      `${site.name} is an ${desc}\n\nExperience includes ${joinList(roles().map((r) => `${r.title} at ${r.company} (${r.period})`))}.\n\nMore in ${md("/about", "About")}, or see the ${md("/work", "work")}.`,
      "background",
    );
  },
  overview: () =>
    say(
      `${site.name} is an ${lowerFirst(site.description)}\n\n${FIRST} gets hired for:\n${solutionList()}\n\nAsk about any of these, the ${md("/work", "projects")} or the ${md("/demos", "demos")}.`,
      "services",
    ),
  unknown: () =>
    say(
      `I couldn't find that on the site. I can answer questions about ${FIRST}'s services, projects, demos, experience or how to get in touch. Or ask ${FIRST} directly via the ${md("/contact", "contact form")}.`,
      "other",
      "off_topic",
    ),
};

// ---- intents -----------------------------------------------------------------------------------

interface Intent {
  id: keyof typeof A;
  /** single words (typo-tolerant); one hit is enough */
  keys?: string[];
  /** phrases on the normalised question */
  re?: RegExp;
  /** only when the question is short (greetings, thanks) */
  maxWords?: number;
}

/** Win even when the question also names a topic. Order = priority. */
const ALWAYS: Intent[] = [
  { id: "greeting", keys: ["hi", "hello", "hey", "hii", "hiii", "helo", "namaste", "namaskar", "hola", "yo", "sup", "morning", "evening", "afternoon", "greetings"], maxWords: 4 },
  { id: "thanks", keys: ["thanks", "thank", "thankyou", "shukriya", "dhanyavad", "dhanyawad", "great", "awesome", "cool", "nice", "bye", "goodbye", "cheers", "perfect"], maxWords: 4 },
  {
    id: "confidential",
    keys: ["llm", "llms", "gpt", "chatgpt", "openai", "groq", "gemini", "claude", "llama", "mistral", "architecture", "stack", "framework", "frameworks", "prompt", "prompts", "langchain", "backend", "hosting", "hosted", "database", "python", "react", "nextjs", "fastapi", "tensorflow", "pytorch"],
    re: /\b(which|what) (ai )?(model|models|tech|technology|technologies|tools?)\b|\bhow (is|are|was|were|did you|do you) (it|this|they|these|the \w+) (built|made|implemented|coded|powered)\b|\bhow (is|was) (it|this) (built|made|done)\b|\bwhat powers\b|\bsource code\b|\bunder the hood\b/,
  },
  {
    id: "pricing",
    keys: ["price", "prices", "pricing", "cost", "costs", "rate", "rates", "budget", "charge", "charges", "fee", "fees", "quote", "quotation", "expensive", "cheap", "affordable", "paisa", "paise", "kitna", "kitne", "hourly", "invest", "investment", "package", "packages"],
    re: /\bhow much\b/,
  },
  { id: "process", keys: ["process", "approach", "methodology", "engagement", "onboarding", "steps"], re: /\bhow (do|does) (you|he|azad|it|a project|the project|an engagement) (work|start|go|run)\b|\bwhat happens (after|next|first)\b|\bkaise kaam\b/ },
  { id: "timeline", keys: ["timeline", "deadline", "duration", "turnaround", "fast", "quickly", "soon", "weeks", "months"], re: /\bhow (long|soon|quickly|fast)\b/ },
  { id: "ownership", re: /\bwho owns\b|\b(own|ownership of) (it|the code|the system|the data)\b/ },
  { id: "robotic", re: /\b(sound|sounds|feel|feels) (like a )?robot(ic)?\b|\brobotic (replies|reply|voice)\b/ },
  { id: "languages", keys: ["hindi", "hinglish", "tamil", "telugu", "kannada", "marathi", "bengali", "multilingual", "language", "languages"] },
  { id: "education", keys: ["education", "degree", "college", "university", "studied", "study", "graduate", "graduated", "qualification", "qualifications", "btech", "mtech", "cgpa", "gpa"] },
  { id: "profiles", keys: ["github", "linkedin", "socials", "social", "twitter", "instagram"] },
  {
    id: "hiring",
    keys: ["hire", "hiring", "fulltime", "freelance", "freelancer", "freelancing", "job", "jobs", "role", "roles", "position", "opening", "vacancy", "employment", "contract", "contractor", "collaborate", "collaboration", "partner", "partnership"],
    re: /\b(full time|part time|open to|work with you|work together|join (our|my) team|available for)\b/,
  },
  {
    id: "contact",
    keys: ["contact", "email", "mail", "reach", "available", "availability", "book", "booking", "meeting", "meet", "touch", "number", "connect", "sampark", "schedule"],
    re: /\b(get in touch|talk to|speak (to|with)|call (you|him|azad)|phone number|how (do|can) i (reach|contact)|whatsapp (number|no|him|you|azad|me))\b/,
  },
  { id: "location", keys: ["where", "location", "located", "based", "city", "country", "timezone", "remote", "remotely", "kahan", "kaha", "onsite", "relocate"] },
];

/** Only when nothing else in the question names a topic ("show me your projects", not "vision projects"). */
const LIST: Intent[] = [
  { id: "services", keys: ["services", "service", "offer", "offering", "offerings", "solutions", "solution", "help", "specialise", "specialize", "specialty", "speciality", "expertise", "provide", "capabilities", "areas"], re: /\bwhat (do|does|can) (you|he|she|azad|they)\b|\bwhat (you|he|azad) (do|does|offer|offers)\b|\bwhat (is|are) (your|his|azad) (work|business|job)\b|\bkya kar(te|ta|ti|tey)\b|\bkya kaam\b/ },
  { id: "projects", keys: ["projects", "project", "portfolio", "case", "studies", "examples", "previous", "past", "shipped", "built"] },
  { id: "demos", keys: ["demo", "demos", "try", "playground", "live", "interactive"] },
  { id: "clients", keys: ["clients", "client", "companies", "company", "customers", "organisations", "organizations", "brands", "worked"] },
  { id: "experience", keys: ["experience", "background", "career", "resume", "history", "intern", "internship", "years", "senior", "worked", "previous"] },
  { id: "skills", keys: ["skills", "skill", "tech", "technologies", "technology", "tools", "strengths", "strength", "good"] },
  { id: "industries", keys: ["industries", "industry", "sectors", "sector", "domains", "domain", "verticals", "niches"] },
  { id: "about", keys: ["yourself", "introduce", "introduction", "kaun", "bio", "profile"], re: /\babout (azad|him|you|yourself)\b|\bwho (is|are) (azad|he|you|this)\b|^who$/ },
];

const INTENT_KEYS = new Set([...ALWAYS, ...LIST].flatMap((i) => i.keys ?? []));

function matches(intent: Intent, words: string[], q: string) {
  if (intent.maxWords && words.length > intent.maxWords) return false;
  return (intent.re?.test(q) ?? false) || (intent.keys?.some((k) => words.includes(k)) ?? false);
}

const FOLLOW_UP = /^(and )?(tell me )?(more|elaborate|explain|details|detail|continue|go on|what else|anything else|aur batao|aur|then|and)( please| about (it|that|this))?$/;

// ---- main --------------------------------------------------------------------------------------

function topicFor(it: Item): AssistantTopic {
  if (it.kind === "demo" || it.path?.startsWith("/demos")) return "demos";
  if (it.kind === "project" || it.path?.startsWith("/work")) return "projects";
  if (it.kind === "solution" || it.kind === "faq") return "services";
  return "other";
}

function fromSearch(terms: string[], long = false): Reply | null {
  // best match among those that contain most of the question's words (so "weather today" doesn't match a
  // random section, and a title hit on one word can't beat a passage that has all of them)
  const top = search(terms).find((r) => r.coverage >= 0.6);
  if (!top || top.score < 2.2) return null;
  const it = top.it;
  const link = it.path ? `\n\n${md(it.path, it.kind === "section" || it.kind === "faq" ? undefined : it.title.split(":")[0])}` : "";
  const title = it.kind === "faq" ? `**${it.title}**` : `**${it.title}**`;
  return say(`${title}\n\n${excerpt(it.body, long ? 900 : 420)}${link}`, topicFor(it));
}

/** Answers `question` from the site's content; `previous` = the visitor's earlier message, for follow-ups. */
export function offlineAnswer(question: string, opts: { previous?: string; voice?: boolean } = {}): OfflineAnswer {
  const q0 = normalise(question);
  const fixed = q0.split(" ").map(fixTypo);
  const q = fixed.join(" ");
  const topicTerms = fixed.filter((w) => w.length > 1 && !STOP.has(w) && !INTENT_KEYS.has(w)).map(canon);

  let intent = "";
  let reply: Reply | null = null;
  const pick = (id: string, r: Reply | null) => {
    if (r && !reply) [intent, reply] = [id, r];
  };

  // 1. always-intents
  for (const it of ALWAYS) if (matches(it, fixed, q)) pick(it.id, A[it.id]());
  // 2. follow-ups
  if (!reply && FOLLOW_UP.test(q))
    pick("follow-up", opts.previous ? offlineAnswerInner(opts.previous, true) : A.overview());
  // 3. a named topic → search
  if (!reply && topicTerms.length) pick("search", fromSearch(topicTerms));
  // 4. list intents (also when the topic search found nothing)
  if (!reply) for (const it of LIST) if (matches(it, fixed, q)) pick(it.id, A[it.id]());
  // 5. just about Azad → overview; short follow-up words → previous question; else honest "not found"
  if (!reply && !topicTerms.length) pick("overview", A.overview());
  if (!reply && opts.previous && topicTerms.length <= 3) pick("search+previous", fromSearch([...topicTerms, ...toTerms(opts.previous)]));
  if (!reply) pick("unknown", A.unknown());

  const r = reply!;
  let text = r.text;
  if (opts.voice) text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "").replace(/^(- |\d+\. )/gm, "");
  return { ...r, text, sources: sourcesIn(r.text), intent };
}

/** For follow-ups: re-answer the previous question by search, with a longer excerpt. */
function offlineAnswerInner(previous: string, long: boolean): Reply | null {
  const terms = normalise(previous)
    .split(" ")
    .map(fixTypo)
    .filter((w) => w.length > 1 && !STOP.has(w) && !INTENT_KEYS.has(w))
    .map(canon);
  return (terms.length ? fromSearch(terms, long) : null) ?? A.overview();
}
