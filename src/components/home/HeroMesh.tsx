"use client";

import { useEffect, useRef } from "react";
import { sound } from "@/lib/sound";

/**
 * Matte-black wire mesh behind the hero.
 * - Points sit on a grid and are held by springs to their rest position.
 * - The pointer pushes nearby points away (soft falloff) and lights the wires around it.
 * - A click / tap sends a ripple outward.
 * - At rest the sheet breathes with a slow, low-amplitude wave.
 * Pauses off-screen and on hidden tabs; draws a single static frame for reduced motion.
 */
export function HeroMesh() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement?.parentElement; // .hero
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    let W = 0, H = 0, cols = 0, rows = 0, gap = 0;
    let px: Float32Array, py: Float32Array, vx: Float32Array, vy: Float32Array, rx: Float32Array, ry: Float32Array;
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false, speed: 0 };
    const ripples: { x: number; y: number; t: number }[] = [];
    let raf = 0;
    let visible = true;
    let time = 0;

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gap = coarse || W < 768 ? 34 : 40;
      cols = Math.ceil(W / gap) + 3;
      rows = Math.ceil(H / gap) + 3;
      const n = cols * rows;
      px = new Float32Array(n); py = new Float32Array(n);
      vx = new Float32Array(n); vy = new Float32Array(n);
      rx = new Float32Array(n); ry = new Float32Array(n);
      const ox = (W - (cols - 1) * gap) / 2;
      const oy = (H - (rows - 1) * gap) / 2;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i;
          rx[k] = px[k] = ox + i * gap;
          ry[k] = py[k] = oy + j * gap;
        }
      }
    };

    const R = 190; // pointer radius
    const PUSH = 34;

    const step = () => {
      time += 0.016;
      // ease the pointer so the dent glides instead of snapping
      pointer.x += (pointer.tx - pointer.x) * 0.22;
      pointer.y += (pointer.ty - pointer.y) * 0.22;
      pointer.speed *= 0.9;
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].t += 0.016;
        if (ripples[i].t > 2.2) ripples.splice(i, 1);
      }

      const n = cols * rows;
      for (let k = 0; k < n; k++) {
        // idle breathing: a slow diagonal swell
        const swell = Math.sin(rx[k] * 0.006 + ry[k] * 0.004 + time * 0.7) * 2.2;
        let tx = rx[k];
        let ty = ry[k] + swell;

        if (pointer.active) {
          const dx = rx[k] - pointer.x;
          const dy = ry[k] - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < R && d > 0.001) {
            const f = (1 - d / R) ** 2 * (PUSH + Math.min(pointer.speed, 40) * 0.6);
            tx += (dx / d) * f;
            ty += (dy / d) * f;
          }
        }
        for (const rp of ripples) {
          const dx = rx[k] - rp.x;
          const dy = ry[k] - rp.y;
          const d = Math.hypot(dx, dy) || 1;
          const front = rp.t * 520;
          const band = Math.exp(-(((d - front) / 60) ** 2)) * (1 - rp.t / 2.2);
          tx += (dx / d) * band * 26;
          ty += (dy / d) * band * 26;
        }

        // spring toward target
        vx[k] = (vx[k] + (tx - px[k]) * 0.07) * 0.84;
        vy[k] = (vy[k] + (ty - py[k]) * 0.07) * 0.84;
        px[k] += vx[k];
        py[k] += vy[k];
      }
    };

    const light = (x: number, y: number) => {
      if (!pointer.active) return 0;
      const d = Math.hypot(x - pointer.x, y - pointer.y);
      return d > 320 ? 0 : (1 - d / 320) ** 2;
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;

      // base wires — one path, very low contrast (matte)
      ctx.strokeStyle = "rgba(255,255,255,0.055)";
      ctx.beginPath();
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i;
          if (i < cols - 1) { ctx.moveTo(px[k], py[k]); ctx.lineTo(px[k + 1], py[k + 1]); }
          if (j < rows - 1) { ctx.moveTo(px[k], py[k]); ctx.lineTo(px[k + cols], py[k + cols]); }
        }
      }
      ctx.stroke();

      // lit wires near the pointer, plus soft cell shading where the sheet stretches
      if (pointer.active) {
        const ci = Math.round((pointer.x - px[0]) / gap);
        const cj = Math.round((pointer.y - py[0]) / gap);
        const span = Math.ceil(340 / gap);
        for (let j = Math.max(0, cj - span); j < Math.min(rows - 1, cj + span); j++) {
          for (let i = Math.max(0, ci - span); i < Math.min(cols - 1, ci + span); i++) {
            const k = j * cols + i;
            const a = light(px[k], py[k]);
            if (a < 0.01) continue;
            // stretch → brighter facet (reads as light on a matte surface)
            const area =
              Math.abs((px[k + 1] - px[k]) * (py[k + cols] - py[k]) - (py[k + 1] - py[k]) * (px[k + cols] - px[k])) / (gap * gap);
            const sheen = Math.max(0, area - 1) * 0.35;
            if (sheen > 0.003) {
              ctx.fillStyle = `rgba(255,255,255,${Math.min(0.06, sheen * a)})`;
              ctx.beginPath();
              ctx.moveTo(px[k], py[k]);
              ctx.lineTo(px[k + 1], py[k + 1]);
              ctx.lineTo(px[k + cols + 1], py[k + cols + 1]);
              ctx.lineTo(px[k + cols], py[k + cols]);
              ctx.closePath();
              ctx.fill();
            }
            ctx.strokeStyle = `rgba(242,240,235,${0.05 + a * 0.32})`;
            ctx.beginPath();
            ctx.moveTo(px[k + cols], py[k + cols]);
            ctx.lineTo(px[k], py[k]);
            ctx.lineTo(px[k + 1], py[k + 1]);
            ctx.stroke();
            if (a > 0.25) {
              ctx.fillStyle = `rgba(242,240,235,${a * 0.55})`;
              ctx.fillRect(px[k] - 1, py[k] - 1, 2, 2);
            }
          }
        }
      }
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      step();
      draw();
    };

    const toLocal = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e: PointerEvent) => {
      const p = toLocal(e);
      if (!pointer.active) {
        pointer.x = p.x;
        pointer.y = p.y;
      }
      pointer.speed = Math.hypot(p.x - pointer.tx, p.y - pointer.ty);
      if (pointer.active) sound().rub(pointer.speed / 45); // soft cloth rub while the sheet is pushed
      pointer.tx = p.x;
      pointer.ty = p.y;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    const onDown = (e: PointerEvent) => {
      const p = toLocal(e);
      ripples.push({ x: p.x, y: p.y, t: 0 });
      if (ripples.length > 4) ripples.shift();
    };

    build();
    if (reduced) {
      draw();
    } else {
      raf = requestAnimationFrame(loop);
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
      host.addEventListener("pointerdown", onDown);
    }
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    let t = 0;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        build();
        if (reduced) draw();
      }, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="hero-mesh" aria-hidden="true" />;
}
