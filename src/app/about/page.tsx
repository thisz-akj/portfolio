import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { about, experience, expertise, site, skills } from "@/content/site";
import { ScrubText } from "@/components/shared/ScrubText";
import { Reveal } from "@/components/shared/Reveal";
import { AboutPortrait } from "@/components/shared/AboutPortrait";
import { expertiseIcons, socialIcons } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "About",
  description: `${site.name} — ${site.role}. Experience, technical focus and how I work.`,
};

const approach = [
  { title: "Baseline first", text: "Before anything clever, a simple version and a fixed evaluation set — so every improvement is measured." },
  { title: "Ship the thin slice", text: "A working end-to-end demo in front of real users beats a perfect component nobody can try." },
  { title: "Write the limits down", text: "Every system ships with what it can't do. It saves you money and saves me awkward calls." },
  { title: "Leave it maintainable", text: "Typed interfaces, swappable providers and docs your team will actually read." },
];

export default function AboutPage() {
  return (
    <>
      <section className="inner">
        <div className="inner-head">
          <p className="eyebrow">About</p>
          <h1 className="inner-title">{site.name}</h1>
          <p className="lede">{site.role}</p>
        </div>
        <div className="about-section" style={{ padding: 0, border: 0, background: "transparent" }}>
          <div>
            <ScrubText text={about.text} mode="word" phrase={about.highlight} className="about-text" floor={0.2} feather={0.1} start="top 85%" end="bottom 70%" />
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
          </div>
          <div>
            <AboutPortrait />
            <p className="about-right-label">Experience</p>
            {experience.map((r) => (
              <Reveal className="about-role" key={r.company + r.title}>
                <div className="about-role-company">
                  {r.company}
                  {r.placeholder && <span className="badge-todo">placeholder</span>}
                </div>
                <div className="about-role-title">{r.title}</div>
                <div className="about-role-period">{r.period}</div>
              </Reveal>
            ))}
            <div className="skills-grid">
              {skills.map((s) => (
                <div key={s.title}>
                  <p className="skills-cat-title">{s.title}</p>
                  <ul className="skills-list">{s.items.map((i) => <li key={i}>{i}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="philosophy-section">
        <p className="eyebrow">Technical focus</p>
        <ul className="expertise-list" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {expertise.map((e) => {
            const Icon = expertiseIcons[e.icon];
            return (
              <li className="expertise-card" key={e.title} style={{ borderBottom: 0 }}>
                <Icon className="ecard-icon" strokeWidth={1.2} aria-hidden="true" />
                <h2 className="ecard-title">{e.title}</h2>
                <ul className="ecard-list">{e.items.map((it) => <li key={it}>{it}</li>)}</ul>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="inner" style={{ paddingTop: "6rem" }}>
        <p className="eyebrow">How I work</p>
        <div className="card-grid">
          {approach.map((a, i) => (
            <Reveal as="article" className="card" key={a.title} delay={i * 0.06}>
              <span className="card-num">0{i + 1}</span>
              <h2 className="card-title">{a.title}</h2>
              <p className="card-body">{a.text}</p>
            </Reveal>
          ))}
        </div>
        <div style={{ marginTop: "4rem" }}>
          <Link href="/contact" className="btn-pill">
            Start a conversation <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
