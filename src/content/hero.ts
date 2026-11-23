/**
 * Hero media field — same structure as the reference hero:
 * 9 tiles bleeding off the edges, 7 looping clips + 2 stills, large tiles bright,
 * small tiles dimmed (brighten on hover), each with its own parallax depth.
 * Media: Mixkit clips (public/video) and CC0 photos (public/art) — see docs/credits.md.
 *
 * Boxes are [left, top, width, height] in % of the hero; `mobile` overrides on small screens.
 */
export interface HeroTile {
  id: string;
  /** Still image, or the poster frame when `video` is set */
  art: string;
  video?: string;
  size: "large" | "small";
  depth: number;
  box: [number, number, number, number];
  mobile?: [number, number, number, number] | null;
}

export const heroImages: HeroTile[] = [
  { id: "tl", video: "v-terminal", art: "/video/v-terminal.webp", size: "large", depth: 0.3, box: [-1, -5, 22, 42], mobile: [-1, -5, 22, 37] },
  { id: "tc", video: "v-code-bw", art: "/video/v-code-bw.webp", size: "large", depth: 0.6, box: [37, -3, 17, 31], mobile: [30, 0, 40, 20] },
  { id: "tr", video: "v-robot-arm-bw", art: "/video/v-robot-arm-bw.webp", size: "large", depth: 0.35, box: [80, -2, 21, 35], mobile: [80, -2, 21, 35] },
  { id: "ml", art: "/art/rooftop-laptop-bw.webp", size: "small", depth: 0.9, box: [3, 44, 11, 24], mobile: [3, 44, 26, 24] },
  { id: "mc", art: "/art/dark-desk-bw.webp", size: "small", depth: 1.1, box: [32, 60, 13, 22], mobile: [32, 56, 20, 22] },
  { id: "mr", video: "v-chip", art: "/video/v-chip.webp", size: "small", depth: 0.75, box: [80, 38, 12, 20], mobile: [68, 44, 30, 20] },
  { id: "bl", video: "laptop-keys", art: "/video/laptop-keys.webp", size: "large", depth: 0.4, box: [-15, 65, 40, 40], mobile: [-15, 65, 40, 30] },
  { id: "bc", video: "v-light-trail", art: "/video/v-light-trail.webp", size: "large", depth: 0.5, box: [43, 60, 16, 50], mobile: [55, 60, 40, 40] },
  { id: "br", video: "v-laptop-bw", art: "/video/v-laptop-bw.webp", size: "large", depth: 0.25, box: [75, 52, 26, 50], mobile: null },
];
