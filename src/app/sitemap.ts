import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { demos } from "@/content/demos";
import { projects } from "@/content/projects";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url.replace(/\/$/, "");
  const routes = ["", "/solutions", "/demos", "/work", "/about", "/contact"];
  return [
    ...routes.map((r) => ({ url: `${base}${r}`, lastModified: new Date() })),
    ...demos.map((d) => ({ url: `${base}/demos/${d.slug}`, lastModified: new Date() })),
    ...projects.map((p) => ({ url: `${base}/work/${p.slug}`, lastModified: new Date() })),
  ];
}
