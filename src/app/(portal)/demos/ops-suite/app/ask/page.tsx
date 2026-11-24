import type { Metadata } from "next";
import Link from "next/link";
import { aiConfigured } from "@/features/demos/ops-suite/ai/claude.server";
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
          Ask in plain English. Claude turns the question into a plan from a fixed semantic layer — it never writes SQL — and the server runs it
          read-only, showing its working. Quality is measured on the <Link href={`${PORTAL_BASE}/ai-quality`}>AI quality</Link> page.
        </p>
      </div>
      <AskPanel configured={aiConfigured()} examples={GOLDEN.filter((g) => g.example).map((g) => ({ id: g.id, question: g.question }))} />
    </>
  );
}
