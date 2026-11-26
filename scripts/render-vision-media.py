"""Render the computer-vision / robotics visuals for the portfolio (no stock, no real customer footage).

  python3 scripts/render-vision-media.py            # stills → public/work/cv-*.webp, loops → public/video/cv-*.mp4
  python3 scripts/render-vision-media.py --stills   # stills only (fast)

Three procedurally drawn scenes that illustrate the owner's projects (not recordings of them):
  surroundsense  360° bird's-eye view from four cameras with blind-spot alerts
  trolley-pose   keypoints and tracks on industrial trolleys, in perspective
  calibration    a LiDAR scan locking onto a camera frame and the person's mask
Recorded in docs/credits.md as generated artwork.
"""

from __future__ import annotations

import math
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SS = 2  # supersampling
FPS, SECONDS = 30, 6
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
SANS_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SERIF_IT = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf"

LIVE = (74, 222, 128)
SKY = (160, 196, 255)
AMBER = (240, 198, 116)
RED = (255, 107, 107)
WHITE = (242, 240, 235)
DIM = (120, 120, 120)


@lru_cache(maxsize=64)
def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def ease(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


@lru_cache(maxsize=8)
def grain(w: int, h: int, amount: int = 10, seed: int = 3) -> Image.Image:
    rng = np.random.default_rng(seed)
    n = rng.normal(0, amount, (h, w)).clip(-40, 40) + 128
    return Image.fromarray(n.astype(np.uint8), "L")


def finish(img: Image.Image, W: int, H: int, vignette: float = 0.55, grain_amt: int = 7) -> Image.Image:
    img = img.resize((W, H), Image.LANCZOS)
    # vignette
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    v = (1 - vignette * np.clip(r - 0.35, 0, 1) ** 1.6)[..., None]
    a = np.asarray(img).astype(np.float32) * v
    g = (np.asarray(grain(W, H, grain_amt)).astype(np.float32) - 128)[..., None] * 0.5
    return Image.fromarray(np.clip(a + g, 0, 255).astype(np.uint8))


def glow(base: Image.Image, layer: Image.Image, radius: int) -> Image.Image:
    """Add `layer` (RGBA) twice: blurred (glow) and sharp."""
    blurred = layer.filter(ImageFilter.GaussianBlur(radius))
    out = Image.alpha_composite(base.convert("RGBA"), blurred)
    return Image.alpha_composite(out, layer)


def label(d: ImageDraw.ImageDraw, xy, text, size, fill=WHITE, path=MONO, anchor="la"):
    d.text(xy, text, font=font(path, size), fill=fill, anchor=anchor)


def corners(d, box, color, s, length=0.22, width=2):
    x0, y0, x1, y1 = box
    lx, ly = (x1 - x0) * length, (y1 - y0) * length
    w = width * s
    for (ax, ay, bx, by) in [(x0, y0, x0 + lx, y0), (x0, y0, x0, y0 + ly), (x1, y0, x1 - lx, y0), (x1, y0, x1, y0 + ly),
                             (x0, y1, x0 + lx, y1), (x0, y1, x0, y1 - ly), (x1, y1, x1 - lx, y1), (x1, y1, x1, y1 - ly)]:
        d.line([(ax, ay), (bx, by)], fill=color, width=w)


def header(d, s, w, title, sub):
    label(d, (56 * s, 48 * s), title, 34 * s, WHITE, SERIF_IT)
    label(d, (58 * s, 98 * s), sub, 13 * s, (150, 150, 150))


# ───────────────────────────────── 1. SurroundSense ─────────────────────────────────

@lru_cache(maxsize=2)
def asphalt(w: int, h: int) -> Image.Image:
    rng = np.random.default_rng(11)
    base = rng.normal(24, 6, (h // 4, w // 4)).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(base, "L").resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(2))
    return Image.merge("RGB", (im, im, im.point(lambda v: min(255, v + 3))))


def car(d, cx, cy, wpx, lpx, body, s, moto=False):
    # shadow
    d.rounded_rectangle([cx - wpx / 2 - 5 * s, cy - lpx / 2 - 3 * s, cx + wpx / 2 + 7 * s, cy + lpx / 2 + 9 * s],
                        radius=wpx * 0.35, fill=(0, 0, 0, 120))
    if moto:
        d.rounded_rectangle([cx - wpx / 2, cy - lpx / 2, cx + wpx / 2, cy + lpx / 2], radius=wpx / 2, fill=body)
        d.ellipse([cx - wpx * 0.55, cy - wpx * 0.6, cx + wpx * 0.55, cy + wpx * 0.5], fill=(40, 40, 44))
        return
    d.rounded_rectangle([cx - wpx / 2, cy - lpx / 2, cx + wpx / 2, cy + lpx / 2], radius=wpx * 0.32, fill=body)
    shade = tuple(max(0, c - 40) for c in body[:3])
    d.rounded_rectangle([cx - wpx * 0.42, cy - lpx * 0.2, cx + wpx * 0.42, cy + lpx * 0.22], radius=wpx * 0.2,
                        fill=tuple(min(255, c + 12) for c in body[:3]))
    d.rounded_rectangle([cx - wpx * 0.4, cy - lpx * 0.33, cx + wpx * 0.4, cy - lpx * 0.19], radius=wpx * 0.12, fill=(18, 22, 28))
    d.rounded_rectangle([cx - wpx * 0.38, cy + lpx * 0.23, cx + wpx * 0.38, cy + lpx * 0.33], radius=wpx * 0.1, fill=(18, 22, 28))
    d.line([(cx - wpx / 2, cy - lpx * 0.05), (cx - wpx / 2, cy + lpx * 0.1)], fill=shade, width=2 * s)
    d.ellipse([cx - wpx * 0.42, cy - lpx / 2 + 2 * s, cx - wpx * 0.22, cy - lpx / 2 + 7 * s], fill=(255, 244, 214))
    d.ellipse([cx + wpx * 0.22, cy - lpx / 2 + 2 * s, cx + wpx * 0.42, cy - lpx / 2 + 7 * s], fill=(255, 244, 214))
    d.rectangle([cx - wpx * 0.42, cy + lpx / 2 - 5 * s, cx - wpx * 0.25, cy + lpx / 2 - 2 * s], fill=(200, 40, 40))
    d.rectangle([cx + wpx * 0.25, cy + lpx / 2 - 5 * s, cx + wpx * 0.42, cy + lpx / 2 - 2 * s], fill=(200, 40, 40))


def fisheye(d, cx, cy, r, s, active):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(20, 22, 26), outline=RED if active else (70, 70, 70), width=2 * s)
    for k in (0.35, 0.65, 0.9):
        d.ellipse([cx - r * k, cy - r * k, cx + r * k, cy + r * k], outline=(55, 58, 64), width=s)
    for a in range(0, 180, 30):
        th = math.radians(a)
        d.line([(cx - r * math.cos(th), cy - r * math.sin(th)), (cx + r * math.cos(th), cy + r * math.sin(th))],
               fill=(45, 48, 54), width=s)


def scene_surround(t: float, W: int, H: int) -> Image.Image:
    s = SS
    w, h = W * s, H * s
    img = asphalt(w, h).copy()
    d = ImageDraw.Draw(img, "RGBA")
    m = h / 32.0  # px per metre (~32 m tall view)
    lane = 3.6 * m
    cx, ey = w * 0.5, h * 0.56
    road_l, road_r = cx - 1.5 * lane, cx + 1.5 * lane
    d.rectangle([road_l - 2.2 * m, 0, road_r + 2.2 * m, h], fill=(30, 31, 34, 255))
    for x in (road_l - 2.2 * m, road_r + 2.2 * m):
        d.rectangle([x - 1.2 * m if x < cx else x, 0, x if x < cx else x + 1.2 * m, h], fill=(22, 28, 22, 255))
    d.line([(road_l, 0), (road_l, h)], fill=(210, 210, 200, 200), width=3 * s)
    d.line([(road_r, 0), (road_r, h)], fill=(210, 210, 200, 200), width=3 * s)
    period = 12 * m
    off = (t * 8 * period) % period  # ego drives forward → markings slide down
    for x in (cx - lane / 2, cx + lane / 2):
        y = -period + off
        while y < h:
            d.rectangle([x - 1.5 * s, y, x + 1.5 * s, y + 4.5 * m], fill=(200, 200, 190, 170))
            y += period

    ew, el = 1.9 * m, 4.7 * m
    top, bot = ey - el / 2, ey + el / 2
    # camera coverage (fisheye fans)
    fans = Image.new("RGBA", img.size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(fans)
    R = 11 * m
    for (px, py, ang) in [(cx, top, -90), (cx, bot, 90), (cx - ew / 2, ey - el * 0.17, 180), (cx + ew / 2, ey - el * 0.17, 0)]:
        fd.pieslice([px - R, py - R, px + R, py + R], ang - 95, ang + 95, fill=(*SKY, 16))
        fd.arc([px - R, py - R, px + R, py + R], ang - 95, ang + 95, fill=(*SKY, 50), width=s)
    img = Image.alpha_composite(img.convert("RGBA"), fans).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")
    # 360° stitched area
    d.rounded_rectangle([cx - 10 * m, ey - 12 * m, cx + 10 * m, ey + 12 * m], radius=2 * m, outline=(*SKY, 70), width=s)
    label(d, (cx - 10 * m + 8 * s, ey - 12 * m + 6 * s), "360° VIEW · STITCHED", 10 * s, (*SKY, 160))

    zones = {"LEFT": [cx - lane * 1.45, ey - el * 0.15, cx - lane * 0.55, bot + 5 * m],
             "RIGHT": [cx + lane * 0.55, ey - el * 0.15, cx + lane * 1.45, bot + 5 * m]}

    def vy(enter, leave):  # overtaking vehicle: bottom → top between two loop times
        u = (t - enter) / (leave - enter)
        return h * 1.15 - u * h * 1.35, 0 <= u <= 1

    others = []
    y1, on1 = vy(0.02, 0.56)
    if on1:
        others.append(("car", cx - lane, y1, 1.85 * m, 4.5 * m, (170, 178, 190, 255), 0.94))
    y2, on2 = vy(0.48, 0.98)
    if on2:
        others.append(("motorbike", cx + lane, y2, 0.8 * m, 2.1 * m, (210, 90, 60, 255), 0.91))
    y3 = h * 0.08 + (t * 0.3 % 1) * 0  # slower car ahead, same lane, fixed gap
    others.append(("car", cx, ey - 15 * m, 1.85 * m, 4.5 * m, (52, 64, 88, 255), 0.97))

    hit = {k: False for k in zones}
    for kind, ox, oy, ow, ol, col, conf in others:
        for k, (zx0, zy0, zx1, zy1) in zones.items():
            if ox + ow / 2 > zx0 and ox - ow / 2 < zx1 and oy + ol / 2 > zy0 and oy - ol / 2 < zy1:
                hit[k] = True
    for k, z in zones.items():
        if hit[k]:
            d.rectangle(z, fill=(*RED, 46))
            d.rectangle(z, outline=(*RED, 200), width=2 * s)
        else:
            d.rectangle(z, outline=(*AMBER, 90), width=s)
    for kind, ox, oy, ow, ol, col, conf in others:
        car(d, ox, oy, ow, ol, col, s, moto=kind == "motorbike")
    car(d, cx, ey, ew, el, (232, 232, 228, 255), s)

    over = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(over)
    for kind, ox, oy, ow, ol, col, conf in others:
        if -ol < oy < h + ol:
            pad = 0.5 * m
            box = [ox - ow / 2 - pad, oy - ol / 2 - pad, ox + ow / 2 + pad, oy + ol / 2 + pad]
            inzone = any(hit[k] and (ox < cx) == (k == "LEFT") for k in zones) and kind != "car" or \
                any(hit[k] and (ox < cx) == (k == "LEFT") for k in zones)
            c = RED if inzone and abs(ox - cx) > lane / 2 else LIVE
            corners(od, box, (*c, 255), s)
            label(od, (box[0], box[1] - 16 * s), f"{kind} · {conf:.2f}", 11 * s, (*c, 255))
            gx = max(0.0, abs(ox - cx) - (ow + ew) / 2) / m
            gy = max(0.0, abs(oy - ey) - (ol + el) / 2) / m
            dist = math.hypot(gx, gy)
            if abs(ox - cx) > lane / 2 and dist < 14:
                od.line([(cx + math.copysign(ew / 2, ox - cx), ey), (ox - math.copysign(ow / 2, ox - cx), oy)],
                        fill=(*c, 140), width=s)
                side = box[0] - 10 * s if ox < cx else box[2] + 10 * s
                label(od, (side, oy), f"{dist:.1f} m", 11 * s, (*c, 230), anchor="rm" if ox < cx else "lm")
    for k, z in zones.items():
        if hit[k]:
            x = z[0] - 12 * s if k == "LEFT" else z[2] + 12 * s
            label(od, (x, z[1] + 10 * s), f"BLIND SPOT · {k}", 13 * s, (*RED, 255), anchor="ra" if k == "LEFT" else "la")
            mx = cx - ew / 2 - 4 * s if k == "LEFT" else cx + ew / 2 + 4 * s
            od.ellipse([mx - 5 * s, ey - el * 0.17 - 5 * s, mx + 5 * s, ey - el * 0.17 + 5 * s], fill=(*AMBER, 255))
    img = glow(img, over, 6 * s).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")

    header(d, s, w, "SurroundSense", "360° BIRD'S-EYE VIEW  ·  BLIND-SPOT MONITORING  ·  FOUR CAMERAS")
    r = 34 * s
    for i, (name, active) in enumerate([("FRONT", False), ("LEFT", hit["LEFT"]), ("RIGHT", hit["RIGHT"]), ("REAR", False)]):
        fx = w - 70 * s - (3 - i) * (2 * r + 22 * s)
        fisheye(d, fx, 90 * s, r, s, active)
        label(d, (fx, 90 * s + r + 14 * s), name, 10 * s, RED if active else DIM, anchor="mm")
    status = "  ".join(f"{k} {'ALERT' if hit[k] else 'CLEAR'}" for k in ("LEFT", "RIGHT"))
    any_hit = any(hit.values())
    d.rounded_rectangle([56 * s, h - 82 * s, 56 * s + 330 * s, h - 46 * s], radius=18 * s,
                        fill=(40, 16, 16, 220) if any_hit else (16, 28, 20, 220), outline=(*(RED if any_hit else LIVE), 160), width=s)
    label(d, (76 * s, h - 64 * s), status, 13 * s, RED if any_hit else LIVE, anchor="lm")
    label(d, (w - 56 * s, h - 64 * s), "REAL TIME · ON THE VEHICLE", 11 * s, DIM, anchor="rm")
    return finish(img.convert("RGB"), W, H, vignette=0.6)


# ───────────────────────────────── 2. Trolley pose ─────────────────────────────────

class Cam:
    def __init__(self, W, H, height=2.4, pitch=0.2, f=0.9):
        self.W, self.H, self.h, self.p, self.f = W, H, height, pitch, f * W

    def proj(self, X, Y, Z):
        # camera at (0, h, 0) looking +Z, pitched down by p
        y = Y - self.h
        c, s_ = math.cos(self.p), math.sin(self.p)
        yc, zc = y * c + Z * s_, -y * s_ + Z * c
        zc = max(zc, 0.05)
        return self.W / 2 + self.f * X / zc, self.H * 0.42 - self.f * yc / zc, zc


def trolley_points(x, z, yaw):
    L, Wd, ph = 1.5, 0.8, 0.38
    c, s_ = math.cos(yaw), math.sin(yaw)

    def at(dx, dy, dz):
        return (x + dx * c - dz * s_, dy, z + dx * s_ + dz * c)

    kp = {
        "p1": at(-L / 2, ph, -Wd / 2), "p2": at(L / 2, ph, -Wd / 2), "p3": at(L / 2, ph, Wd / 2), "p4": at(-L / 2, ph, Wd / 2),
        "w1": at(-L / 2 + 0.1, 0.09, -Wd / 2 + 0.05), "w2": at(L / 2 - 0.1, 0.09, -Wd / 2 + 0.05),
        "w3": at(L / 2 - 0.1, 0.09, Wd / 2 - 0.05), "w4": at(-L / 2 + 0.1, 0.09, Wd / 2 - 0.05),
        "h1": at(-L / 2, 1.05, -Wd / 2 + 0.06), "h2": at(-L / 2, 1.05, Wd / 2 - 0.06),
    }
    return kp


EDGES = [("p1", "p2"), ("p2", "p3"), ("p3", "p4"), ("p4", "p1"), ("p1", "w1"), ("p2", "w2"), ("p3", "w3"), ("p4", "w4"),
         ("p1", "h1"), ("p4", "h2"), ("h1", "h2")]
KP_COL = {"p": LIVE, "w": SKY, "h": AMBER}


def scene_trolley(t: float, W: int, H: int) -> Image.Image:
    s = SS
    w, h = W * s, H * s
    cam = Cam(w, h)
    img = Image.new("RGB", (w, h), (12, 13, 15))
    d = ImageDraw.Draw(img, "RGBA")
    hy = cam.proj(0, 0, 400)[1]
    # back wall / fog
    for i in range(60):
        y = hy - 300 * s + i * 10 * s
        a = int(30 * (1 - abs(i - 30) / 30))
        d.rectangle([0, y, w, y + 10 * s], fill=(40, 46, 54, a))
    # floor
    for X in np.arange(-10, 10.5, 1.0):
        a, b = cam.proj(X, 0, 1.5), cam.proj(X, 0, 40)
        d.line([a[:2], b[:2]], fill=(70, 76, 84, 70), width=s)
    for Z in np.arange(2, 40, 1.0):
        a, b = cam.proj(-10, 0, Z), cam.proj(10, 0, Z)
        d.line([a[:2], b[:2]], fill=(70, 76, 84, int(80 * min(1, 6 / Z))), width=s)
    # safety lane
    for side in (-2.6, 2.6):
        pts = [cam.proj(side, 0, 1.5)[:2], cam.proj(side, 0, 40)[:2], cam.proj(side + 0.12, 0, 40)[:2], cam.proj(side + 0.12, 0, 1.5)[:2]]
        d.polygon(pts, fill=(*AMBER, 70))
    # racks
    for side in (-5.4, 5.4):
        for Z in np.arange(8, 36, 3.2):
            q = [cam.proj(side, 0, Z), cam.proj(side, 3.6, Z), cam.proj(side, 3.6, Z + 2.8), cam.proj(side, 0, Z + 2.8)]
            d.polygon([p[:2] for p in q], fill=(26, 29, 34, 255), outline=(60, 64, 72, 255))
            for lvl in (1.2, 2.4):
                a, b = cam.proj(side, lvl, Z), cam.proj(side, lvl, Z + 2.8)
                d.line([a[:2], b[:2]], fill=(95, 82, 60, 200), width=2 * s)
            for lvl in (0.05, 1.25, 2.45):
                cx_ = (Z + 0.4)
                bx = [cam.proj(side, lvl, cx_), cam.proj(side, lvl + 0.8, cx_), cam.proj(side, lvl + 0.8, cx_ + 1.9), cam.proj(side, lvl, cx_ + 1.9)]
                d.polygon([p[:2] for p in bx], fill=(70, 58, 42, 255))

    trolleys = [(-6 + 12 * t, 6.0, 0.08, "trolley #1"), (5.5 - 11 * t, 11.0, math.pi + 0.12, "trolley #2")]
    over = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(over)
    rng = np.random.default_rng(int(t * 1000))
    for x, z, yaw, name in trolleys:
        kp = trolley_points(x, z, yaw)
        P = {k: cam.proj(*v) for k, v in kp.items()}
        # shadow + body
        sh = [cam.proj(*trolley_points(x + 0.05, z + 0.05, yaw)[k][:1], 0.0, trolley_points(x + 0.05, z + 0.05, yaw)[k][2])
              for k in ("p1", "p2", "p3", "p4")]
        d.polygon([p[:2] for p in sh], fill=(0, 0, 0, 70))
        for a, b in [("p1", "w1"), ("p2", "w2"), ("p3", "w3"), ("p4", "w4"), ("p1", "h1"), ("p4", "h2"), ("h1", "h2")]:
            d.line([P[a][:2], P[b][:2]], fill=(150, 156, 166, 255), width=int(5 * s / max(1, P[a][2] / 6)))
        d.polygon([P[k][:2] for k in ("p1", "p2", "p3", "p4")], fill=(120, 128, 140, 255), outline=(180, 186, 196, 255))
        for k in ("w1", "w2", "w3", "w4"):
            r = 0.09 * cam.f / P[k][2]
            d.ellipse([P[k][0] - r, P[k][1] - r, P[k][0] + r, P[k][1] + r], fill=(20, 20, 22, 255))
        # crate on top
        top = trolley_points(x, z, yaw)
        # track trail on the floor
        trail = [cam.proj(x - (0.8 + i * 0.12) * (1 if math.cos(yaw) > 0 else -1), 0.01, z)[:2] for i in range(10)]
        for i in range(len(trail) - 1):
            od.line([trail[i], trail[i + 1]], fill=(*LIVE, int(140 * (1 - i / 10))), width=2 * s)
        # keypoints + skeleton (tiny jitter like a real detector)
        J = {k: (p[0] + rng.normal(0, 0.6 * s), p[1] + rng.normal(0, 0.6 * s)) for k, p in P.items()}
        for a, b in EDGES:
            od.line([J[a], J[b]], fill=(*LIVE, 200), width=2 * s)
        for k, (px, py) in J.items():
            r = 5 * s
            od.ellipse([px - r, py - r, px + r, py + r], fill=(*KP_COL[k[0]], 255), outline=(10, 10, 10, 255), width=s)
        xs, ys = [p[0] for p in J.values()], [p[1] for p in J.values()]
        box = [min(xs) - 14 * s, min(ys) - 14 * s, max(xs) + 14 * s, max(ys) + 14 * s]
        if box[2] > 0 and box[0] < w:
            corners(od, box, (*LIVE, 230), s)
            label(od, (box[0], box[1] - 18 * s), f"{name} · 10 keypoints", 12 * s, (*LIVE, 255))
    img = glow(img, over, 5 * s).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")
    header(d, s, w, "Edge pose estimation", "INDUSTRIAL TROLLEYS  ·  KEYPOINTS + TRACKING  ·  REAL TIME ON AN EDGE DEVICE")
    # speed panel
    px, py = w - 380 * s, 52 * s
    d.rounded_rectangle([px, py, px + 324 * s, py + 132 * s], radius=14 * s, fill=(16, 17, 20, 230), outline=(50, 52, 58, 255), width=s)
    label(d, (px + 18 * s, py + 18 * s), "SPEED ON THE EDGE DEVICE", 10 * s, DIM)
    for i, (name, val, col) in enumerate([("before", 1.0, (110, 110, 110)), ("optimised", 2.0, LIVE)]):
        y = py + 52 * s + i * 38 * s
        label(d, (px + 18 * s, y), name, 12 * s, WHITE)
        d.rounded_rectangle([px + 110 * s, y + 2 * s, px + 110 * s + 140 * s * val / 2, y + 14 * s], radius=6 * s, fill=(*col, 255))
        label(d, (px + 300 * s, y), f"{val:.1f}×", 12 * s, col, anchor="ra")
    for i, (k, name) in enumerate([("p", "platform"), ("w", "wheels"), ("h", "handle")]):
        x = 58 * s + i * 120 * s
        d.ellipse([x, h - 70 * s, x + 10 * s, h - 60 * s], fill=(*KP_COL[k], 255))
        label(d, (x + 18 * s, h - 65 * s), name, 11 * s, DIM, anchor="lm")
    return finish(img.convert("RGB"), W, H, vignette=0.5)


# ───────────────────────────────── 3. Calibration ─────────────────────────────────

def turbo(x: float):
    x = min(1, max(0, x))
    r = 34.61 + x * (1172.33 - x * (10793.56 - x * (33300.12 - x * (38394.49 - x * 14825.05))))
    g = 23.31 + x * (557.33 + x * (1225.33 - x * (3574.96 - x * (1073.77 + x * 707.56))))
    b = 27.2 + x * (3211.1 - x * (15327.97 - x * (27814 - x * (22569.18 - x * 6838.66))))
    return tuple(int(min(255, max(0, v))) for v in (r, g, b))


@lru_cache(maxsize=2)
def calib_static(w: int, h: int):
    s = SS
    cam = Cam(w, h, height=1.5, pitch=0.06, f=0.75)
    # camera frame: low-light corridor, soft shapes
    im = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(im)
    hy = cam.proj(0, 0, 300)[1]
    for i in range(int(h)):
        v = 28 + 22 * math.exp(-((i - hy) / (h * 0.25)) ** 2) if i < hy else 34 + 30 * (i - hy) / (h - hy)
        d.line([(0, i), (w, i)], fill=int(v))
    # walls
    for side in (-3.0, 3.0):
        q = [cam.proj(side, 0, 2), cam.proj(side, 3.2, 2), cam.proj(side, 3.2, 40), cam.proj(side, 0, 40)]
        d.polygon([p[:2] for p in q], fill=46)
    # pillar
    q = [cam.proj(1.6, 0, 7), cam.proj(1.6, 3.2, 7), cam.proj(2.2, 3.2, 7), cam.proj(2.2, 0, 7)]
    d.polygon([p[:2] for p in q], fill=70)
    # boxes
    q = [cam.proj(-2.4, 0, 9), cam.proj(-2.4, 1.0, 9), cam.proj(-1.3, 1.0, 9), cam.proj(-1.3, 0, 9)]
    d.polygon([p[:2] for p in q], fill=62)
    # person
    px, pz = -0.5, 4.5
    head = cam.proj(px, 1.62, pz)
    rr = 0.12 * cam.f / pz
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    for dd in (d, md):
        fill = 96 if dd is d else 255
        dd.ellipse([head[0] - rr, head[1] - rr * 1.15, head[0] + rr, head[1] + rr * 1.15], fill=fill)
        sh, hip = cam.proj(px, 1.45, pz), cam.proj(px, 0.85, pz)
        bw = 0.24 * cam.f / pz
        dd.rounded_rectangle([sh[0] - bw, sh[1], sh[0] + bw, hip[1]], radius=bw * 0.5, fill=fill)
        foot = cam.proj(px, 0.0, pz)
        lw = 0.09 * cam.f / pz
        dd.rectangle([hip[0] - bw * 0.75, hip[1] - 5, hip[0] - bw * 0.75 + 2 * lw, foot[1]], fill=fill)
        dd.rectangle([hip[0] + bw * 0.75 - 2 * lw, hip[1] - 5, hip[0] + bw * 0.75, foot[1]], fill=fill)
    im = im.filter(ImageFilter.GaussianBlur(3 * s))
    rng = np.random.default_rng(5)
    a = np.asarray(im).astype(np.float32) + rng.normal(0, 7, (h, w))
    frame = Image.fromarray(a.clip(0, 255).astype(np.uint8)).convert("RGB")
    frame = Image.merge("RGB", [frame.getchannel(0), frame.getchannel(1).point(lambda v: v + 4), frame.getchannel(2).point(lambda v: v + 10)])
    # LiDAR points (camera-frame 3D), drawn after projection
    pts = []
    for ring in range(16):
        elev = math.radians(-15 + ring * 1.1)
        for az in np.arange(-45, 45, 0.35):
            th = math.radians(az)
            # ray from sensor at height 1.6
            dx, dy, dz = math.sin(th) * math.cos(elev), math.sin(elev), math.cos(th) * math.cos(elev)
            best = None
            if dy < 0:
                tt = 1.6 / -dy
                best = (tt, "floor")
            for side in (-3.0, 3.0):
                if dx != 0:
                    tt = side / dx
                    if tt > 0 and 1.6 + dy * tt < 3.2 and (best is None or tt < best[0]):
                        best = (tt, "wall")
            # person cylinder
            parts = [(px, pz, 0.105, 1.50, 1.75, "person"), (px, pz, 0.22, 0.86, 1.45, "person"),
                     (px - 0.09, pz, 0.08, 0.0, 0.86, "person"), (px + 0.09, pz, 0.08, 0.0, 0.86, "person"),
                     (1.9, 7.3, 0.32, 0.0, 3.2, "pillar")]
            for (cxp, czp, rad, bottom, top, kind) in parts:
                # ray (dx, dz)·t hits the vertical cylinder: |(dx t − cx, dz t − cz)| = r
                A = dx * dx + dz * dz
                B = -2 * (dx * cxp + dz * czp)
                C = cxp * cxp + czp * czp - rad * rad
                disc = B * B - 4 * A * C
                if disc >= 0:
                    tt = (-B - math.sqrt(disc)) / (2 * A)
                    Y = 1.6 + dy * tt
                    if tt > 0 and bottom < Y < top and (best is None or tt < best[0]):
                        best = (tt, kind)
            if best and best[0] < 22:
                tt, kind = best
                X, Y, Z = dx * tt, 1.6 + dy * tt, dz * tt
                pts.append((X, Y, Z, kind))
    proj = []
    noise = np.random.default_rng(9)
    for X, Y, Z, kind in pts:
        u, v, z = cam.proj(X, Y, Z)
        # range noise + a little residual extrinsic error, like a real sensor after calibration
        proj.append((u + noise.normal(0, 2.2 * s), v + noise.normal(0, 2.2 * s), z, kind))
    return frame, mask, proj


def scene_calib(t: float, W: int, H: int) -> Image.Image:
    s = SS
    w, h = W * s, H * s
    frame, mask, proj = calib_static(w, h)
    img = frame.convert("RGBA")
    # error schedule: misaligned → converge → hold → quick reset
    if t < 0.12:
        e = 1.0
    elif t < 0.62:
        e = 1 - ease((t - 0.12) / 0.5)
    elif t < 0.92:
        e = 0.0
    else:
        e = ease((t - 0.92) / 0.08)
    theta, tx, ty, sc = math.radians(4.5) * e, 70 * s * e, -38 * s * e, 1 + 0.05 * e
    cx, cy = w / 2, h / 2
    ct, st = math.cos(theta), math.sin(theta)
    m = np.asarray(mask)
    seg = Image.new("RGBA", img.size, (0, 0, 0, 0))
    seg.paste((*LIVE, 60), (0, 0), mask)
    edge = mask.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 40 else 0)
    seg.paste((*LIVE, 220), (0, 0), edge)
    img = Image.alpha_composite(img, seg)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    inside = total = 0
    for u, v, z, kind in proj:
        x0, y0 = (u - cx) * sc, (v - cy) * sc
        x, y = cx + x0 * ct - y0 * st + tx, cy + x0 * st + y0 * ct + ty
        if not (0 <= x < w and 0 <= y < h):
            continue
        col = turbo(1 - min(1, (z - 2) / 16))
        r = 1.6 * s if kind != "person" else 2.0 * s
        ld.ellipse([x - r, y - r, x + r, y + r], fill=(*col, 235))
        if kind == "person":
            total += 1
            inside += m[int(y), int(x)] > 0
    img = glow(img, layer, 3 * s).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")
    ov = inside / max(1, total)
    header(d, s, w, "Camera–LiDAR calibration", "TARGETLESS  ·  NO BOARD  ·  SCAN PROJECTED ONTO THE CAMERA IMAGE")
    px, py = w - 380 * s, 52 * s
    d.rounded_rectangle([px, py, px + 324 * s, py + 132 * s], radius=14 * s, fill=(16, 17, 20, 230), outline=(50, 52, 58, 255), width=s)
    label(d, (px + 18 * s, py + 18 * s), "POINTS ON THE PERSON MASK", 10 * s, DIM)
    col = LIVE if ov > 0.9 else AMBER
    label(d, (px + 18 * s, py + 44 * s), f"{ov * 100:4.1f}%", 34 * s, col, SANS_BOLD)
    d.rounded_rectangle([px + 18 * s, py + 104 * s, px + 306 * s, py + 112 * s], radius=4 * s, fill=(40, 40, 44, 255))
    d.rounded_rectangle([px + 18 * s, py + 104 * s, px + 18 * s + 288 * s * ov, py + 112 * s], radius=4 * s, fill=(*col, 255))
    state = "ALIGNED" if e < 0.02 else ("ALIGNING…" if t < 0.92 else "RESET")
    label(d, (58 * s, h - 66 * s), state, 13 * s, LIVE if state == "ALIGNED" else AMBER, anchor="lm")
    for i in range(6):
        c = turbo(i / 5)
        d.rectangle([w - 260 * s + i * 30 * s, h - 72 * s, w - 230 * s + i * 30 * s, h - 62 * s], fill=c)
    label(d, (w - 266 * s, h - 67 * s), "far", 10 * s, DIM, anchor="rm")
    label(d, (w - 56 * s, h - 67 * s), "near", 10 * s, DIM, anchor="rm")
    return finish(img.convert("RGB"), W, H, vignette=0.45, grain_amt=9)


# ───────────────────────────────── 4. Visual SLAM → navigation ─────────────────────────────────

ROOM_W, ROOM_D, ROOM_H = 6.4, 4.8, 2.5
FURNITURE = [  # (x, y, w, d, h, colour hint)
    (0.3, 0.3, 2.2, 0.9, 0.85, "sofa"), (2.9, 1.7, 1.2, 0.8, 0.75, "table"), (4.6, 0.3, 1.5, 2.0, 0.55, "bed"),
    (0.2, 3.9, 1.6, 0.5, 1.9, "shelf"), (5.6, 3.6, 0.6, 0.9, 1.1, "cabinet"), (2.4, 4.2, 1.0, 0.45, 0.9, "desk"),
]


@lru_cache(maxsize=1)
def slam_world():
    rng = np.random.default_rng(21)
    pts = []
    def surf(n, f):
        for _ in range(n):
            pts.append(f())
    # walls with a door and a window gap
    for _ in range(9000):
        side = rng.integers(4)
        z = rng.uniform(0, ROOM_H)
        if side == 0:
            x, y = rng.uniform(0, ROOM_W), 0.0
            if 2.6 < x < 3.6 and 0.9 < z < 2.0:
                continue
        elif side == 1:
            x, y = rng.uniform(0, ROOM_W), ROOM_D
            if 3.6 < x < 4.6 and z < 2.1:
                continue
        elif side == 2:
            x, y = 0.0, rng.uniform(0, ROOM_D)
        else:
            x, y = ROOM_W, rng.uniform(0, ROOM_D)
        pts.append((x + rng.normal(0, 0.01), y + rng.normal(0, 0.01), z))
    for _ in range(5000):
        pts.append((rng.uniform(0, ROOM_W), rng.uniform(0, ROOM_D), abs(rng.normal(0, 0.008))))
    for (fx, fy, fw, fd, fh, _) in FURNITURE:
        for _ in range(int(900 * (fw * fd + fh))):
            face = rng.integers(5)
            u, v = rng.uniform(0, 1), rng.uniform(0, 1)
            if face == 0:
                p = (fx + u * fw, fy + v * fd, fh)
            elif face == 1:
                p = (fx + u * fw, fy, v * fh)
            elif face == 2:
                p = (fx + u * fw, fy + fd, v * fh)
            elif face == 3:
                p = (fx, fy + u * fd, v * fh)
            else:
                p = (fx + fw, fy + u * fd, v * fh)
            pts.append(p)
    P = np.array(pts, dtype=np.float32)
    # camera path: a loop through the free space
    ts = np.linspace(0, 2 * math.pi, 240)
    path = np.stack([3.2 + 1.9 * np.cos(ts) + 0.3 * np.sin(2 * ts), 2.45 + 1.0 * np.sin(ts), np.full_like(ts, 1.2)], 1)
    # each point appears when the camera first passes within view (closest path index, roughly)
    d = ((P[:, None, :2] - path[None, ::6, :2]) ** 2).sum(-1)
    order = d.argmin(1) * 6 + rng.integers(0, 12, len(P))
    # occupancy grid (10 cm) + path planning
    res = 0.1
    gw, gh = int(ROOM_W / res), int(ROOM_D / res)
    occ = np.zeros((gh, gw), bool)
    occ[0, :] = occ[-1, :] = True
    occ[:, 0] = occ[:, -1] = True
    for (fx, fy, fw, fd, fh, _) in FURNITURE:
        occ[int(fy / res):int((fy + fd) / res) + 1, int(fx / res):int((fx + fw) / res) + 1] = True
    infl = occ.copy()
    for _ in range(3):
        g = infl.copy()
        g[1:, :] |= infl[:-1, :]; g[:-1, :] |= infl[1:, :]; g[:, 1:] |= infl[:, :-1]; g[:, :-1] |= infl[:, 1:]
        infl = g
    def free_near(xm, ym):  # nearest cell outside the keep-out margin
        best = None
        for yy in range(gh):
            for xx in range(gw):
                if not infl[yy, xx]:
                    dd = (xx * res - xm) ** 2 + (yy * res - ym) ** 2
                    if best is None or dd < best[0]:
                        best = (dd, (yy, xx))
        return best[1]
    start, goal = free_near(0.8, 2.5), free_near(5.0, 3.1)
    from collections import deque
    prev = {start: None}
    q = deque([start])
    while q:
        c = q.popleft()
        if c == goal:
            break
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            n = (c[0] + dy, c[1] + dx)
            if 0 <= n[0] < gh and 0 <= n[1] < gw and not infl[n] and n not in prev:
                prev[n] = c
                q.append(n)
    route = []
    c = goal if goal in prev else None
    while c:
        route.append(c)
        c = prev[c]
    route = route[::-1]
    return P, path, order, occ, infl, route


def scene_slam(t: float, W: int, H: int) -> Image.Image:
    s = SS
    w, h = W * s, H * s
    P, path, order, occ, infl, route = slam_world()
    img = Image.new("RGB", (w, h), (10, 11, 13))
    d = ImageDraw.Draw(img, "RGBA")
    build = min(1.0, t / 0.55)
    n_path = len(path)
    upto = build * n_path
    yaw = math.radians(-38 + 14 * math.sin(2 * math.pi * t))
    el = math.radians(34)
    k = 118 * s
    ox, oy = w * 0.34, h * 0.6
    cx, cy = ROOM_W / 2, ROOM_D / 2

    def iso(x, y, z):
        x, y = x - cx, y - cy
        xr, yr = x * math.cos(yaw) - y * math.sin(yaw), x * math.sin(yaw) + y * math.cos(yaw)
        return ox + xr * k, oy + yr * math.sin(el) * k - z * math.cos(el) * k, yr

    vis = P[order <= upto]
    xs, ys = vis[:, 0] - cx, vis[:, 1] - cy
    xr = xs * math.cos(yaw) - ys * math.sin(yaw)
    yr = xs * math.sin(yaw) + ys * math.cos(yaw)
    U = ox + xr * k
    V = oy + yr * math.sin(el) * k - vis[:, 2] * math.cos(el) * k
    idx = np.argsort(yr)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    r = 1.35 * s
    for i in idx:
        z = vis[i, 2]
        col = turbo(0.15 + 0.75 * min(1, z / ROOM_H))
        ld.ellipse([U[i] - r, V[i] - r, U[i] + r, V[i] + r], fill=(*col, 205))
    # trajectory + keyframes
    m = max(2, int(upto))
    tr = [iso(*path[i])[:2] for i in range(min(m, n_path))]
    if len(tr) > 1:
        ld.line(tr, fill=(*WHITE, 200), width=2 * s)
    for i in range(0, min(m, n_path), 16):
        x0, y0, _ = iso(*path[i])
        ld.rectangle([x0 - 4 * s, y0 - 3 * s, x0 + 4 * s, y0 + 3 * s], outline=(*SKY, 230), width=s)
    if build < 1:
        x0, y0, _ = iso(*path[min(m, n_path - 1)])
        ld.ellipse([x0 - 7 * s, y0 - 7 * s, x0 + 7 * s, y0 + 7 * s], fill=(*LIVE, 255))
        label(ld, (x0 + 12 * s, y0 - 10 * s), "camera", 11 * s, (*LIVE, 255))
    img = glow(img, layer, 2 * s).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")

    # navigation map (right)
    gh, gw = occ.shape
    cell = 8 * s
    mx, my = w * 0.64, h * 0.27
    reveal_cols = int(gw * min(1.0, t / 0.55)) if t < 0.55 else gw
    for yy in range(gh):
        for xx in range(gw):
            x0, y0 = mx + xx * cell, my + (gh - 1 - yy) * cell
            if xx > reveal_cols:
                col = (22, 23, 26)
            elif occ[yy, xx]:
                col = (236, 234, 228)
            elif infl[yy, xx]:
                col = (70, 52, 92)
            else:
                col = (44, 47, 54)
            d.rectangle([x0, y0, x0 + cell, y0 + cell], fill=col)
    if t >= 0.55 and route:
        pts = [(mx + c[1] * cell + cell / 2, my + (gh - 1 - c[0]) * cell + cell / 2) for c in route]
        d.line(pts, fill=(*LIVE, 255), width=3 * s)
        u = min(1.0, (t - 0.58) / 0.38) if t > 0.58 else 0
        j = int(u * (len(pts) - 1))
        rx, ry = pts[j]
        d.ellipse([rx - 9 * s, ry - 9 * s, rx + 9 * s, ry + 9 * s], fill=(*SKY, 255), outline=(10, 10, 10, 255), width=2 * s)
        gx, gy = pts[-1]
        d.line([(gx, gy), (gx, gy - 22 * s)], fill=(*AMBER, 255), width=2 * s)
        d.polygon([(gx, gy - 22 * s), (gx + 14 * s, gy - 17 * s), (gx, gy - 12 * s)], fill=(*AMBER, 255))
    label(d, (mx, my - 30 * s), "NAVIGATION MAP  ·  PLANNED ROUTE", 11 * s, DIM)
    for i, (nm, col) in enumerate([("free", (44, 47, 54)), ("obstacle", (236, 234, 228)), ("keep-out margin", (70, 52, 92)), ("route", LIVE)]):
        lx = mx + i * 120 * s
        d.rectangle([lx, my + gh * cell + 18 * s, lx + 12 * s, my + gh * cell + 30 * s], fill=col)
        label(d, (lx + 18 * s, my + gh * cell + 24 * s), nm, 10 * s, (120, 120, 120), anchor="lm")

    header(d, s, w, "Visual SLAM → navigation", "A CAMERA MAPS THE ROOM IN 3D  ·  THE MAP BECOMES A ROUTE  ·  THE ROBOT DRIVES ITSELF")
    state = f"MAPPING  {int(build * 100):3d}%" if build < 1 else ("NAVIGATING" if t > 0.58 else "MAP COMPLETE")
    label(d, (58 * s, h - 66 * s), state, 13 * s, LIVE if build >= 1 else AMBER, anchor="lm")
    a = 1.0
    if t > 0.95:
        a = 1 - (t - 0.95) / 0.05
    elif t < 0.03:
        a = t / 0.03
    out = finish(img, W, H, vignette=0.5)
    if a < 1:
        out = Image.blend(Image.new("RGB", out.size, (10, 11, 13)), out, a)
    return out


# ───────────────────────────────── 5. Edge AI module ─────────────────────────────────

C30, S30 = math.cos(math.radians(30)), math.sin(math.radians(30))


def shade(c, f):
    return tuple(int(max(0, min(255, v * f))) for v in c)


def scene_edge(t: float, W: int, H: int) -> Image.Image:
    s = SS
    w, h = W * s, H * s
    img = Image.new("RGB", (w, h), (11, 12, 14))
    d = ImageDraw.Draw(img, "RGBA")
    # soft floor glow
    for i in range(40):
        rr = (40 - i) * 22 * s
        d.ellipse([w * 0.42 - rr, h * 0.7 - rr * 0.38, w * 0.42 + rr, h * 0.7 + rr * 0.38], fill=(40, 60, 50, 3))
    k = 46 * s
    ox, oy = w * 0.42, h * 0.62

    def P(x, y, z):
        return (ox + (x - y) * C30 * k, oy + (x + y) * S30 * k - z * k)

    def box(x, y, z, dx, dy, dz, col, top=1.0, left=0.72, right=0.52, outline=None):
        t_ = [P(x, y, z + dz), P(x + dx, y, z + dz), P(x + dx, y + dy, z + dz), P(x, y + dy, z + dz)]
        l_ = [P(x, y + dy, z), P(x + dx, y + dy, z), P(x + dx, y + dy, z + dz), P(x, y + dy, z + dz)]
        r_ = [P(x + dx, y, z), P(x + dx, y + dy, z), P(x + dx, y + dy, z + dz), P(x + dx, y, z + dz)]
        d.polygon(l_, fill=shade(col, left), outline=outline)
        d.polygon(r_, fill=shade(col, right), outline=outline)
        d.polygon(t_, fill=shade(col, top), outline=outline)

    # carrier board
    box(-4.2, -3.2, 0, 8.4, 6.4, 0.18, (22, 40, 32), outline=(40, 64, 52))
    for i in range(12):  # traces
        a, b = P(-3.8 + i * 0.6, -2.9, 0.181), P(-3.8 + i * 0.6, -2.9 + 1.2 + (i % 3) * 0.4, 0.181)
        d.line([a, b], fill=(46, 84, 66), width=s)
    for i in range(20):  # GPIO header
        for j in range(2):
            box(-3.6 + i * 0.32, 2.4 + j * 0.3, 0.18, 0.16, 0.16, 0.22, (186, 150, 70))
    # ports on the front-right edge (x = +4.2 face)
    for i, (dy, dz, col) in enumerate([(0.9, 0.55, (70, 120, 200)), (0.9, 0.55, (70, 120, 200)), (1.1, 0.75, (120, 120, 120)), (0.8, 0.35, (60, 60, 60)), (0.5, 0.5, (40, 40, 40))]):
        y0 = -2.8 + sum(x[0] + 0.25 for x in [(0.9, 0, 0), (0.9, 0, 0), (1.1, 0, 0), (0.8, 0, 0), (0.5, 0, 0)][:i])
        box(3.6, y0, 0.18, 0.75, dy, dz, (170, 172, 176))
        box(4.25, y0 + 0.12, 0.26, 0.02, dy - 0.24, dz - 0.18, col)
    # module + heatsink
    box(-2.6, -2.2, 0.18, 5.0, 4.0, 0.25, (30, 32, 36))
    die_glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(die_glow)
    pulse = 0.65 + 0.35 * math.sin(2 * math.pi * t * 3)
    cxg, cyg = P(-0.1, -0.2, 0.6)
    for rr, a in ((180, 30), (120, 50), (70, 90)):
        gd.ellipse([cxg - rr * s, cyg - rr * s * 0.6, cxg + rr * s, cyg + rr * s * 0.6], fill=(*LIVE, int(a * pulse)))
    img.paste(Image.alpha_composite(img.convert("RGBA"), die_glow.filter(ImageFilter.GaussianBlur(28 * s))).convert("RGB"))
    d = ImageDraw.Draw(img, "RGBA")
    box(-2.4, -2.0, 0.43, 4.6, 3.6, 0.12, (150, 154, 160))
    for i in range(17):  # fins, back to front
        box(-2.35 + i * 0.27, -2.0, 0.55, 0.07, 3.6, 1.15, (176, 180, 188), top=1.1, left=0.8, right=0.58)
    # fan
    fc = P(-0.1, -0.2, 1.72)
    R = 1.35 * k
    d.ellipse([fc[0] - R, fc[1] - R * 0.58, fc[0] + R, fc[1] + R * 0.58], fill=(24, 25, 28), outline=(90, 92, 98), width=2 * s)
    for b in range(7):
        a = 2 * math.pi * (b / 7 + t * 2)
        d.line([fc, (fc[0] + math.cos(a) * R * 0.9, fc[1] + math.sin(a) * R * 0.52)], fill=(70, 72, 78), width=7 * s)
    d.ellipse([fc[0] - R * 0.22, fc[1] - R * 0.13, fc[0] + R * 0.22, fc[1] + R * 0.13], fill=(40, 42, 46))
    # the model running inside: layers floating above, data pulsing through
    net = Image.new("RGBA", img.size, (0, 0, 0, 0))
    nd = ImageDraw.Draw(net)
    layers = [(-1.6, 6), (-0.8, 9), (0.0, 11), (0.8, 9), (1.6, 5)]
    base = P(-0.1, -0.2, 2.2)
    nodes = []
    for li, (lx, cnt) in enumerate(layers):
        col_nodes = []
        for ni in range(cnt):
            z = 2.8 + (ni - (cnt - 1) / 2) * 0.46 + 2.4
            px_, py_ = P(lx * 1.6 - 0.1, -lx * 0.9 - 0.2, z)
            col_nodes.append((px_, py_))
        nodes.append(col_nodes)
        xs_ = [p[0] for p in col_nodes]; ys_ = [p[1] for p in col_nodes]
        nd.rounded_rectangle([min(xs_) - 14 * s, min(ys_) - 14 * s, max(xs_) + 14 * s, max(ys_) + 14 * s], radius=10 * s,
                             outline=(*SKY, 60), width=s, fill=(*SKY, 10))
    for a_, b_ in zip(nodes[:-1], nodes[1:]):
        for p1 in a_:
            for p2 in b_:
                nd.line([p1, p2], fill=(*SKY, 22), width=s)
    for li in range(len(nodes) - 1):
        for e in range(5):
            ph = (t * 4 + e / 5 + li * 0.13) % 1
            p1 = nodes[li][(e * 3 + li) % len(nodes[li])]
            p2 = nodes[li + 1][(e * 5 + 2 * li) % len(nodes[li + 1])]
            x_, y_ = p1[0] + (p2[0] - p1[0]) * ph, p1[1] + (p2[1] - p1[1]) * ph
            nd.ellipse([x_ - 4 * s, y_ - 4 * s, x_ + 4 * s, y_ + 4 * s], fill=(*LIVE, 255))
    for col_nodes in nodes:
        for (x_, y_) in col_nodes:
            nd.ellipse([x_ - 5 * s, y_ - 5 * s, x_ + 5 * s, y_ + 5 * s], fill=(*WHITE, 230))
    # beam from the chip up into the network
    nd.line([P(-0.1, -0.2, 1.8), (nodes[2][len(nodes[2]) // 2][0], nodes[2][-1][1])], fill=(*LIVE, 70), width=3 * s)
    img = glow(img, net, 7 * s).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")

    header(d, s, w, "Edge AI acceleration", "QUANTIZATION + COMPILATION  ·  THE MODEL RUNS ON THE ROBOT'S OWN HARDWARE")
    precs = [("FP32", 1.0, 1.0), ("FP16", 0.5, 0.6), ("BF16", 0.5, 0.55), ("INT8", 0.25, 0.4)]
    cur = int(t * 4) % 4
    px, py = w - 400 * s, 52 * s
    d.rounded_rectangle([px, py, px + 344 * s, py + 210 * s], radius=14 * s, fill=(16, 17, 20, 235), outline=(50, 52, 58, 255), width=s)
    label(d, (px + 18 * s, py + 18 * s), "PRECISION, CHOSEN PER JOB", 10 * s, DIM)
    for i, (name, size, lat) in enumerate(precs):
        x = px + 18 * s + i * 78 * s
        on = i == cur
        d.rounded_rectangle([x, py + 42 * s, x + 66 * s, py + 72 * s], radius=15 * s, fill=(*LIVE, 255) if on else (30, 31, 35, 255))
        label(d, (x + 33 * s, py + 57 * s), name, 12 * s, (10, 10, 10) if on else (150, 150, 150), anchor="mm")
    _, size, lat = precs[cur]
    for j, (nm, v) in enumerate([("model size", size), ("time per frame", lat)]):
        y = py + 100 * s + j * 40 * s
        label(d, (px + 18 * s, y), nm, 11 * s, WHITE)
        d.rounded_rectangle([px + 140 * s, y + 2 * s, px + 326 * s, y + 14 * s], radius=6 * s, fill=(36, 37, 41, 255))
        d.rounded_rectangle([px + 140 * s, y + 2 * s, px + 140 * s + 186 * s * v, y + 14 * s], radius=6 * s, fill=(*LIVE, 255))
    label(d, (px + 18 * s, py + 186 * s), "illustrative · real figures are measured per model", 9 * s, (95, 95, 95))
    steps = ["camera", "detect", "track", "plan"]
    for i, st in enumerate(steps):
        x = 58 * s + i * 130 * s
        on = int(t * 12) % 4 >= i
        d.ellipse([x, h - 72 * s, x + 10 * s, h - 62 * s], fill=(*LIVE, 255) if on else (60, 60, 60, 255))
        label(d, (x + 18 * s, h - 67 * s), st, 11 * s, WHITE if on else DIM, anchor="lm")
        if i < 3:
            d.line([(x + 80 * s, h - 67 * s), (x + 118 * s, h - 67 * s)], fill=(70, 70, 70), width=s)
    return finish(img, W, H, vignette=0.5)


# ───────────────────────────────── 6. AMR front camera (card preview) ─────────────────────────────────

def light_layer(layer: Image.Image, box, strength=0.55) -> Image.Image:
    """Directional light within an object layer: top-left lit, bottom-right in shade, plus a soft rim."""
    w, h = layer.size
    x0, y0, x1, y1 = [int(v) for v in box]
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
    if x1 <= x0 or y1 <= y0:
        return layer
    a = np.asarray(layer).astype(np.float32)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    u = (xx - x0) / max(1, x1 - x0)
    v = (yy - y0) / max(1, y1 - y0)
    g = 1.18 - strength * (0.55 * u + 0.45 * v)
    a[y0:y1, x0:x1, :3] *= g[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")


def _person(layer: Image.Image, cam: "Cam", X: float, Z: float, s: int, jacket, vest=True, stride=0.0):
    """A standing/walking worker, projected from metres. Returns the 2D bounding box."""
    d = ImageDraw.Draw(layer, "RGBA")
    def pt(x, y):
        u, v, _ = cam.proj(X + x, y, Z)
        return (u, v)
    skin, hair, trousers, shoe = (150, 112, 88), (28, 24, 22), (34, 38, 48), (18, 18, 20)
    # legs (slight stride)
    for side, k in ((-1, stride), (1, -stride)):
        hip, knee, ankle = pt(side * 0.09, 0.93), pt(side * 0.1 + k * 0.12, 0.5), pt(side * 0.1 + k * 0.22, 0.08)
        w = 0.075 * cam.f / Z
        d.polygon([(hip[0] - w, hip[1]), (hip[0] + w, hip[1]), (knee[0] + w * 0.85, knee[1]), (ankle[0] + w * 0.7, ankle[1]),
                   (ankle[0] - w * 0.7, ankle[1]), (knee[0] - w * 0.85, knee[1])], fill=(*trousers, 255))
        toe = pt(side * 0.1 + k * 0.22 + 0.02, 0.0)
        d.rounded_rectangle([ankle[0] - w * 0.9, ankle[1] - w * 0.2, toe[0] + w * 1.3, toe[1] + w * 0.25], radius=w * 0.4, fill=(*shoe, 255))
    # torso
    sh_l, sh_r, hip_l, hip_r = pt(-0.21, 1.46), pt(0.21, 1.46), pt(-0.17, 0.9), pt(0.17, 0.9)
    d.polygon([sh_l, sh_r, hip_r, hip_l], fill=(*jacket, 255))
    if vest:
        vl, vr, vbl, vbr = pt(-0.17, 1.42), pt(0.17, 1.42), pt(-0.16, 0.98), pt(0.16, 0.98)
        d.polygon([vl, vr, vbr, vbl], fill=(222, 196, 40, 235))
        for yb in (1.12, 1.2):
            a, b = pt(-0.165, yb), pt(0.165, yb)
            d.line([a, b], fill=(225, 228, 230, 255), width=max(1, int(0.03 * cam.f / Z)))
    # arms
    for side in (-1, 1):
        a, e, h = pt(side * 0.23, 1.42), pt(side * 0.27, 1.12), pt(side * 0.26, 0.86)
        w = 0.05 * cam.f / Z
        d.line([a, e, h], fill=(*jacket, 255), width=int(w * 2), joint="curve")
        d.ellipse([h[0] - w, h[1] - w, h[0] + w, h[1] + w], fill=(*skin, 255))
    # neck + head + hair
    hc = pt(0.0, 1.63)
    r = 0.105 * cam.f / Z
    nk = pt(0, 1.5)
    d.rectangle([nk[0] - r * 0.35, nk[1] - r * 0.5, nk[0] + r * 0.35, nk[1] + r * 0.4], fill=(*skin, 255))
    d.ellipse([hc[0] - r * 0.85, hc[1] - r, hc[0] + r * 0.85, hc[1] + r * 1.05], fill=(*skin, 255))
    d.chord([hc[0] - r * 0.9, hc[1] - r * 1.08, hc[0] + r * 0.9, hc[1] + r * 0.6], 180, 360, fill=(*hair, 255))
    # side shading (key light from the left)
    xs = [sh_l[0], sh_r[0]]
    top, bottom = hc[1] - r, pt(0, 0)[1]
    sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([(xs[0] + xs[1]) / 2, top, xs[1] + r, bottom], fill=(0, 0, 0, 70))
    mask = layer.getchannel("A")
    layer.paste(Image.alpha_composite(layer, Image.composite(sh, Image.new("RGBA", layer.size, (0, 0, 0, 0)), mask)), (0, 0))
    left, right = min(sh_l[0], hip_l[0], pt(-0.3, 1.1)[0]), max(sh_r[0], hip_r[0], pt(0.3, 1.1)[0])
    return [left, top, right, bottom]


def scene_frontcam(t: float, W: int, H: int):
    s = SS
    w, h = W * s, H * s
    cam = Cam(w, h, height=0.62, pitch=-0.075, f=0.62)
    img = Image.new("RGB", (w, h), (18, 20, 22))
    d = ImageDraw.Draw(img, "RGBA")
    hy = cam.proj(0, 0.62, 300)[1]
    # ceiling + back wall + floor tone
    d.rectangle([0, 0, w, hy], fill=(26, 28, 31))
    for i in range(int(h - hy)):
        v = int(40 + 26 * (1 - i / (h - hy)))
        d.line([(0, hy + i), (w, hy + i)], fill=(v, v + 2, v + 4))
    # ceiling lights (two rows) and their floor reflections
    lights = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(lights)
    for x in (-1.2, 1.2):
        for Z in np.arange(3, 40, 4.0):
            a, b = cam.proj(x - 0.5, 5.0, Z), cam.proj(x + 0.5, 5.0, Z + 0.25)
            ld.rectangle([min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])], fill=(255, 250, 235, 255))
            f1, f2 = cam.proj(x - 0.35, 0, Z), cam.proj(x + 0.35, 0, Z + 0.6)
            ld.ellipse([min(f1[0], f2[0]), min(f1[1], f2[1]), max(f1[0], f2[0]), max(f1[1], f2[1])], fill=(255, 248, 230, 40))
    img = Image.alpha_composite(img.convert("RGBA"), lights.filter(ImageFilter.GaussianBlur(10 * s))).convert("RGB")
    img = Image.alpha_composite(img.convert("RGBA"), lights).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")
    # floor lane markings
    for side in (-1.55, 1.55):
        q = [cam.proj(side, 0, 0.6), cam.proj(side, 0, 40), cam.proj(side + 0.1, 0, 40), cam.proj(side + 0.1, 0, 0.6)]
        d.polygon([p[:2] for p in q], fill=(200, 168, 60, 170))
    # racks both sides with cartons
    rng = np.random.default_rng(4)
    for side in (-2.4, 2.4):
        for Z in np.arange(1.5, 40, 2.7):
            for lvl in (0.0, 1.3, 2.6):
                for k in range(2):
                    z0 = Z + 0.15 + k * 1.25
                    bw, bh = 1.0, 0.95 - rng.uniform(0, 0.25)
                    x_in = side - math.copysign(0.05, side)
                    face = [cam.proj(x_in, lvl + 0.08, z0), cam.proj(x_in, lvl + 0.08 + bh, z0), cam.proj(x_in, lvl + 0.08 + bh, z0 + bw), cam.proj(x_in, lvl + 0.08, z0 + bw)]
                    tone = int(rng.uniform(95, 135))
                    d.polygon([p[:2] for p in face], fill=(tone, int(tone * 0.78), int(tone * 0.55)))
                    tp = [cam.proj(x_in, lvl + 0.08 + bh * 0.55, z0), cam.proj(x_in, lvl + 0.08 + bh * 0.55, z0 + bw)]
                    d.line([tp[0][:2], tp[1][:2]], fill=(170, 150, 110, 120), width=max(1, s))
            for lvl in (0.05, 1.35, 2.65):  # orange beams
                a, b = cam.proj(side, lvl, Z), cam.proj(side, lvl, Z + 2.7)
                d.line([a[:2], b[:2]], fill=(210, 100, 30), width=max(2, int(0.08 * cam.f / max(Z, 1))))
            a, b = cam.proj(side, 0, Z), cam.proj(side, 3.8, Z)
            d.line([a[:2], b[:2]], fill=(40, 70, 120), width=max(2, int(0.09 * cam.f / max(Z, 1))))
    boxes = {}
    objects = []
    # far → near
    def draw_trolley(layer):
        L = ImageDraw.Draw(layer, "RGBA")
        x, z, yaw = 0.3, 3.0, -0.35
        kp = trolley_points(x, z, yaw)
        P_ = {k: cam.proj(*v) for k, v in kp.items()}
        for a, b in [("p1", "w1"), ("p2", "w2"), ("p3", "w3"), ("p4", "w4"), ("p1", "h1"), ("p4", "h2"), ("h1", "h2")]:
            L.line([P_[a][:2], P_[b][:2]], fill=(165, 170, 178, 255), width=int(0.035 * cam.f / z))
        L.polygon([P_[k][:2] for k in ("p1", "p2", "p3", "p4")], fill=(120, 126, 136, 255))
        # load: two cartons
        for (dx, dz, bw, bd, bh) in ((-0.35, 0.0, 0.55, 0.6, 0.42), (0.25, 0.05, 0.5, 0.55, 0.34)):
            c, s_ = math.cos(yaw), math.sin(yaw)
            def at(px, py, pz):
                return cam.proj(x + px * c - pz * s_, py, z + px * s_ + pz * c)[:2]
            y0 = 0.4
            front = [at(dx - bw / 2, y0, dz - bd / 2), at(dx + bw / 2, y0, dz - bd / 2), at(dx + bw / 2, y0 + bh, dz - bd / 2), at(dx - bw / 2, y0 + bh, dz - bd / 2)]
            top = [at(dx - bw / 2, y0 + bh, dz - bd / 2), at(dx + bw / 2, y0 + bh, dz - bd / 2), at(dx + bw / 2, y0 + bh, dz + bd / 2), at(dx - bw / 2, y0 + bh, dz + bd / 2)]
            side_ = [at(dx - bw / 2, y0, dz - bd / 2), at(dx - bw / 2, y0, dz + bd / 2), at(dx - bw / 2, y0 + bh, dz + bd / 2), at(dx - bw / 2, y0 + bh, dz - bd / 2)]
            L.polygon(side_, fill=(104, 84, 62, 255)); L.polygon(front, fill=(140, 112, 82, 255)); L.polygon(top, fill=(166, 138, 104, 255))
            L.line([front[0], front[1]], fill=(110, 84, 56, 255), width=s)
        for k_ in ("w1", "w2", "w3", "w4"):
            r = 0.08 * cam.f / P_[k_][2]
            L.ellipse([P_[k_][0] - r, P_[k_][1] - r, P_[k_][0] + r, P_[k_][1] + r], fill=(16, 16, 18, 255))
        # keypoints (the detector's output, drawn into the frame)
        for k_, p in P_.items():
            rr = 3.2 * s
            L.ellipse([p[0] - rr, p[1] - rr, p[0] + rr, p[1] + rr], fill=(*KP_COL[k_[0]], 255), outline=(8, 8, 8, 255), width=s)
        xs_ = [p[0] for p in P_.values()]; ys_ = [p[1] for p in P_.values()]
        return [min(xs_) - 6 * s, min(ys_) - 10 * s, max(xs_) + 6 * s, max(ys_) + 6 * s]

    far = Image.new("RGBA", img.size, (0, 0, 0, 0))
    boxes["person"] = _person(far, cam, -0.75, 3.1, s, (52, 58, 70), stride=0.35)
    far = light_layer(far, boxes["person"])
    shadow = ImageDraw.Draw(img, "RGBA")
    f0, f1 = cam.proj(-1.0, 0, 3.0), cam.proj(-0.5, 0, 3.25)
    sx0, sx1 = sorted((f0[0], f1[0]))
    sy = (f0[1] + f1[1]) / 2
    shadow.ellipse([sx0, sy - 5 * s, sx1, sy + 5 * s], fill=(0, 0, 0, 90))
    img = Image.alpha_composite(img.convert("RGBA"), far.filter(ImageFilter.GaussianBlur(0.8 * s))).convert("RGB")
    mid = Image.new("RGBA", img.size, (0, 0, 0, 0))
    boxes["trolley"] = draw_trolley(mid)
    mid = light_layer(mid, boxes["trolley"], 0.45)
    img = Image.alpha_composite(img.convert("RGBA"), mid.filter(ImageFilter.GaussianBlur(0.6 * s))).convert("RGB")
    near = Image.new("RGBA", img.size, (0, 0, 0, 0))
    boxes["close"] = _person(near, cam, 0.78, 1.15, s, (38, 52, 74), stride=-0.15)
    near = light_layer(near, boxes["close"], 0.7)
    img = Image.alpha_composite(img.convert("RGBA"), near.filter(ImageFilter.GaussianBlur(2.6 * s))).convert("RGB")
    # lens: bloom from the lights, light falloff, a little softness
    bloom = img.point(lambda v: max(0, v - 200) * 3).filter(ImageFilter.GaussianBlur(18 * s))
    img = Image.fromarray(np.clip(np.asarray(img).astype(np.int16) + np.asarray(bloom).astype(np.int16) // 2, 0, 255).astype(np.uint8))
    yy, xx = np.mgrid[0:h, 0:w]
    fall = 1 - 0.38 * np.clip(np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h * 0.42) / (h / 2)) ** 2) - 0.25, 0, 1)
    img = Image.fromarray(np.clip(np.asarray(img).astype(np.float32) * fall[..., None], 0, 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur(0.7 * s))
    # camera look: slight cool tint, contrast, grain, vignette
    a = np.asarray(img).astype(np.float32)
    a = (a - 128) * 1.08 + 128
    a[..., 2] *= 1.04
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    out = finish(img, W, H, vignette=0.55, grain_amt=10)
    pct = {k: [round(100 * max(0, b[0]) / w, 1), round(100 * max(0, b[1]) / h, 1),
               round(100 * (min(w, b[2]) - max(0, b[0])) / w, 1), round(100 * (min(h, b[3]) - max(0, b[1])) / h, 1)]
           for k, b in boxes.items()}
    return out, pct


# ───────────────────────────────── output ─────────────────────────────────

SCENES = {
    "surroundsense": (scene_surround, [0.22, 0.66]),
    "trolley-pose": (scene_trolley, [0.45]),
    "calibration": (scene_calib, [0.75, 0.05]),
    "slam-map": (scene_slam, [0.8, 0.35]),
    "edge-module": (scene_edge, [0.8, 0.3]),
}


def main() -> None:
    if "--frontcam" in sys.argv:
        img, pct = scene_frontcam(0, 1280, 696)
        img.save(ROOT / "public/art/amr-front-camera.webp", "WEBP", quality=85)
        print("✓ public/art/amr-front-camera.webp", pct)
        return
    stills_only = "--stills" in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith("--")]
    (ROOT / "public/work").mkdir(exist_ok=True)
    (ROOT / "public/video").mkdir(exist_ok=True)
    for name, (fn, still_ts) in SCENES.items():
        if only and name not in only:
            continue
        for i, t in enumerate(still_ts):
            out = ROOT / "public/work" / (f"cv-{name}.webp" if i == 0 else f"cv-{name}-{i + 1}.webp")
            fn(t, 1600, 1000).save(out, "WEBP", quality=84)
            print("✓", out.relative_to(ROOT))
        if stills_only:
            continue
        W, H = 1280, 800
        out = ROOT / "public/video" / f"cv-{name}.mp4"
        p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                              "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "27",
                              "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)], stdin=subprocess.PIPE)
        n = FPS * SECONDS
        for k in range(n):
            p.stdin.write(fn(k / n, W, H).tobytes())
        p.stdin.close()
        p.wait()
        fn(still_ts[0], W, H).save(ROOT / "public/video" / f"cv-{name}.webp", "WEBP", quality=80)  # poster
        print("✓", out.relative_to(ROOT), f"{out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
