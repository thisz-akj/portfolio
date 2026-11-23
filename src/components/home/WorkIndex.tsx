"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/types/content";
import { isFinePointer, prefersReducedMotion } from "@/lib/motion";

const COLS = 56;
const ROWS = 42; // 4:3

interface Particle {
  bx: number; // base, 0..1 in the preview rect
  by: number;
  dx: number; // dispersion direction
  dy: number;
  delay: number;
  color: string;
}

function sample(src: string): Promise<Particle[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = COLS;
      c.height = ROWS;
      const ctx = c.getContext("2d")!;
      // cover-fit
      const s = Math.max(COLS / img.width, ROWS / img.height);
      const w = img.width * s;
      const h = img.height * s;
      ctx.drawImage(img, (COLS - w) / 2, (ROWS - h) / 2, w, h);
      const d = ctx.getImageData(0, 0, COLS, ROWS).data;
      const out: Particle[] = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const k = (y * COLS + x) * 4;
          const a = Math.random() * Math.PI * 2;
          const r = 0.4 + Math.random() * 1.1;
          out.push({
            bx: (x + 0.5) / COLS,
            by: (y + 0.5) / ROWS,
            dx: Math.cos(a) * r,
            dy: Math.sin(a) * r - 0.3,
            delay: Math.random(),
            color: `rgb(${d[k]},${d[k + 1]},${d[k + 2]})`,
          });
        }
      }
      resolve(out);
    };
    img.onerror = () => resolve([]);
    img.src = src;
  });
}

/**
 * Numbered project index. Hovering a row gathers a cloud of image-coloured
 * particles into a preview that follows the cursor, then cross-fades to the image.
 * Leaving disperses the particles again.
 */
export function WorkIndex({ projects }: { projects: Project[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const list = listRef.current;
    if (!canvas || !list || !isFinePointer() || prefersReducedMotion()) return;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const clouds: Particle[][] = projects.map(() => []);
    projects.forEach((p, i) => sample(p.cover).then((c) => (clouds[i] = c)));

    const progress = projects.map(() => 1);
    const target = projects.map(() => 1);
    let active = -1;
    let mx = W / 2, my = H / 2, cx = mx, cy = my;
    let raf = 0;
    let running = false;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      cx += (mx - cx) * 0.18;
      cy += (my - cy) * 0.18;
      ctx.clearRect(0, 0, W, H);
      const PW = Math.min(W * 0.26, 340);
      const PH = PW * 0.75;
      const left = cx - PW / 2;
      const top = cy - PH / 2;
      const cell = PW / COLS;
      let busy = active !== -1;

      projects.forEach((_, i) => {
        const t = target[i];
        progress[i] += (t - progress[i]) * (t === 0 ? 0.08 : 0.05);
        const p = progress[i];
        const img = imgRefs.current[i];
        const imgOpacity = Math.min(1, Math.max(0, (0.4 - p) / 0.4));
        if (img) {
          img.style.opacity = i === active ? String(imgOpacity) : "0";
          img.style.width = `${PW}px`;
          img.style.height = `${PH}px`;
          img.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        }
        if (p > 0.995 && t === 1) return;
        busy = true;
        if (imgOpacity >= 1) return;
        const spread = PW * 0.9;
        for (const pt of clouds[i]) {
          // Higher-delay particles leave later and arrive later.
          const e = Math.min(1, Math.max(0, p * 1.6 - pt.delay * 0.6));
          const ee = e * e;
          const alpha = (1 - ee) * (i === active ? 1 : 0.85);
          if (alpha <= 0.02) continue;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = pt.color;
          const x = left + pt.bx * PW + pt.dx * spread * ee;
          const y = top + pt.by * PH + pt.dy * spread * ee;
          const s = cell * (1 - ee * 0.5);
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      });
      ctx.globalAlpha = 1;
      if (!busy) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };
    const kick = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };

    const rows = Array.from(list.querySelectorAll<HTMLElement>(".project-row"));
    const handlers = rows.map((row, i) => {
      const enter = (e: MouseEvent) => {
        if (active === -1) {
          cx = mx = e.clientX;
          cy = my = e.clientY;
        }
        if (active !== -1 && active !== i) target[active] = 1;
        active = i;
        target[i] = 0;
        kick();
      };
      const leave = () => {
        target[i] = 1;
        if (active === i) active = -1;
        kick();
      };
      row.addEventListener("mouseenter", enter);
      row.addEventListener("mouseleave", leave);
      return () => {
        row.removeEventListener("mouseenter", enter);
        row.removeEventListener("mouseleave", leave);
      };
    });
    const move = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      handlers.forEach((h) => h());
      window.removeEventListener("mousemove", move);
      window.removeEventListener("resize", resize);
    };
  }, [projects]);

  return (
    <>
      <ul className="project-list" ref={listRef}>
        {projects.map((p) => (
          <li key={p.slug}>
            <Link href={`/work/${p.slug}`} className="project-row" data-cursor="view">
              <span className="project-index">{p.index}</span>
              <span>
                <span className="project-name" style={{ display: "block" }}>
                  {p.title}
                </span>
                <span className="project-sub">
                  {[p.client, ...p.tags.slice(0, 2)].map((t, i) => (
                    <span key={t} style={{ display: "contents" }}>
                      {i > 0 && <span className="sub-dot">·</span>}
                      <span>{t}</span>
                    </span>
                  ))}
                </span>
              </span>
              <span className="project-year">
                {p.year} <ArrowUpRight size={14} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <canvas ref={canvasRef} className="preview-canvas" aria-hidden="true" />
      {projects.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- cursor-following overlay, sized every frame
        <img key={p.slug} ref={(el) => { imgRefs.current[i] = el; }} src={p.cover} alt="" className="preview-img" aria-hidden="true" />
      ))}
    </>
  );
}
