"use client";

import { Fragment, useEffect, useRef } from "react";
import { featherOpacity } from "@/lib/curve";
import { ScrollTrigger, prefersReducedMotion } from "@/lib/motion";

/**
 * Text that "fills in" from dim to bright as it scrolls through the viewport,
 * per character or per word, with a soft quadratic feather on the leading edge.
 * Words in `highlight` (or inside the `phrase`) switch to the italic serif.
 */
export function ScrubText({
  text,
  mode = "char",
  highlight = [],
  phrase,
  className = "",
  floor = 0.12,
  feather = 0.07,
  start = "top 80%",
  end = "top 35%",
  as: Tag = "p",
}: {
  text: string;
  mode?: "char" | "word";
  highlight?: string[];
  phrase?: string;
  className?: string;
  floor?: number;
  feather?: number;
  start?: string;
  end?: string;
  as?: "p" | "div" | "blockquote";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const units = Array.from(el.querySelectorAll<HTMLElement>(".q-unit"));
    const apply = (p: number) =>
      units.forEach((u, i) => {
        u.style.opacity = String(featherOpacity(i, units.length, p, floor, feather));
      });
    apply(0);
    const st = ScrollTrigger.create({
      trigger: el,
      start,
      end,
      scrub: true,
      onUpdate: (self) => apply(self.progress),
      onLeave: () => apply(1),
    });
    return () => {
      st.kill();
      units.forEach((u) => (u.style.opacity = ""));
    };
  }, [floor, feather, start, end]);

  const seen = new Set<string>();
  const phraseRange = phrase ? [text.indexOf(phrase), text.indexOf(phrase) + phrase.length] : null;
  let cursor = 0;

  const paragraphs = text.split("\n\n");

  return (
    <Tag ref={ref as React.Ref<never>} className={className}>
      {paragraphs.map((para, pi) => (
        <Fragment key={pi}>
          {para.split(/(\s+)/).map((token, ti) => {
            const tokenStart = text.indexOf(token, cursor);
            cursor = tokenStart + token.length;
            if (/^\s+$/.test(token)) return token;
            const clean = token.replace(/[^\p{L}]/gu, "").toLowerCase();
            const inPhrase = phraseRange && tokenStart >= phraseRange[0] && cursor <= phraseRange[1] + 1;
            const isHL = inPhrase || (highlight.includes(clean) && !seen.has(clean));
            if (highlight.includes(clean)) seen.add(clean);
            const cls = isHL ? "q-highlight" : undefined;
            if (mode === "word") {
              return (
                <span key={ti} className={`q-unit w ${cls ?? ""}`}>
                  {token}
                </span>
              );
            }
            return (
              <span key={ti} className={cls} style={{ whiteSpace: "nowrap" }}>
                {Array.from(token).map((ch, ci) => (
                  <span key={ci} className="q-unit q-char">
                    {ch}
                  </span>
                ))}
              </span>
            );
          })}
          {pi < paragraphs.length - 1 && (
            <>
              <br />
              <br />
            </>
          )}
        </Fragment>
      ))}
    </Tag>
  );
}
