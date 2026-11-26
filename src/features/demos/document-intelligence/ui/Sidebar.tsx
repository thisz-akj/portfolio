"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCDESK_BASE, docdeskNav } from "../nav";

export function Sidebar() {
  const pathname = usePathname();
  const current = (href: string) => (href === DOCDESK_BASE ? pathname === href || pathname.startsWith(`${DOCDESK_BASE}/d/`) : pathname.startsWith(href));
  return (
    <nav className="dd-nav" aria-label="DocDesk">
      {docdeskNav.map((it) => (
        <Link key={it.href} href={it.href} aria-current={current(it.href) ? "page" : undefined}>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
