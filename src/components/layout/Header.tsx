"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { nav, pages, site } from "@/content/site";
import { socialIcons } from "@/components/ui/Icons";
import { SoundToggle } from "./SoundToggle";

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const [active, setActive] = useState<string>("intro");
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    if (open) window.__lenis?.stop();
    else window.__lenis?.start();
  }, [open]);

  // Per-section progress lines (reference: nav-line-fill)
  useEffect(() => {
    if (!isHome) {
      fills.current.forEach((f) => f && (f.style.width = "0%"));
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const docH = document.documentElement.scrollHeight;
      const y = window.scrollY;
      let current = nav[0].section;
      nav.forEach((item, i) => {
        const el = document.getElementById(item.section);
        const fill = fills.current[i];
        if (!el || !fill) return;
        const top = el.getBoundingClientRect().top + y;
        const isLast = i === nav.length - 1;
        const end = isLast ? docH - vh : top + el.offsetHeight - vh * 0.5;
        const start = isLast ? Math.min(top - vh * 0.5, end - 1) : top - vh * 0.5;
        const p = Math.min(1, Math.max(0, (y - start) / Math.max(end - start, 1)));
        fill.style.width = `${p * 100}%`;
        if (y >= start) current = item.section;
      });
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [isHome]);

  const go = (e: React.MouseEvent, section: string) => {
    if (!isHome) return;
    const el = document.getElementById(section);
    if (!el) return;
    e.preventDefault();
    setOpen(false);
    if (window.__lenis) window.__lenis.scrollTo(el, { duration: 1.4 });
    else el.scrollIntoView({ behavior: "smooth" });
    history.replaceState(null, "", section === "intro" ? "/" : `#${section}`);
  };

  return (
    <>
      <header className="site-header">
        <Link href="/" className="logo" aria-label={`${site.name} — home`}>
          {site.name}
        </Link>

        <nav className="site-nav" aria-label="Primary">
          {nav.map((item, i) => (
            <Link
              key={item.section}
              href={item.href}
              className={`nav-link ${isHome && active === item.section ? "active" : ""}`}
              onClick={(e) => go(e, item.section)}
              aria-current={isHome && active === item.section ? "true" : undefined}
            >
              <span className="nav-dot" />
              <span className="nav-label">{item.label}</span>
              <span className="nav-line">
                <span className="nav-line-fill" ref={(el) => { fills.current[i] = el; }} />
              </span>
            </Link>
          ))}
          <span className="nav-icons">
            {site.socials.map((s) => {
              const Icon = socialIcons[s.icon];
              return (
                <a key={s.label} href={s.href} className="nav-icon" aria-label={s.label} target="_blank" rel="noreferrer">
                  <Icon size={15} />
                </a>
              );
            })}
          </span>
          <SoundToggle />
          <Link href="/contact" className="nav-status">
            <span className="pulse-dot" />
            {site.status}
          </Link>
        </nav>

        <SoundToggle className="mobile-only" />
        <button className="menu-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu">
          {open ? <X size={16} /> : <Menu size={16} />} {open ? "Close" : "Menu"}
        </button>
      </header>

      <div id="mobile-menu" className={`mobile-menu ${open ? "open" : ""}`} aria-hidden={!open}>
        <Link href="/" tabIndex={open ? 0 : -1}>Home</Link>
        {pages.map((p) => (
          <Link key={p.href} href={p.href} tabIndex={open ? 0 : -1}>
            {p.label}
          </Link>
        ))}
        <span className="mm-status">
          <span className="pulse-dot" />
          {site.status}
        </span>
      </div>
    </>
  );
}
