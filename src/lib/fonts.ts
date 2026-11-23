import localFont from "next/font/local";
import { Ballet, Barlow_Condensed, Instrument_Serif, JetBrains_Mono, Patrick_Hand_SC } from "next/font/google";

/**
 * Font slots, each exposed as a CSS variable consumed in globals.css.
 *
 * Reference mapping (commercial originals → free equivalents used here):
 *   PP Editorial New (italic serif)          → Instrument Serif         --font-display
 *   PP Neue Montreal / Open Sauce One (sans) → Open Sauce One (OFL)      --font-heading
 *   PP Neue York Condensed Extrabold         → Barlow Condensed 800      --font-poster
 *   Casual Human (handwriting)               → Patrick Hand SC           --font-hand
 *
 * To swap in a Dirtyline Studio face, drop the .woff2 into src/fonts/ and replace
 * the matching slot with localFont({ src: "../fonts/YourFont.woff2", variable: "--font-poster" }).
 */

export const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

// Open Sauce One — SIL OFL 1.1, see src/fonts/OpenSauceOne-OFL.txt
export const heading = localFont({
  src: [
    { path: "../fonts/OpenSauceOne-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/OpenSauceOne-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/OpenSauceOne-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/OpenSauceOne-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-heading",
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

export const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const poster = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-poster",
  display: "swap",
});

export const hand = Patrick_Hand_SC({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hand",
  display: "swap",
});

// Calligraphic script — the "hello" over the About portrait
export const script = Ballet({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
  display: "swap",
});

export const fontVariables = [display.variable, heading.variable, mono.variable, poster.variable, hand.variable, script.variable].join(" ");
