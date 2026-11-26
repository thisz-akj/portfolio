import { Phone, Sparkles } from "lucide-react";
import { techStackNote, type TechGroup } from "@/content/techStack";
import { brandIcon } from "@/lib/brandIcons";

/** Brands the icon set doesn't carry get a plain line icon instead. */
const fallback: Record<string, typeof Phone> = { openai: Sparkles, phone: Phone };

function Glyph({ icon }: { icon: string }) {
  // Server component: only checks the slug exists; the paths live in the /tech-icons.svg sprite.
  if (brandIcon(icon)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <use href={`/tech-icons.svg#${icon}`} />
      </svg>
    );
  }
  const Line = fallback[icon] ?? Sparkles;
  return <Line strokeWidth={1.6} aria-hidden="true" />;
}

/**
 * Tool logos in monochrome; the name shows in a small label on hover or keyboard focus.
 * Phones get a compact two-row strip that drifts slowly (`.tech-marquee`, decorative) instead of the
 * seven grouped lists, which then stay available to screen readers only (CSS in globals.css).
 */
export function TechStack({ groups }: { groups: TechGroup[] }) {
  const all = groups.flatMap((g) => g.items);
  const half = Math.ceil(all.length / 2);
  const rows = [all.slice(0, half), all.slice(half)];
  return (
    <>
      <div className="tech-marquee" aria-hidden="true">
        {rows.map((row, r) => (
          <div className={`tm-row${r ? " is-reverse" : ""}`} key={r}>
            {/* twice, so the loop is seamless */}
            {[0, 1].map((copy) => (
              <ul className="tm-track" key={copy}>
                {row.map((t) => (
                  <li key={t.name} className="tech-icon" data-name={t.name}>
                    <Glyph icon={t.icon} />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        ))}
      </div>
      <p className="tm-count">{techStackNote(all.length)}</p>
    <div className="tech-stack">
      {groups.map((g) => (
        <div className="tech-group" key={g.title}>
          <p className="skills-cat-title">{g.title}</p>
          <ul className="tech-icons">
            {g.items.map((t) => (
              <li key={t.name} className="tech-icon" tabIndex={0} data-name={t.name} aria-label={t.name}>
                <Glyph icon={t.icon} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    </>
  );
}
