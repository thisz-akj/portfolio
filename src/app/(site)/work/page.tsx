import type { Metadata } from "next";
import { projects } from "@/content/projects";
import { WorkBrowser } from "@/components/home/WorkBrowser";
import { SectionHeading } from "@/components/shared/SectionHeading";

export const metadata: Metadata = {
  title: "Work",
  description: "Case studies in AI automation (CRM/ERP with plain-English analytics, document intelligence, voice agents) and computer vision & robotics (visual SLAM, 360° blind-spot monitoring, camera–LiDAR calibration, edge AI).",
};

export default function WorkPage() {
  return (
    <WorkBrowser
      projects={projects}
      head={
        <div className="inner-head">
          <p className="eyebrow">Work &amp; case studies</p>
          <h1 className="inner-title">Things that shipped.</h1>
          <p className="lede">
            AI automation products and computer vision &amp; robotics work: problem, contribution, results and lessons,
            with the numbers left in.
          </p>
        </div>
      }
      indexHeading={<SectionHeading>Every project</SectionHeading>}
    />
  );
}
