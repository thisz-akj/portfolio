"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ListChecks, MessageSquareText, Table2 } from "lucide-react";
import { getDoc, getExtraction } from "../api";
import { DOCDESK_BASE } from "../nav";
import type { DocDetail, Extraction, Rect } from "../types";
import { AskPanel } from "./AskPanel";
import { ChecksPanel } from "./ChecksPanel";
import { FieldsPanel } from "./FieldsPanel";
import { Viewer, type Highlight } from "./Viewer";

type Tab = "ask" | "fields" | "checks";
const VALID_ID = /^[A-Za-z0-9_-]{1,40}$/;

export function Workspace({ id, initialTab }: { id: string; initialTab: Tab }) {
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [highlight, setHighlight] = useState<Highlight | null>(null);

  useEffect(() => {
    if (!VALID_ID.test(id)) {
      setError("That document doesn't exist.");
      return;
    }
    let live = true;
    getDoc(id)
      .then((d) => live && setDoc(d))
      .catch((e: Error & { status?: number }) => live && setError(e.status === 404 ? "This document isn't available any more — uploads are deleted after 60 minutes." : e.message));
    getExtraction(id)
      .then((x) => live && setExtraction(x))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [id]);

  const show = useCallback((rects: Rect[] | undefined, tone: Highlight["tone"] = "cite") => {
    if (!rects?.length) return;
    setHighlight({ rects, tone, nonce: Date.now() });
  }, []);

  const switchTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "ask") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
  };

  if (error) {
    return (
      <main className="dd-content">
        <div className="dd-card dd-empty">
          <p>{error}</p>
          <Link href={DOCDESK_BASE} className="dd-btn">
            <ArrowLeft size={14} /> Back to the library
          </Link>
        </div>
      </main>
    );
  }

  const issues = extraction ? extraction.checks.filter((c) => c.severity === "error" || c.severity === "warning").length : 0;
  return (
    <main className="dd-work">
      <section className="dd-work-doc" aria-label="Document">
        <div className="dd-work-bar">
          <Link href={DOCDESK_BASE} className="dd-icon-btn" aria-label="Back to the library">
            <ArrowLeft size={16} />
          </Link>
          <h1>{doc?.title ?? "Loading…"}</h1>
          {doc && <span className="dd-chip">{extraction?.typeLabel ?? doc.typeLabel}</span>}
          {doc && (
            <span className="dd-chip" style={{ marginLeft: "auto" }}>
              {doc.pages} page{doc.pages === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {doc ? <Viewer docId={doc.id} title={doc.title} pageSizes={doc.pageSizes} highlight={highlight} /> : <div className="dd-skel" style={{ margin: "1rem", flex: 1 }} />}
      </section>
      <section className="dd-work-panel" aria-label="Tools">
        <div className="dd-tabs" role="tablist" aria-label="Document tools">
          <TabButton id="ask" tab={tab} onClick={switchTab} icon={<MessageSquareText size={15} />} label="Ask" />
          <TabButton id="fields" tab={tab} onClick={switchTab} icon={<Table2 size={15} />} label="Fields" />
          <TabButton
            id="checks"
            tab={tab}
            onClick={switchTab}
            icon={<ListChecks size={15} />}
            label="Checks"
            badge={issues > 0 ? <span className="dd-nav-count">{issues}</span> : null}
          />
        </div>
        <div className="dd-panel" role="tabpanel">
          {!doc ? (
            <div className="dd-skel" style={{ height: "12rem" }} />
          ) : tab === "ask" ? (
            <AskPanel doc={doc} docType={extraction?.type ?? doc.type} onCite={(r) => show(r)} />
          ) : tab === "fields" ? (
            <FieldsPanel doc={doc} extraction={extraction} onSource={(r) => show(r)} />
          ) : (
            <ChecksPanel extraction={extraction} onSource={(r, sev) => show(r, sev === "error" || sev === "warning" ? "warn" : "cite")} />
          )}
        </div>
      </section>
    </main>
  );
}

function TabButton({ id, tab, onClick, icon, label, badge }: { id: Tab; tab: Tab; onClick: (t: Tab) => void; icon: React.ReactNode; label: string; badge?: React.ReactNode }) {
  return (
    <button type="button" role="tab" className="dd-tab" aria-selected={tab === id} onClick={() => onClick(id)}>
      {icon}
      {label}
      {badge}
    </button>
  );
}
