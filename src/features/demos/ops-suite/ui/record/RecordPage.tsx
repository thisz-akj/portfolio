"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchFormOptionsAction } from "../../data/actions";
import type { RecordDetail } from "../../data/detail-types";
import type { Option } from "../../filters/types";
import { PORTAL_BASE } from "../../nav";
import { ConvertLeadForm } from "./ConvertLeadForm";
import { EntityForm } from "./EntityForm";
import { RecordView } from "./RecordView";

/** Full-page record view with in-place edit; data comes from the server component and refreshes after saves. */
export function RecordPage({ detail }: { detail: RecordDetail }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "convert">("view");
  const [options, setOptions] = useState<Record<string, Option[]> | null>(null);

  if (mode === "edit" && options) {
    return (
      <div className="ops-card ops-record-page">
        <h2 className="ops-drawer-title">Edit</h2>
        <EntityForm
          entity={detail.entity}
          id={detail.id}
          initial={detail.formValues}
          options={options}
          onCancel={() => setMode("view")}
          onSaved={() => {
            setMode("view");
            router.refresh();
          }}
        />
      </div>
    );
  }
  if (mode === "convert") {
    return (
      <div className="ops-card ops-record-page">
        <h2 className="ops-drawer-title">Convert lead</h2>
        <ConvertLeadForm leadId={detail.id} companyName={String(detail.row.companyName)} onCancel={() => setMode("view")} onDone={(id) => router.push(`${PORTAL_BASE}/companies/${id}`)} />
      </div>
    );
  }
  return (
    <div className="ops-card ops-record-page">
      <RecordView
        detail={detail}
        showOpenLink={false}
        onEdit={async () => {
          setOptions(options ?? (await fetchFormOptionsAction(detail.entity)));
          setMode("edit");
        }}
        onConvert={detail.entity === "leads" && detail.row.status !== "converted" ? () => setMode("convert") : undefined}
      />
    </div>
  );
}
