"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { portalNav } from "../nav";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="ops-nav" aria-label="Ops Suite">
      {portalNav.map((group) => (
        <div key={group.label} className="ops-nav-group">
          <p className="ops-nav-label">{group.label}</p>
          <ul>
            {group.items.map((it) =>
              it.ready ? (
                <li key={it.href}>
                  <Link href={it.href} className="ops-nav-link" aria-current={pathname === it.href ? "page" : undefined}>
                    {it.label}
                  </Link>
                </li>
              ) : (
                <li key={it.href}>
                  <span className="ops-nav-link is-soon" aria-disabled="true">
                    {it.label}
                    <em>soon</em>
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      ))}
    </nav>
  );
}
