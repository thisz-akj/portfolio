import type { Metadata } from "next";
import { VoiceApp } from "@/features/demos/voice-ai/VoiceApp";
import "@/features/demos/voice-ai/voice.css";

export const metadata: Metadata = {
  title: "Front Desk Voice — voice AI demo",
  robots: { index: false },
};

export default function VoiceAppPage() {
  return <VoiceApp />;
}
