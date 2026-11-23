import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { solutions } from "@/content/solutions";
import { HiredBento } from "@/components/hired/HiredBento";
import { Poster } from "@/components/shared/Poster";

export const metadata: Metadata = {
  title: "AI Solutions",
  description: "Seven kinds of AI systems I build for founders and product teams — from workflow automation to voice agents.",
};

export default function SolutionsPage() {
  return (
    <section className="inner" style={{ background: "#000" }}>
      <div className="inner-head">
        <p className="eyebrow">AI Solutions</p>
        <h1 className="inner-title">Problems I solve with AI.</h1>
        <p className="lede">
          Each one is a business problem first and a model second. Open a card for the story, how I build it, and a
          walkthrough you can play.
        </p>
      </div>

      <HiredBento solutions={solutions} showAll withHeading={false} />

      <div style={{ marginTop: "7rem" }}>
        <Poster lines={["Got a problem", "not on this list?"]} />
        <div style={{ display: "flex", justifyContent: "center", marginTop: "2.5rem" }}>
          <Link href="/contact" className="btn-pill">
            Tell me about it <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
