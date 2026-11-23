# 0001: Stack, styling and motion

- **Next.js App Router (TypeScript)** was chosen by the owner. It is one app for now, with a clear split between content, components, features and API.
- **Plain CSS with tokens** instead of a utility framework. The reference design depends on hand-tuned values, and tokens on `:root` keep re-theming cheap.
- **GSAP + ScrollTrigger + Lenis** are the same motion primitives the reference site uses, which keeps the animation behaviour faithful.
- **Canvas 2D instead of WebGL** for the particle preview and footer name. It is visually equivalent at this particle count and avoids a WebGL dependency.
- **Fonts**: Instrument Serif, Host Grotesk, JetBrains Mono and Anton are free Google Fonts that stand in for the reference's commercial PP Editorial New and PP Neue Montreal. A Dirtyline Studio font can be swapped into the `--font-poster` slot (`src/lib/fonts.ts`).
- **Contact delivery** goes through a webhook so no email provider is chosen on the owner's behalf.
