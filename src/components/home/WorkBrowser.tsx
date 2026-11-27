"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/types/content";
import { Bento } from "@/components/home/Bento";
import { WorkIndex } from "@/components/home/WorkIndex";
import { sound } from "@/lib/sound";

type Field = "all" | Project["field"];

const TABS: { id: Field; label: string }[] = [
  { id: "all", label: "All work" },
  { id: "ai", label: "AI automation" },
  { id: "cv", label: "Computer vision & robotics" },
];

/**
 * Work page: one list for two audiences (clients and recruiters). Tabs filter the grid and the index;
 * `/work?field=cv` deep-links a tab (e.g. from the CV & robotics résumé).
 */
export function WorkBrowser({ projects, head, indexHeading }: { projects: Project[]; head: React.ReactNode; indexHeading: React.ReactNode }) {
  const [field, setField] = useState<Field>("all");

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("field");
    if (f === "ai" || f === "cv") setField(f);
  }, []);

  const pick = (f: Field) => {
    setField(f);
    sound().tap();
    const url = new URL(window.location.href);
    if (f === "all") url.searchParams.delete("field");
    else url.searchParams.set("field", f);
    window.history.replaceState(null, "", url);
  };

  const shown = field === "all" ? projects : projects.filter((p) => p.field === field);

  return (
    <>
      <section className="inner" style={{ paddingBottom: "3rem" }}>
        {head}
        <div className="work-tabs" role="tablist" aria-label="Filter work">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={field === t.id} className="work-tab" onClick={() => pick(t.id)}>
              {t.label}
              <span className="work-tab-count">{t.id === "all" ? projects.length : projects.filter((p) => p.field === t.id).length}</span>
            </button>
          ))}
        </div>
        {/* key: re-mount so the grid's reveal state starts fresh per tab */}
        <Bento key={`bento-${field}`} projects={shown} initial={shown.length} />
      </section>
      <section className="work-section">
        <p className="eyebrow">Index</p>
        {indexHeading}
        <WorkIndex key={`index-${field}`} projects={shown} />
      </section>
    </>
  );
}
