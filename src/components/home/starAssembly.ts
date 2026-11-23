"use client";

/**
 * Glints — a handful of soft, colour-matched points of light that drift in and
 * converge on each hero tile just before it develops. Purely decorative and timed
 * by the caller (each target has its own delay), so it stays in step with the
 * GSAP choreography in Hero.
 */

export type RGB = [number, number, number];

export interface GlintTarget {
  el: HTMLElement;
  /** seconds from start until the tile begins to develop */
  delay: number;
  /** colour of the element at (u, v) in 0..1 */
  color?: (u: number, v: number) => RGB;
}

/** Load an image and return a sampler for an element of size w×h showing it with object-fit: cover. */
export function imageSampler(url: string, w: number, h: number): Promise<((u: number, v: number) => RGB) | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const S = 40;
      const cw = S;
      const ch = Math.max(1, Math.round((S * h) / Math.max(w, 1)));
      const c = document.createElement("canvas");
      c.width = cw;
      c.height = ch;
      const x = c.getContext("2d", { willReadFrequently: true })!;
      const scale = Math.max(cw / img.width, ch / img.height);
      x.drawImage(img, (cw - img.width * scale) / 2, (ch - img.height * scale) / 2, img.width * scale, img.height * scale);
      const d = x.getImageData(0, 0, cw, ch).data;
      resolve((u, v) => {
        const px = Math.min(cw - 1, Math.max(0, Math.floor(u * cw)));
        const py = Math.min(ch - 1, Math.max(0, Math.floor(v * ch)));
        const k = (py * cw + px) * 4;
        const lift = (n: number) => Math.round(70 + n * 0.75); // stay luminous on black
        return [lift(d[k]), lift(d[k + 1]), lift(d[k + 2])];
      });
    };
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}

interface Glint {
  sx: number; sy: number; tx: number; ty: number;
  start: number; dur: number; size: number; rgb: string;
}

const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

export function glintsToward(targets: GlintTarget[], origin: { x: number; y: number }) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const per = W < 768 ? 7 : 12;

  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: `${W}px`, height: `${H}px`, pointerEvents: "none", zIndex: "90" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const glints: Glint[] = [];
  for (const { el, delay, color } of targets) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // come from further out, along the line from the name through the tile
    const dx = cx - origin.x;
    const dy = cy - origin.y;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = 0; i < per; i++) {
      const u = Math.random();
      const v = Math.random();
      const tx = r.left + u * r.width;
      const ty = r.top + v * r.height;
      const spread = (Math.random() - 0.5) * 1.1;
      const dist = 140 + Math.random() * 220;
      const ang = Math.atan2(dy / len, dx / len) + spread;
      const [cr, cg, cb] = color?.(u, v) ?? [242, 240, 235];
      glints.push({
        sx: tx + Math.cos(ang) * dist,
        sy: ty + Math.sin(ang) * dist,
        tx, ty,
        start: Math.max(0, delay - 0.55 + Math.random() * 0.25),
        dur: 0.9 + Math.random() * 0.4,
        size: 0.8 + Math.random() * 1.6,
        rgb: `${cr},${cg},${cb}`,
      });
    }
  }

  // pre-rendered soft sprite (a blurred dot) — cheap and pretty
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 32;
  const sx = sprite.getContext("2d")!;
  const grad = sx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  sx.fillStyle = grad;
  sx.fillRect(0, 0, 32, 32);

  const t0 = performance.now();
  const end = Math.max(...glints.map((g) => g.start + g.dur)) + 0.6;
  let raf = 0;
  let done = false;

  const frame = (now: number) => {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    for (const g of glints) {
      if (t < g.start) continue;
      const k = Math.min(1, (t - g.start) / g.dur);
      const e = easeOutQuint(k);
      const x = g.sx + (g.tx - g.sx) * e;
      const y = g.sy + (g.ty - g.sy) * e;
      // fade in, hold, then melt into the developing image
      const a = Math.min(1, k * 4) * (k < 0.8 ? 1 : Math.max(0, 1 - (k - 0.8) / 0.2) + Math.max(0, 0.4 - (t - g.start - g.dur)));
      if (a <= 0.01) continue;
      const s = g.size * 7 * (1 + (1 - e) * 0.6);
      ctx.globalAlpha = Math.min(1, a) * 0.9;
      ctx.globalCompositeOperation = "lighter";
      // tint the sprite by drawing it, then colour with source-atop on a scratch would be costly;
      // instead draw a coloured core + white halo for a luminous look
      ctx.fillStyle = `rgba(${g.rgb},1)`;
      ctx.beginPath();
      ctx.arc(x, y, g.size * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = Math.min(1, a) * 0.35;
      ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    if (t < end) raf = requestAnimationFrame(frame);
    else stop();
  };

  const stop = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    canvas.remove();
  };
  raf = requestAnimationFrame(frame);
  return stop;
}
