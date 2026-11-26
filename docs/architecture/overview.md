# Architecture overview

Single Next.js App Router application. There is no separate API service yet. Add one under `apps/api` only when a demo needs Python or a GPU (see the decisions log).

## Layers
1. **Content** (`src/content/*`, typed by `src/types/content.ts`): the single source of truth for solutions, demos, projects, clients and site copy. Pages never hard-code this data.
2. **Routes** (`src/app/*`): thin server components that compose content and components. Detail routes are statically generated with `generateStaticParams`.
3. **Components**
   - `layout/`: global chrome (header, footer, cursor, smooth scroll)
   - `home/`: homepage sections
   - `shared/`: reusable motion and text primitives
   - `ui/`: icon maps
4. **Features** (`src/features/demos/<slug>/`): each demo is isolated. `registry.ts` maps a slug to its UI.
5. **Lib** (`src/lib/*`): pure helpers (`curve.ts`, `contact.ts`) are unit-tested. `motion.ts` wraps GSAP registration and loader events.
6. **API** (`src/app/api/*`): server-only. Inputs are validated with the same validators the client uses.

## Motion system
- Lenis drives scrolling from the GSAP ticker, and ScrollTrigger updates on each Lenis scroll.
- The hero dispatches `site:loaded` on mount (`markLoaderDone`); the assistant waits for it (`onLoaderDone`).
- Every animated component cleans up on unmount (`gsap.context().revert()` or `ScrollTrigger.kill()`).
- `prefers-reduced-motion` disables the hero entrance, smooth scroll, scrubbed reveals and canvas effects.

| Effect | Component |
|---|---|
| Hero: looping motion film settles out of a soft blur, title rises, rule table fades in; scroll parallax | `home/Hero.tsx` |
| Dot/ring/"VIEW" cursor | `layout/Cursor.tsx` |
| Section progress lines in the nav | `layout/Header.tsx` |
| Mouse/tilt parallax image field and centre-out letter rise | `home/Hero.tsx` |
| Per-character scroll fill | `shared/ScrubText.tsx` |
| U-curve heading settle (`\|cos(tπ)\|`) | `shared/SectionHeading.tsx` |
| Flex-grow and greyscale featured grid | `home/FeaturedGrid.tsx` |
| Bento cards with slideshow and clip-path "See more" | `home/Bento.tsx` |
| Particle-gather cursor preview | `home/WorkIndex.tsx` |
| Staggered client tiles and ink note | `home/Clients.tsx` |
| Layered poster titles | `shared/Poster.tsx` |
| Barrel-roll links; footer pen signature (writes on, one warm light sweep) | `layout/BarrelLink.tsx`, `layout/FooterSignature.tsx` |

## Sound design
All sound is synthesised live with the Web Audio API in `src/lib/sound.ts`. There are no audio files.

| Sound | When | How |
|---|---|---|
| Ambient pad | Continuously, after the first click or keypress | Detuned sine/triangle chords through a slowly breathing low-pass filter, plus faint filtered noise; chords change every 14 s; level 0.05 |
| Hover tick | Pointer enters cards, tiles, nav items and buttons | 120 ms sine blip at a different pitch per kind, throttled to at most one every 70 ms |
| Tap | Clicking links and buttons | Two soft sine notes |
| Cloth/paper rub | Pointer moving over the hero mesh or the contact wave field | Slowed pink noise, band-passed around 0.6–1.7 kHz; level follows pointer speed and fades out when the pointer stops |

- Sound is on by default. Browsers block audio until the visitor interacts, so `SoundProvider` unlocks it on the first `pointerdown` or `keydown`. The intro has no gate; it just signs the name and enters the site.
- `SoundToggle` sits in the header (it's an icon only on mobile). The choice is remembered in localStorage.
- Sound fades out when the tab is hidden and back in when the visitor returns. A compressor on the master output prevents spikes.
- To change the mood, edit `CHORDS` and `AMBIENT_LEVEL`. For hover pitch per element type, edit `TARGETS` in `SoundProvider`.
