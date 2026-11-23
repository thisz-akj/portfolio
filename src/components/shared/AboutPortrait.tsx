"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/motion";

/**
 * Cut-out portrait standing in front of an off-white arch ("door"), with a
 * calligraphic "hello" layered between them. The word uses a difference blend,
 * so it reads as dark ink across the arch and light ink over the dark page.
 *
 * On desktop the composition matches the height and top edge of the About text
 * (`match` selector, looked up inside the closest <section>).
 */
export function AboutPortrait({ match = ".about-text", word = "hello" }: { match?: string; word?: string }) {
  const ref = useRef<HTMLElement>(null);

  // Size + align to the paragraph block
  useEffect(() => {
    const el = ref.current;
    const section = el?.closest("section");
    const text = section?.querySelector<HTMLElement>(match);
    if (!el || !text) return;
    const mq = window.matchMedia("(min-width: 1025px)");
    const fit = () => {
      if (!mq.matches) {
        el.style.removeProperty("--portrait-h");
        el.style.marginTop = "";
        return;
      }
      el.style.marginTop = "0px";
      // "hello" starts over the door edge (~0.64h) and runs ~0.42h to the right; keep it on screen.
      const col = el.parentElement?.clientWidth ?? 600;
      const room = col + Math.min(48, window.innerWidth - el.parentElement!.getBoundingClientRect().right - 8);
      const h = Math.min(620, Math.max(360, text.offsetHeight), room / 1.08);
      const offset = text.getBoundingClientRect().top - el.getBoundingClientRect().top;
      el.style.setProperty("--portrait-h", `${h}px`);
      el.style.marginTop = `${Math.max(0, offset)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(text);
    mq.addEventListener("change", fit);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", fit);
      window.removeEventListener("resize", fit);
    };
  }, [match]);

  // Entrance + gentle pointer parallax
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.classList.add("in");
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);

    const person = el.querySelector(".ap-person");
    const hello = el.querySelector(".ap-hello");
    const arch = el.querySelector(".ap-arch");
    const set = (node: Element | null, f: number) =>
      node ? { x: gsap.quickTo(node, "x", { duration: 1, ease: "power3.out" }), y: gsap.quickTo(node, "y", { duration: 1, ease: "power3.out" }), f } : null;
    const layers = [set(arch, -6), set(hello, 14), set(person, 8)].filter(Boolean) as { x: (v: number) => void; y: (v: number) => void; f: number }[];
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      layers.forEach((l) => {
        l.x(nx * l.f);
        l.y(ny * l.f * 0.6);
      });
    };
    const leave = () => layers.forEach((l) => (l.x(0), l.y(0)));
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      io.disconnect();
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <figure className="about-portrait" ref={ref}>
      <div className="ap-stage">
        <div className="ap-arch" aria-hidden="true" />
        <span className="ap-hello" aria-hidden="true">
          <span className="ap-hello-ink">{word}</span>
        </span>
        <div className="ap-person">
          <Image src="/about/azad-cutout.webp" alt="Azad Kumar Jha" fill sizes="(max-width: 1024px) 80vw, 420px" priority={false} />
        </div>
      </div>
      <figcaption className="ap-cap">Azad Kumar Jha — Applied AI engineer</figcaption>
    </figure>
  );
}
