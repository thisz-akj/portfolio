import type { Metadata } from "next";
import Link from "next/link";
import { aiConfigured } from "@/features/demos/ops-suite/ai/llm.server";
import { FREE_AI_QUESTIONS } from "@/lib/aiQuota";
import { GOLDEN } from "@/features/demos/ops-suite/ai/golden";
import { AskPanel } from "@/features/demos/ops-suite/ui/ai/AskPanel";
import { PORTAL_BASE } from "@/features/demos/ops-suite/nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ask Ops Suite" };

export default function AskPage() {
  return (
    <>
      <div className="ops-head">
        <h1>Ask Ops Suite</h1>
        <p>
          Ask in plain English. Every answer shows the numbers behind it, and nothing you ask can change the data. Quality is measured on the <Link href={`${PORTAL_BASE}/ai-quality`}>AI quality</Link> page.
        </p>
      </div>
      <AskPanel configured={aiConfigured()} freeLimit={FREE_AI_QUESTIONS} examples={GOLDEN.filter((g) => g.example).map((g) => ({ id: g.id, question: g.question }))} />
    </>
  );
}
