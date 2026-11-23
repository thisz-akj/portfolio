"use client";

import { useEffect, useRef } from "react";
import { sound } from "@/lib/sound";

/**
 * Giant footer name drawn on canvas. On hover a field of particles drifts upward
 * around the letters and the name glitches with sliced horizontal offsets.
 */
export function FooterName({ name, legal }: { name: string; legal: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const GAP = isMobile ? 10 : 6;
    const RADIUS = isMobile ? 1.8 : 2.1;
    const family =
      getComputedStyle(document.documentElement).getPropertyValue("--font-heading").trim() || "sans-serif";

    type P = { ox: number; cy: number; speed: number; inText: boolean; color: string };
    let W = 0, H = 0, fontSize = 0, textX = 0, textY = 0;
    let particles: P[] = [];
    let hovering = false;
    let tp = 0;
    let raf = 0;
    let glitch = false;
    let glitchAlpha = 1;
    let slices: { y: number; h: number; offset: number; alpha: number }[] = [];
    let glitchEnd = 0;

    const font = (size: number, weight = 500) => `${weight} ${size}px ${family}`;

    const color = (nx: number, ny: number) => {
      const b = (0.4 + ny * 0.5 + nx * 0.1) * (0.6 + Math.random() * 0.4);
      return `rgb(${Math.round(b * 10)},${Math.round(b * (140 + ny * 60 + nx * 30))},${Math.round(b * (130 + ny * 40))})`;
    };

    const setup = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.parentElement?.offsetWidth || window.innerWidth;
      H = Math.round(W * 0.26);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      fontSize = Math.round(H * 0.82);
      ctx.font = font(fontSize);
      while (ctx.measureText(name).width > W - 32 && fontSize > 10) {
        fontSize -= 2;
        ctx.font = font(fontSize);
      }
      textX = W / 2;
      textY = H * 0.58;

      particles = [];
      if (isMobile || reduced) return;
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const oc = off.getContext("2d")!;
      oc.font = font(fontSize);
      oc.textAlign = "center";
      oc.textBaseline = "middle";
      oc.fillStyle = "#fff";
      oc.fillText(name, textX, textY);
      const data = oc.getImageData(0, 0, W, H).data;
      for (let y = 0; y < H; y += GAP) {
        for (let x = 0; x < W; x += GAP) {
          particles.push({
            ox: x,
            cy: y + Math.random() * H,
            speed: 0.3 + Math.random() * 0.5,
            inText: data[(y * W + x) * 4 + 3] > 128,
            color: color(x / W, y / H),
          });
        }
      }
    };

    const drawName = (x: number) => {
      ctx.font = font(fontSize);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name, x, textY);
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (document.hidden) return;
      ctx.clearRect(0, 0, W, H);
      tp += ((hovering ? 1 : 0) - tp) * 0.06;

      if (tp > 0.01) {
        for (const p of particles) {
          if (p.inText) continue;
          p.cy -= p.speed * tp;
          if (p.cy < -GAP) p.cy += H + GAP;
          ctx.globalAlpha = tp * Math.max(0, Math.min(1, p.cy / H));
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.ox, p.cy, RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.fillStyle = "#ffffff";
      if (glitch && now < glitchEnd && hovering) {
        glitchAlpha = Math.random() > 0.3 ? 1 : 0.4 + Math.random() * 0.5;
        const count = 2 + Math.floor(Math.random() * 3);
        slices = Array.from({ length: count }, () => ({
          y: Math.random() * H,
          h: 4 + Math.random() * 14,
          offset: (Math.random() - 0.5) * 18,
          alpha: 0.5 + Math.random() * 0.5,
        }));
        ctx.globalAlpha = glitchAlpha;
        drawName(textX);
        for (const s of slices) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, s.y, W, s.h);
          ctx.clip();
          ctx.clearRect(0, s.y, W, s.h);
          ctx.globalAlpha = s.alpha;
          drawName(textX + s.offset);
          ctx.restore();
        }
      } else {
        glitch = false;
        ctx.globalAlpha = isMobile ? 1 : 0.5 + tp * 0.5;
        drawName(textX);
      }

      // Legal lines, bottom-right
      const s1 = Math.max(8, Math.round(fontSize * 0.06));
      ctx.globalAlpha = 0.3 + tp * 0.7;
      ctx.textAlign = "right";
      let ly = Math.min(H - s1 * 2.2, textY + fontSize * 0.55);
      legal.forEach((line, i) => {
        const size = i === 0 ? s1 : Math.max(7, Math.round(s1 * 0.78));
        ctx.font = font(size, 400);
        ctx.fillText(line, W - 16, ly);
        ly += size * 1.4;
      });
      ctx.globalAlpha = 1;
    };

    const enter = () => {
      hovering = true;
      glitch = true;
      const dur = 600 + Math.random() * 400;
      glitchEnd = performance.now() + dur;
      sound().flicker(dur); // bulb buzz in sync with the glitch
    };
    const leave = () => {
      hovering = false;
      glitch = false;
    };

    let resizeT = 0;
    const onResize = () => {
      window.clearTimeout(resizeT);
      resizeT = window.setTimeout(setup, 200);
    };

    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      setup();
      raf = requestAnimationFrame(draw);
    });
    canvas.addEventListener("mouseenter", enter);
    canvas.addEventListener("mouseleave", leave);
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mouseenter", enter);
      canvas.removeEventListener("mouseleave", leave);
      window.removeEventListener("resize", onResize);
    };
  }, [name, legal]);

  return <canvas ref={ref} className="footer-name-canvas" role="img" aria-label={name} />;
}
