"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { fetchDetailAction, fetchFormOptionsAction } from "../../data/actions";
import type { RecordDetail } from "../../data/detail-types";
import { getEntityMeta } from "../../entities";
import type { Option } from "../../filters/types";
import { ConvertLeadForm } from "./ConvertLeadForm";
import { EntityForm } from "./EntityForm";
import { RecordView } from "./RecordView";

export type DrawerTarget = { entity: string; id: number | "new" };

/**
 * Right-hand panel for viewing, editing and creating records without leaving the list.
 * Related records open in the same drawer; "Open page" goes to the full record page.
 */
export function RecordDrawer({ target, onClose, onChanged }: { target: DrawerTarget; onClose: () => void; onChanged: () => void }) {
  const [cur, setCur] = useState<DrawerTarget>(target);
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  const [formOptions, setFormOptions] = useState<Record<string, Option[]> | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "convert">(target.id === "new" ? "edit" : "view");
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<Element | null>(null);
  const meta = getEntityMeta(cur.entity)!;

  useEffect(() => setCur(target), [target]);
  useEffect(() => {
    opener.current = document.activeElement;
    return () => (opener.current as HTMLElement | null)?.focus?.();
  }, []);

  const load = useCallback(async (t: DrawerTarget) => {
    setState("loading");
    try {
      if (t.id === "new") {
        setDetail(null);
        setFormOptions(await fetchFormOptionsAction(t.entity));
        setMode("edit");
      } else {
        const d = await fetchDetailAction(t.entity, t.id);
        setDetail(d);
        if (!d) return setState("missing");
      }
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    setMode(cur.id === "new" ? "edit" : "view");
    void load(cur);
  }, [cur, load]);

  useEffect(() => {
    if (state === "ready") panel.current?.querySelector<HTMLElement>("h2, [name]")?.focus?.();
  }, [state, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const startEdit = async () => {
    if (!formOptions) setFormOptions(await fetchFormOptionsAction(cur.entity));
    setMode("edit");
  };

  const saved = (id: number) => {
    onChanged();
    if (cur.id === "new") setCur({ entity: cur.entity, id });
    else {
      setMode("view");
      void load(cur);
    }
  };

  const title = cur.id === "new" ? `New ${meta.singular}` : mode === "edit" ? `Edit ${meta.singular}` : mode === "convert" ? "Convert lead" : (detail?.title ?? meta.singular);

  return (
    <div className="ops-drawer-root">
      <div className="ops-drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside ref={panel} className="ops-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="ops-icon-btn ops-drawer-x" aria-label="Close panel" onClick={onClose}>
          <X size={16} />
        </button>
        {state === "loading" && <div className="ops-drawer-loading" aria-busy="true">Loading…</div>}
        {state === "missing" && <p className="ops-null">This {meta.singular} no longer exists.</p>}
        {state === "error" && <p className="ops-error">Couldn&apos;t load this record. The demo database may be unavailable.</p>}
        {state === "ready" && mode === "view" && detail && (
          <RecordView
            detail={detail}
            onEdit={startEdit}
            onConvert={detail.entity === "leads" && detail.row.status !== "converted" ? () => setMode("convert") : undefined}
            onNavigate={(entity, id) => setCur({ entity, id })}
          />
        )}
        {state === "ready" && mode === "edit" && formOptions && (
          <>
            <h2 tabIndex={-1} className="ops-drawer-title">
              {title}
            </h2>
            <EntityForm
              key={`${cur.entity}-${cur.id}`}
              entity={cur.entity}
              id={cur.id === "new" ? null : cur.id}
              initial={detail?.formValues ?? defaultsFor(cur.entity)}
              options={formOptions}
              onSaved={saved}
              onCancel={() => (cur.id === "new" ? onClose() : setMode("view"))}
            />
          </>
        )}
        {state === "ready" && mode === "convert" && detail && (
          <>
            <h2 tabIndex={-1} className="ops-drawer-title">
              {title}
            </h2>
            <ConvertLeadForm
              leadId={detail.id}
              companyName={String(detail.row.companyName)}
              onCancel={() => setMode("view")}
              onDone={(companyId) => {
                onChanged();
                setCur({ entity: "companies", id: companyId });
              }}
            />
          </>
        )}
      </aside>
    </div>
  );
}

/** Sensible starting values for new records. */
function defaultsFor(entity: string): Record<string, unknown> {
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  switch (entity) {
    case "companies":
      return { lifecycle: "prospect", paymentTermsDays: 30 };
    case "leads":
      return { status: "new", score: 40, source: "website" };
    case "deals":
      return { stage: "new", expectedClose: in30 };
    default:
      return {};
  }
}
