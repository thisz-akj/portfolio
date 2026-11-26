import type { ComponentType } from "react";
import { OpsSuiteDemo } from "./ops-suite/showcase/OpsSuiteDemo";
import { SupportDemo } from "./customer-support/SupportDemo";
import { DocDeskDemo } from "./document-intelligence/showcase/DocDeskDemo";
import { VoiceDemo } from "./voice-ai/showcase/VoiceDemo";
import { AutopilotDemo } from "./autopilot/showcase/AutopilotDemo";

/**
 * Maps a demo slug to its interactive UI. Each demo lives in its own folder under
 * src/features/demos/<slug>/ with its own components, API client and tests.
 * Register it here once it works; the demo page renders it in place of the "In the lab" stage
 * when the demo's status is not "coming-soon".
 */
export const demoComponents: Record<string, ComponentType> = {
  "ops-suite": OpsSuiteDemo,
  "customer-support": SupportDemo,
  "document-intelligence": DocDeskDemo,
  "voice-ai": VoiceDemo,
  autopilot: AutopilotDemo,
};
