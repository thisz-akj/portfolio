# Image & font credits

All photos are CC0 (public domain dedication) via Openverse. Attribution isn't required but is given here.

| File | Title | Creator | License | Source | Link |
|---|---|---|---|---|---|
| `laptop-glow.webp` | Laptop Keyboard | One Idea LLC | CC0 | stocksnap | https://stocksnap.io/photo/laptop-keyboard-QGU10TMNPE |
| `concrete-bw.webp` | Abstract Concrete | Wyncliffe | CC0 | stocksnap | https://stocksnap.io/photo/abstract-concrete-DXEDCZC25K |
| `night-desk.webp` | Laptop Computer | Valeriy Khan | CC0 | stocksnap | https://stocksnap.io/photo/laptop-computer-7ES0X4Z8UI |
| `dark-water.webp` | Sea Ocean | Mike Yukhtenko | CC0 | stocksnap | https://stocksnap.io/photo/sea-ocean-LEKR2TE4HG |
| `city-bokeh.webp` | Bokeh Lights | Gabriel Santiago | CC0 | stocksnap | https://stocksnap.io/photo/bokeh-lights-R0CX35EZFB |
| `star-trails.webp` | stars night sky movement Park | unknown | CC0 | rawpixel | https://www.rawpixel.com/image/3286018/free-photo-image-blue-scenery-sky-land-adventure |
| `dark-arch.webp` | dark minimal black white photo | unknown | CC0 | rawpixel | https://www.rawpixel.com/image/3284493/free-photo-image-texture-abstract-architecture |
| `milky-way.webp` | Stars Galaxy | Greg Rakozy | CC0 | stocksnap | https://stocksnap.io/photo/stars-galaxy-Y8CKB0O8C2 |
| `concrete-light.webp` | Long shadows concrete wall | unknown | CC0 | rawpixel | https://www.rawpixel.com/image/3299253/free-photo-image-cc0-pattern-architecture-asphalt |
| `ocean-wave.webp` | Sea Ocean | Tim Marshall | CC0 | stocksnap | https://stocksnap.io/photo/sea-ocean-KEKD7OADUK |
| `night-bokeh.webp` | Bokeh Lights | Patryk Dziejma | CC0 | stocksnap | https://stocksnap.io/photo/bokeh-lights-1GZ2J3A7VG |
| `neon-desk.webp` | Free designer workspace laptop image | unknown | CC0 | rawpixel | https://www.rawpixel.com/image/5916915/image-background-public-domain-business |
| `stone-texture.webp` |  | unknown | CC0 | rawpixel | https://www.rawpixel.com/image/5951668/free-public-domain-cc0-photo |
| `pylon-stars.webp` | Stars night sky | unknown | CC0 | rawpixel | https://www.rawpixel.com/image/3286079/free-photo-image-electric-astronomy-cable |
| `night-lake.webp` | Sea Ocean | Henry Gressmann | CC0 | stocksnap | https://stocksnap.io/photo/sea-ocean-U4ML8WV1I2 |
| `window-work.webp` | Laptop Apple | Matthew Henry | CC0 | stocksnap | https://stocksnap.io/photo/laptop-apple-OYEIB7P371 |
| `rooftop-laptop-bw.webp` | People Man (converted to B&W, cropped) | Avi Richards | CC0 | stocksnap | https://stocksnap.io/photo/people-man-US2FZPVSMP |
| `dark-desk-bw.webp` | Office Work (converted to B&W, cropped) | Lee Campbell | CC0 | stocksnap | https://stocksnap.io/photo/office-work-N0ZRKV9CI6 |

Fonts: Open Sauce One (SIL OFL 1.1, src/fonts/OpenSauceOne-OFL.txt); Instrument Serif, JetBrains Mono, Barlow Condensed, Patrick Hand SC via Google Fonts (OFL).

## Videos

Clips from [Mixkit](https://mixkit.co), used under the **Mixkit Stock Video Free License**: free for commercial and personal projects, no attribution required. They're trimmed to 8 s, muted and re-encoded at 1280×720 (background clips at 854×480).

| File | Mixkit item |
|---|---|
| `laptop-keys.mp4` | https://mixkit.co (item 17450) |
| `paper-stack.mp4` | item 45923 |
| `phone-texting.mp4` | item 4915 |
| `particle-wave.mp4` | item 18140 |
| `data-grid.mp4` | item 47796 |
| `code-glasses.mp4` | item 46635 |
| `eye-closeup.mp4` | item 41180 |
| `v-terminal.mp4` (hero, vertical) | item 50811 |
| `v-chip.mp4` (hero, colour, dimmed) | item 2381 |
| `v-light-trail.mp4` (hero, vertical) | item 50433 |
| `v-robot-arm-bw.mp4` (hero, black & white) | item 47257 |
| `v-laptop-bw.mp4` (hero, black & white) | item 21254 |
| `v-code-bw.mp4` (hero, black & white) | item 1728 |

To replace a clip with your own product footage, drop an `.mp4` plus a `.webp` poster with the same name into `public/video/`, or set `media` on a solution to show your footage in its side panel.

## Ops Suite screenshots
`public/work/ops-suite-*.webp` — screenshots of the owner's own Ops Suite demo (synthetic data), captured with
`npm run shots` (Playwright + sharp). No third-party assets.

## DocDesk sample documents
- `docintel/samples/pdf/*.pdf` — synthetic documents written for this site; all companies, people, GSTINs and amounts are fictional.
- Fonts embedded in them: Noto Serif and Noto Sans (Google, SIL Open Font License 1.1), vendored in `docintel/samples/fonts/`.
- `public/work/docdesk-*.webp`, `public/demos/docdesk/*.webp` — screenshots and page renders of the DocDesk demo (own work, synthetic documents).
- `public/work/voice-*.webp` — screenshots of the Front Desk Voice demo (own work, fictional clinic; `npm run shots:voice`).
- `public/work/autopilot-*.webp` — screenshots of the Autopilot demo (own work, fictional businesses; `npm run shots:autopilot`).

## Computer vision & robotics illustrations (generated)
- `public/work/cv-*.webp`, `public/video/cv-*.mp4` (+ `.webp` posters) — procedurally drawn illustrations of the owner's
  projects (SurroundSense blind-spot monitor, edge trolley pose estimation, camera–LiDAR calibration, visual SLAM → navigation map, an unbranded Jetson-class edge AI module), made for this site
  with `scripts/render-vision-media.py` (PIL + ffmpeg). Not recordings of real or customer systems; no third-party assets.
- `public/art/amr-front-camera.webp` — rendered AMR front-camera frame for the Computer Vision card preview (`--frontcam`); the card's boxes use the renderer's object extents.

- `public/video/hero-motion(-mobile).mp4/.webp` — owner's own motion film (provided by the owner), re-timed, graded and lightly sharpened; `hero-motion-ambient.webp` is its last frame with the figure painted out, blurred.
- `public/art/hero/z07–z09(-mobile).webp` — owner's own stills (provided by the owner), graded to match the hero film (About portrait).

## Tool logos (home About → "Tech I use")
- Brand icons from [Simple Icons](https://simpleicons.org) (npm `simple-icons`, CC0). Logos are trademarks of their owners, shown only to name tools used. OpenAI and telephony use plain lucide icons (not in the set).
