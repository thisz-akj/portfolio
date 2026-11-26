/**
 * Build-time snapshot of the sample data (docintel/scripts/snapshot.py → snapshot.json + public/demos/docdesk/*.webp).
 * Served by the API proxy only when the DocDesk service is unreachable. Server-only.
 */

type Snapshot = Record<string, unknown>;
let snap: Snapshot | null = null;

async function load(): Promise<Snapshot> {
  if (!snap) {
    try {
      snap = (await import("./snapshot.json")).default as Snapshot;
    } catch {
      snap = {};
    }
  }
  return snap;
}

/** undefined = not available offline; a Response = redirect (page images). */
export async function snapshotLookup(path: string, params: URLSearchParams): Promise<unknown | Response | undefined> {
  const s = await load();
  const page = /^documents\/([A-Za-z0-9_-]+)\/pages\/(\d+)$/.exec(path);
  if (page) {
    if (!(`documents/${page[1]}` in s)) return undefined;
    return new Response(null, { status: 307, headers: { location: `/demos/docdesk/${page[1]}-${page[2]}.webp` } });
  }
  if (path === "compare") return s[`compare?a=${params.get("a")}&b=${params.get("b")}`];
  const ask = /^documents\/([A-Za-z0-9_-]+)\/ask$/.exec(path);
  if (ask) return s[`documents/${ask[1]}/ask#${params.get("example")}`];
  return s[path];
}
