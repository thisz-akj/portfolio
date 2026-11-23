"use client";

import { useEffect, useRef } from "react";
import { sound } from "@/lib/sound";

/**
 * Perspective dot-matrix terrain — a variation on the hero mesh.
 * A grid of points lies on a floor plane seen at an angle; layered sine swells roll
 * through it, the pointer raises a soft hill that catches a faint green glow, and a
 * click sends a ring-shaped ripple across the field. Monochrome, matte, low contrast.
 * Pauses off-screen / on hidden tabs; single static frame for reduced motion.
 */
export function WaveField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement?.parentElement; // the section
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 767px)").matches;

    // World grid on the x–z plane
    const COLS = small ? 46 : 84;
    const ROWS = small ? 30 : 44;
    const SPACING = 1;
    const FOV = 1.0;
    const CAM_H = 7.5; // camera height above the plane
    const TILT = 0.42; // radians, camera pitch down

    let W = 0, H = 0;
    let raf = 0;
    let visible = true;
    let t = 0;
    // pointer in world (x,z) and screen
    const ptr = { sx: -1, sy: -1, wx: 0, wz: 0, tx: 0, tz: 0, on: 0, target: 0 };
    const rings: { x: number; z: number; age: number }[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const cosT = Math.cos(TILT), sinT = Math.sin(TILT);
    // project world (x, y, z) → screen; z grows away from camera
    const project = (x: number, y: number, z: number) => {
      const yc = y - CAM_H;
      const zc = z;
      // camera pitched down by TILT: up = (cos, sin), forward = (−sin, cos) in (y, z)
      const y2 = yc * cosT + zc * sinT;
      const z2 = -yc * sinT + zc * cosT;
      if (z2 <= 0.1) return null;
      const f = (H * 0.9) / (FOV * z2);
      return { x: W / 2 + x * f, y: H * 0.5 - y2 * f, s: f, z: z2 };
    };

    // inverse for the pointer: intersect screen ray with the y=0 plane
    const unproject = (sx: number, sy: number) => {
      const dx = ((sx - W / 2) / (H * 0.9)) * FOV;
      const dy = (-(sy - H * 0.5) / (H * 0.9)) * FOV;
      // camera-space ray (dx, dy, 1) → world by inverse pitch
      const ry = dy * cosT - sinT;
      const rz = dy * sinT + cosT;
      if (ry >= -0.0001) return null;
      const k = -CAM_H / ry;
      return { x: dx * k, z: rz * k };
    };

    const height = (x: number, z: number) => {
      let y =
        Math.sin(x * 0.35 + t * 0.8) * 0.28 +
        Math.sin(z * 0.42 - t * 0.6) * 0.32 +
        Math.sin((x + z) * 0.22 + t * 0.45) * 0.22;
      if (ptr.on > 0.01) {
        const d2 = (x - ptr.wx) ** 2 + (z - ptr.wz) ** 2;
        y += Math.exp(-d2 / 7) * 1.6 * ptr.on;
      }
      for (const r of rings) {
        const d = Math.hypot(x - r.x, z - r.z);
        const front = r.age * 9;
        y += Math.exp(-(((d - front) / 1.2) ** 2)) * 0.9 * Math.max(0, 1 - r.age / 2.4);
      }
      return y;
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const x0 = -(COLS - 1) * SPACING * 0.5;
      const drift = (t * 0.6) % SPACING; // field slides toward the viewer
      const pts: ({ x: number; y: number; s: number; z: number; glow: number } | null)[] = [];

      for (let j = 0; j < ROWS; j++) {
        const z = 2.5 + j * SPACING - drift;
        for (let i = 0; i < COLS; i++) {
          const x = x0 + i * SPACING;
          const y = height(x, z);
          const p = project(x, y, z);
          if (!p) { pts.push(null); continue; }
          const glow = ptr.on > 0.01 ? Math.exp(-((x - ptr.wx) ** 2 + (z - ptr.wz) ** 2) / 9) * ptr.on : 0;
          pts.push({ ...p, glow });
        }
      }

      // faint row lines for structure (every row, very low alpha)
      ctx.lineWidth = 1;
      for (let j = 0; j < ROWS; j++) {
        const depthFade = 1 - j / ROWS;
        ctx.strokeStyle = `rgba(242,240,235,${0.035 * depthFade})`;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < COLS; i++) {
          const p = pts[j * COLS + i];
          if (!p) { started = false; continue; }
          if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // dots: size and brightness by depth; green-tinted near the pointer
      for (let j = ROWS - 1; j >= 0; j--) {
        const depthFade = Math.pow(1 - j / ROWS, 1.3);
        for (let i = 0; i < COLS; i++) {
          const p = pts[j * COLS + i];
          if (!p || p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) continue;
          const r = Math.max(0.6, Math.min(2.6, p.s * 0.018));
          const a = 0.1 + 0.5 * depthFade;
          if (p.glow > 0.04) {
            const g = p.glow;
            ctx.fillStyle = `rgba(${Math.round(242 - 168 * g)},${Math.round(240 - 18 * g)},${Math.round(235 - 107 * g)},${Math.min(1, a + g * 0.6)})`;
          } else {
            ctx.fillStyle = `rgba(242,240,235,${a})`;
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + p.glow * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      t += 0.016;
      ptr.on += (ptr.target - ptr.on) * 0.08;
      ptr.wx += (ptr.tx - ptr.wx) * 0.12;
      ptr.wz += (ptr.tz - ptr.wz) * 0.12;
      for (let i = rings.length - 1; i >= 0; i--) {
        rings[i].age += 0.016;
        if (rings[i].age > 2.4) rings.splice(i, 1);
      }
      draw();
    };

    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    let lastX = -1, lastY = -1;
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      if (lastX >= 0) sound().rub(Math.hypot(p.x - lastX, p.y - lastY) / 55);
      lastX = p.x;
      lastY = p.y;
      const w = unproject(p.x, p.y);
      if (!w) { ptr.target = 0; return; }
      ptr.tx = w.x;
      ptr.tz = w.z;
      if (ptr.target === 0) { ptr.wx = ptr.tx; ptr.wz = ptr.tz; }
      ptr.target = 1;
    };
    const onLeave = () => { ptr.target = 0; lastX = -1; };
    const onDown = (e: PointerEvent) => {
      const p = local(e);
      const w = unproject(p.x, p.y);
      if (w) {
        rings.push({ x: w.x, z: w.z, age: 0 });
        if (rings.length > 4) rings.shift();
      }
    };

    resize();
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
    let rt = 0;
    const onResize = () => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => { resize(); if (reduced) draw(); }, 150);
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

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
