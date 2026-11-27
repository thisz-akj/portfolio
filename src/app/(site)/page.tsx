import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Hero } from "@/components/home/Hero";
import { AboutFrames } from "@/components/home/AboutFrames";
import { Clients } from "@/components/home/Clients";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { ScrubText } from "@/components/shared/ScrubText";
import { Reveal } from "@/components/shared/Reveal";
import { WaveField } from "@/components/shared/WaveField";
import { expertiseIcons } from "@/components/ui/Icons";
import { HiredBento } from "@/components/hired/HiredBento";
import { TechStack } from "@/components/shared/TechStack";
import { PhoneCollapse } from "@/components/shared/PhoneCollapse";
import { techStack } from "@/content/techStack";
import { about, achievements, experience, expertise, philosophy, philosophyHighlight, resumes, site, skills } from "@/content/site";
import { solutions } from "@/content/solutions";
import { clients } from "@/content/clients";

export default function Home() {
  return (
    <>
      {/* ── INTRO ─────────────────────────────── */}
      <Hero />

      {/* ── ABOUT: who I am, what I build, experience, skills & sectors ── */}
      <section className="about-section about-v2" id="about">
        <div className="about-visual">
          <AboutFrames />
        </div>
        <div className="about-body">
          <p className="eyebrow">02 · Beyond the brief</p>
          <SectionHeading>About Me</SectionHeading>
          <PhoneCollapse className="about-collapse">
            <ScrubText
              text={about.text}
              mode="word"
              phrase={about.highlight}
              highlight={about.highlightWords}
              className="about-text"
              floor={0.15}
              feather={0.1}
              start="top 90%"
              end="bottom 60%"
            />
          </PhoneCollapse>
          <ScrubText text={about.pullquote} className="about-pullquote" floor={0.12} start="top 85%" end="top 55%" />

          <div className="about-block" aria-labelledby="philosophy-label">
            <p className="eyebrow" id="philosophy-label">
              What I build
            </p>
            <ScrubText text={philosophy} highlight={philosophyHighlight} className="philosophy-text" />
            <ul className="expertise-list">
              {expertise.map((e) => {
                const Icon = expertiseIcons[e.icon];
                return (
                  <li className="expertise-card" key={e.title}>
                    <Icon className="ecard-icon" strokeWidth={1.2} aria-hidden="true" />
                    <h3 className="ecard-title">{e.title}</h3>
                    <ul className="ecard-list">
                      {e.items.map((it) => (
                        <li key={it}>{it}</li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="about-block">
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
            <p className="about-right-label about-sub-label">Achievements</p>
            <ul className="about-achievements">
              {achievements.map((x) => (
                <li key={x.title}>
                  <span>{x.title}</span>
                  <span className="about-ach-year">{x.year}</span>
                </li>
              ))}
            </ul>
            <div className="about-resumes" id="resume">
              <p className="about-right-label about-sub-label">Résumé</p>
              <div className="about-resume-links">
                {resumes.map((r) => (
                  <a key={r.href} href={r.href} className="btn-pill about-resume-btn" target="_blank" rel="noreferrer">
                    {r.label} <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
                  </a>
                ))}
              </div>
            </div>
            <div className="skills-grid">
              {skills.map((sk) => (
                <div key={sk.title}>
                  <p className="skills-cat-title">{sk.title}</p>
                  <ul className="skills-list">
                    {sk.items.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="about-block">
            <p className="about-right-label">Tech I use</p>
            <TechStack groups={techStack} />
          </div>
        </div>
      </section>

      {/* ── WORK: what I get hired for (Jorge-style bento + side panel) ── */}
      <div id="work">
        <section className="rent-section" aria-label="Things I keep getting hired for">
          <HiredBento solutions={solutions} showAll />
        </section>

        <Clients clients={clients} />
      </div>

      {/* ── CONTACT ───────────────────────────── */}
      <section className="punchline-section" id="contact" aria-label="Contact">
        <div className="punchline-bg" aria-hidden="true">
          <WaveField className="wave-field" />
        </div>
        <div className="punchline-wrap">
          <span className="punchline-quote-icon" aria-hidden="true">
            &ldquo;
          </span>
          <div>
            <p className="eyebrow">05 · Contact</p>
            <ScrubText
              text="I've shipped AI into real businesses and real robots. Yours could be next."
              highlight={["yours"]}
              className="punchline-text"
              start="top 85%"
              end="top 45%"
            />
            <div className="punchline-cta">
              <Link href="/contact" className="btn-pill">
                Work with me <ArrowUpRight size={16} />
              </Link>
              <Link href="/demos" className="btn-ghost">
                Try the demos
              </Link>
              <a href={`mailto:${site.email}`} className="btn-ghost">
                {site.email}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
