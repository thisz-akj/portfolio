import type { Metadata } from "next";
import { AutopilotApp } from "@/features/demos/autopilot/AutopilotApp";
import { getScenario } from "@/features/demos/autopilot/scenarios";
import "@/features/demos/autopilot/autopilot.css";

export const metadata: Metadata = {
  title: "Autopilot — workflow automation demo",
  robots: { index: false },
};

export default async function AutopilotAppPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  return <AutopilotApp initial={s ? getScenario(s)?.id : undefined} />;
}
