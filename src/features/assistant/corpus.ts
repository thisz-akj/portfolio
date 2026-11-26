import { about, expertise, experience, philosophy, site, skills } from "@/content/site";
import { solutions } from "@/content/solutions";
import { demos, statusLabel } from "@/content/demos";
import { projects } from "@/content/projects";
import { clients } from "@/content/clients";
import { assistantLinks } from "./links";

/**
 * The assistant's knowledge, generated from src/content so the chatbot can never drift from the site.
 * `npm run assistant:corpus` writes it to assistant/corpus/site.json for the Python service;
 * a test fails when that file is stale.
 */

export const CORPUS_PATH = "assistant/corpus/site.json";

const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n");

export function knowledgeMarkdown(): string {
  const parts: string[] = [];

  parts.push(
    `# ${site.name}`,
    `Role: ${site.role}. Status: ${site.status}. Location shown on the site: ${site.location.city}.`,
    `Tagline: ${site.tagline}`,
    site.description,
    `Contact: email ${site.email}, phone ${site.phone.display}, or the form at /contact.`,
    `Profiles: ${site.socials.map((s) => `${s.label} ${s.href}`).join(", ")}.`,
    `## About (source: /about)`,
    about.text,
    `Pull quote: "${about.pullquote}"`,
    `Philosophy: ${philosophy}`,
    `## Expertise`,
    expertise.map((e) => `### ${e.title}\n${list(e.items)}`).join("\n"),
    `## Skills`,
    skills.map((s) => `- ${s.title}: ${s.items.join(", ")}`).join("\n"),
    `## Experience`,
    list(experience.filter((r) => !r.placeholder).map((r) => `${r.title}, ${r.company} (${r.period})`)),
    `## Clients and organisations worked with`,
    list(clients.filter((c) => !c.placeholder).map((c) => (c.sub ? `${c.name} — ${c.sub}` : c.name))),
  );

  parts.push(`## Solutions — things Azad gets hired for (source: /solutions)`);
  for (const s of solutions) {
    parts.push(
      `### ${s.title}`,
      `Hook: ${s.hook}`,
      `Problem: ${s.problem}`,
      `Capabilities:\n${list(s.capabilities)}`,
      `Typical customers: ${s.customers.join(", ")}`,
      `How it's used:\n${list(s.industries.map((x) => `${x.name}: ${x.use}`))}`,
      `Why it's different:\n${list(s.usp)}`,
      `In Azad's words: ${s.story}`,
      `Example walkthrough (illustrative sample, not a client case): input "${s.showcase.input}" → ${s.showcase.steps
        .map((st) => `${st.label}: ${st.detail}`)
        .join("; ")} → ${s.showcase.outputLabel}: ${s.showcase.output}`,
      s.demoSlug ? `Related demo: /demos/${s.demoSlug}` : "",
    );
    const a = s.article;
    if (a)
      parts.push(
        `### ${s.title}: what it connects to`,
        list(a.connections.map((c) => `${c.name} (${c.examples}): ${c.does.join("; ")}`)),
        `### ${s.title}: example journey (illustrative)`,
        `${a.journey.intro} ${a.journey.steps.map((st) => `${st.via}: ${st.text}`).join(" ")} ${a.journey.outcome}`,
        `### ${s.title}: what gets better`,
        list(a.better.map((b) => `${b.area}: before ${b.before}; after ${b.after}`)),
        `### ${s.title}: why work with Azad`,
        list(a.usp.map((u) => `${u.title}: ${u.text}`)),
        `### ${s.title}: industries`,
        list(a.industries.map((x) => `${x.name}: ${x.examples.join("; ")}`)),
        `### ${s.title}: services Azad offers`,
        list(a.services.map((x) => `${x.name}: ${x.text} You get: ${x.get.join("; ")}`)),
        `### ${s.title}: how an engagement works`,
        list(a.process.map((x) => `${x.step}: ${x.text}`)),
        `### ${s.title}: FAQ`,
        list(a.faq.map((f) => `${f.q} ${f.a}`)),
      );
  }

  parts.push(`## Demos (source: /demos)`);
  for (const d of demos) {
    parts.push(
      `### ${d.name} — /demos/${d.slug}`,
      `Status: ${statusLabel[d.status]}.`,
      d.summary,
      `Problem: ${d.problem}`,
      `Limitations: ${d.limitations.join("; ")}`,
    );
  }

  parts.push(`## Projects / case studies (source: /work)`);
  for (const p of projects) {
    parts.push(
      `### ${p.title} — /work/${p.slug}`,
      `Client/context: ${p.client} · Year: ${p.year} · Tags: ${p.tags.join(", ")}`,
      p.summary,
      `Problem: ${p.problem}`,
      `Azad's contribution: ${p.contribution}`,
      `Results:\n${list(p.results.map((r) => `${r.label}: ${r.value}`))}`,
      `Lessons:\n${list(p.lessons)}`,
      p.repo ? `Repository: ${p.repo}` : "",
      p.demoUrl ? `Demo: ${p.demoUrl}` : "",
    );
  }

  return parts.filter(Boolean).join("\n\n");
}

export function corpusJson(): string {
  return JSON.stringify({ name: site.name, links: assistantLinks(), knowledge: knowledgeMarkdown() }, null, 2) + "\n";
}
