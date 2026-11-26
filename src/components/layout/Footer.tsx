import Link from "next/link";
import { pages, site } from "@/content/site";
import { BarrelLink } from "./BarrelLink";
import { FooterSignature } from "./FooterSignature";

const year = new Date().getFullYear();


export function Footer() {
  return (
    <footer className="site-footer">
      {/* Soft glow rising from the bottom in the hero film's colours (amber · teal), always drifting. */}
      <div className="footer-glow" aria-hidden="true">
        <span className="fg fg-amber" />
        <span className="fg fg-teal" />
        <span className="fg fg-gold" />
        <span className="fg fg-deep" />
        <span className="fg fg-corner-l" />
        <span className="fg fg-corner-r" />
        {/* Ocean-like swells: blurred wave bands flowing sideways at different speeds */}
        <span className="fw fw-1" />
        <span className="fw fw-2" />
        <span className="fw fw-3" />
      </div>
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
      <FooterSignature name={site.name} />
      <div className="footer-bottom">
        <span>
          © {year} {site.name}
        </span>
        <span className="fb-mid">{site.location.city} · Demos label their status honestly</span>
        <a href="#" className="fb-top">
          Back to top ↑
        </a>
      </div>
    </footer>
  );
}
