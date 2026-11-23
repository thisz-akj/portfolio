import Link from "next/link";
import { pages, site } from "@/content/site";
import { BarrelLink } from "./BarrelLink";
import { FooterName } from "./FooterName";

const year = new Date().getFullYear();
const legal = [`©${year} ${site.name}. All rights reserved.`, "Built with Next.js. Demos label their status honestly."];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-links-row">
        <div className="footer-links-left">
          <span className="footer-links-eyebrow">Have a problem worth automating?</span>
          <a className="footer-links-email" href={`mailto:${site.email}`}>
            {site.email}
          </a>
          <a className="footer-links-phone" href={`tel:${site.phone.tel}`}>
            {site.phone.display}
          </a>
        </div>
        <div className="footer-links-buttons">
          <BarrelLink href="/contact" label="Start a project" />
          {site.socials.map((s) => (
            <BarrelLink key={s.label} href={s.href} label={s.label} external />
          ))}
        </div>
      </div>
      <nav className="footer-sitemap" aria-label="Footer">
        <Link href="/">Home</Link>
        {pages.map((p) => (
          <Link key={p.href} href={p.href}>
            {p.label}
          </Link>
        ))}
      </nav>
      <div className="footer-name-wrap">
        <FooterName name={site.name} legal={legal} />
      </div>
    </footer>
  );
}
