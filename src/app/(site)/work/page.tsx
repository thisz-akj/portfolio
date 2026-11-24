import type { Metadata } from "next";
import { projects } from "@/content/projects";
import { Bento } from "@/components/home/Bento";
import { WorkIndex } from "@/components/home/WorkIndex";
import { SectionHeading } from "@/components/shared/SectionHeading";

export const metadata: Metadata = {
  title: "Work",
  description: "Selected engineering projects and case studies: visual SLAM, camera–LiDAR calibration, quantization studies.",
};

export default function WorkPage() {
  return (
    <>
      <section className="inner" style={{ paddingBottom: "3rem" }}>
        <div className="inner-head">
          <p className="eyebrow">Work &amp; case studies</p>
          <h1 className="inner-title">Things that shipped.</h1>
          <p className="lede">
            Problem, contribution, approach, results and lessons — written from the project reports, with the numbers
            left in.
          </p>
        </div>
        <Bento projects={projects} initial={projects.length} />
      </section>
      <section className="work-section">
        <p className="eyebrow">Index</p>
        <SectionHeading>Every project</SectionHeading>
        <WorkIndex projects={projects} />
      </section>
    </>
  );
}
