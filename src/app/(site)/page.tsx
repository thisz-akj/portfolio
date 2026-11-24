import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Hero } from "@/components/home/Hero";
import { heroImages } from "@/content/hero";
import { Loader } from "@/components/home/Loader";
import { Clients } from "@/components/home/Clients";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { ScrubText } from "@/components/shared/ScrubText";
import { Reveal } from "@/components/shared/Reveal";
import { WaveField } from "@/components/shared/WaveField";
import { AboutPortrait } from "@/components/shared/AboutPortrait";
import { expertiseIcons } from "@/components/ui/Icons";
import { HiredBento } from "@/components/hired/HiredBento";
import { about, experience, expertise, philosophy, site, skills } from "@/content/site";
import { solutions } from "@/content/solutions";
import { clients } from "@/content/clients";

export default function Home() {
  return (
    <>
      <Loader assets={heroImages.map((i) => i.art)} />

      {/* ── INTRO ─────────────────────────────── */}
      <div id="intro">
        <Hero />
        <section className="philosophy-section" aria-labelledby="philosophy-label">
          <div className="philosophy-inner">
            <div>
              <p className="eyebrow" id="philosophy-label">
                What I do
              </p>
              <ScrubText
                text={philosophy}
                highlight={["ai", "measured", "shipping"]}
                className="philosophy-text"
              />
            </div>
            <div className="philosophy-right">
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
          </div>
        </section>
      </div>

      {/* ── WORK: what I get hired for (Jorge-style bento + side panel) ── */}
      <div id="work">
        <section className="rent-section" aria-label="Things I keep getting hired for">
          <HiredBento solutions={solutions} />
        </section>

        <Clients clients={clients} />

        <section className="work-section" aria-label="Engineering notes">
          <div className="featured-head" style={{ padding: 0, marginBottom: 0 }}>
            <div>
              <p className="eyebrow">R&amp;D, on the side</p>
              <p className="lede">
                Before automation, I cut my teeth on perception: visual SLAM, camera–LiDAR calibration and quantised detectors.
                It&apos;s where my measure-everything habit comes from.
              </p>
            </div>
            <Link href="/work" className="btn-ghost">
              Engineering case studies <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
      </div>

      {/* ── ABOUT ─────────────────────────────── */}
      <section className="about-section" id="about" >
        <div>
          <p className="eyebrow">Beyond the brief</p>
          <SectionHeading>About Me</SectionHeading>
          <ScrubText
            text={about.text}
            mode="word"
            phrase={about.highlight}
            className="about-text"
            floor={0.15}
            feather={0.1}
            start="top 90%"
            end="bottom 60%"
          />
          <ScrubText text={about.pullquote} className="about-pullquote" floor={0.12} start="top 85%" end="top 55%" />
        </div>
        <div>
          <AboutPortrait />
          <p className="about-right-label">What I&apos;ve been building</p>
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
                <ul className="skills-list">
                  {s.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

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
            <ScrubText
              text="I've debugged almost every model I've ever shipped. I'd happily debug yours too."
              highlight={["debug"]}
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
