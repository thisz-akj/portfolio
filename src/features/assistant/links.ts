import { demos } from "@/content/demos";
import { projects } from "@/content/projects";

export interface AssistantLink {
  path: string;
  label: string;
}

/** Every page the assistant may link to. The UI renders only these as links. */
export function assistantLinks(): AssistantLink[] {
  return [
    { path: "/", label: "Home" },
    { path: "/solutions", label: "Solutions" },
    { path: "/demos", label: "Demos" },
    { path: "/work", label: "Work" },
    { path: "/about", label: "About" },
    { path: "/contact", label: "Contact" },
    ...demos.map((d) => ({ path: `/demos/${d.slug}`, label: `Demo: ${d.name}` })),
    ...projects.map((p) => ({ path: `/work/${p.slug}`, label: p.title.split(":")[0] })),
    { path: "/demos/ops-suite/app", label: "Open Ops Suite" },
  ];
}
