import { techStack } from "@/content/techStack";
import { brandIcon } from "@/lib/brandIcons";

// One cacheable sprite for the About "Tech I use" row. Inlining ~100 paths put ~120 KB into the
// home page HTML twice (markup + React payload); <use href="/tech-icons.svg#slug"> keeps it out.
export const dynamic = "force-static";

export function GET() {
  const slugs = [...new Set(techStack.flatMap((g) => g.items.map((t) => t.icon)))];
  const symbols = slugs
    .map((slug) => {
      const si = brandIcon(slug);
      return si ? `<symbol id="${slug}" viewBox="0 0 24 24"><path d="${si.path}" fill="currentColor"/></symbol>` : "";
    })
    .join("");
  return new Response(`<svg xmlns="http://www.w3.org/2000/svg">${symbols}</svg>`, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}
