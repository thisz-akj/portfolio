"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * The demo showcases (screenshots + "try it" links, or the live support chat), loaded only when a solution's
 * full-screen story opens on the home page. Same components as /demos/<slug>; keep in step with registry.ts.
 */
const loading = () => <div className="story-demo-loading" aria-hidden="true" />;

export const lazyShowcases: Record<string, ComponentType> = {
  "ops-suite": dynamic(() => import("./ops-suite/showcase/OpsSuiteDemo").then((m) => m.OpsSuiteDemo), { loading }),
  "customer-support": dynamic(() => import("./customer-support/SupportDemo").then((m) => m.SupportDemo), { loading }),
  "document-intelligence": dynamic(() => import("./document-intelligence/showcase/DocDeskDemo").then((m) => m.DocDeskDemo), { loading }),
  "voice-ai": dynamic(() => import("./voice-ai/showcase/VoiceDemo").then((m) => m.VoiceDemo), { loading }),
  autopilot: dynamic(() => import("./autopilot/showcase/AutopilotDemo").then((m) => m.AutopilotDemo), { loading }),
};
