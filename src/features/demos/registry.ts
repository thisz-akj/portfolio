import type { ComponentType } from "react";

/**
 * Maps a demo slug to its interactive UI. Each demo lives in its own folder under
 * src/features/demos/<slug>/ with its own components, API client and tests.
 * Register it here once it works; the demo page renders it in place of the "In the lab" stage
 * when the demo's status is not "coming-soon".
 */
export const demoComponents: Record<string, ComponentType> = {};
