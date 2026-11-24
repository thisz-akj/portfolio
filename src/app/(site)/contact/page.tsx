import type { Metadata } from "next";
import { site } from "@/content/site";
import { ContactForm } from "@/components/shared/ContactForm";
import { socialIcons } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to me about an AI project, a product feature or a part-time engineering collaboration.",
};

export default function ContactPage() {
  return (
    <section className="inner">
      <div className="contact-grid">
        <div>
          <p className="eyebrow">Contact</p>
          <h1 className="inner-title">Let&apos;s build the thing.</h1>
          <p className="lede" style={{ marginBottom: "2.5rem" }}>
            Founders and product teams: tell me what you&apos;re building and where AI should fit. I take on a small number of
            projects and part-time collaborations at a time.
          </p>
          <p className="aside-label">Email</p>
          <a className="footer-links-email" href={`mailto:${site.email}`} style={{ color: "var(--white)" }}>
            {site.email}
          </a>
          <p className="aside-label" style={{ marginTop: "1.8rem" }}>Phone</p>
          <a className="footer-links-email" href={`tel:${site.phone.tel}`} style={{ color: "var(--white)" }}>
            {site.phone.display}
          </a>
          <div className="chips" style={{ marginTop: "2.5rem" }}>
            {site.socials.map((s) => {
              const Icon = socialIcons[s.icon];
              return (
                <a key={s.label} href={s.href} className="btn-ghost" target="_blank" rel="noreferrer">
                  <Icon size={14} /> {s.label}
                </a>
              );
            })}
          </div>
          <p className="nav-status" style={{ display: "inline-block", marginTop: "2.5rem" }}>
            <span className="pulse-dot" />
            {site.status}
          </p>
        </div>
        <ContactForm email={site.email} />
      </div>
    </section>
  );
}
