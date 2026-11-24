import Link from "next/link";
import { Kanban, Table2 } from "lucide-react";
import { PORTAL_BASE } from "../../nav";

/** Table ⇄ Board switch that keeps the current search and filters. Server component. */
export function ViewToggle({ entity, current, search }: { entity: string; current: "table" | "board"; search: string }) {
  const qs = search ? `?${search}` : "";
  return (
    <nav className="ops-seg ops-viewtoggle" aria-label="View">
      <Link href={`${PORTAL_BASE}/${entity}${qs}`} aria-current={current === "table" ? "page" : undefined}>
        <Table2 size={14} /> Table
      </Link>
      <Link href={`${PORTAL_BASE}/${entity}/board${qs}`} aria-current={current === "board" ? "page" : undefined}>
        <Kanban size={14} /> Board
      </Link>
    </nav>
  );
}
