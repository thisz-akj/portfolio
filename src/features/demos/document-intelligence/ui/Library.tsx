"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import { AiLimitDialog } from "@/components/shared/AiLimitDialog";
import { openLiveDemo } from "@/lib/liveDemo";
import { ApiError, forgetUpload, listDocs, pageSrc, rememberUpload, rememberedUploads, uploadDoc } from "../api";
import { docHref } from "../nav";
import type { DocSummary } from "../types";

const UPLOAD_LIMIT_COPY =
  "Demo limit: one-page PDFs up to 2 MB, so every visitor gets fast answers. DocDesk itself handles long, multi-page documents — the contracts and lease in the library run through exactly the same pipeline.";

const ERRORS: Record<string, string> = {
  too_many_pages: "This demo accepts one-page PDFs. DocDesk handles multi-page documents in production — try a single page (e.g. an invoice), or open a multi-page sample from the library.",
  no_text: "No readable text on that page — it looks like a scan or a photo. Scanned documents need OCR, which this demo doesn't run.",
  not_pdf: "That file isn't a PDF.",
  encrypted: "That PDF is password-protected.",
  too_large: "That file is too large for the demo (2 MB max).",
};

export function Library() {
  const [docs, setDocs] = useState<DocSummary[] | null>(null);
  const [uploads, setUploads] = useState<DocSummary[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUploads(rememberedUploads());
    listDocs()
      .then(setDocs)
      .catch(() => setFailed(true));
  }, []);

  return (
    <>
      <Uploader onUploaded={(d) => setUploads(rememberedUploads().length ? rememberedUploads() : [d])} />
      {uploads.length > 0 && (
        <section aria-labelledby="dd-up">
          <p id="dd-up" className="dd-label" style={{ marginBottom: "0.6rem" }}>
            Your uploads · this tab only
          </p>
          <div className="dd-lib">
            {uploads.map((d) => (
              <DocCard
                key={d.id}
                doc={d}
                onRemove={() => {
                  forgetUpload(d.id);
                  setUploads(rememberedUploads());
                }}
              />
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby="dd-samples">
        <p id="dd-samples" className="dd-label" style={{ marginBottom: "0.6rem" }}>
          Sample documents · fictional companies
        </p>
        {failed ? (
          <div className="dd-card dd-empty">DocDesk is unavailable right now. Please try again in a minute.</div>
        ) : !docs ? (
          <div className="dd-lib">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="dd-skel" style={{ height: "17rem" }} />
            ))}
          </div>
        ) : (
          <div className="dd-lib">
            {docs.map((d) => (
              <DocCard key={d.id} doc={d} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function DocCard({ doc, onRemove }: { doc: DocSummary; onRemove?: () => void }) {
  return (
    <article className="dd-doc">
      <Link href={docHref(doc.id)} style={{ position: "absolute", inset: 0, zIndex: 1 }} aria-label={`Open ${doc.title}`} />
      {onRemove && (
        <button type="button" className="dd-doc-x" onClick={onRemove} aria-label={`Remove ${doc.title} from this list`}>
          <X size={13} />
        </button>
      )}
      <div className="dd-doc-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element -- page render from the service */}
        <img src={pageSrc(doc.id, 1)} alt="" loading="lazy" />
      </div>
      <div className="dd-doc-body">
        <h3>{doc.title}</h3>
        <p>{doc.blurb}</p>
        <div className="dd-doc-meta">
          <span className="dd-chip">{doc.typeLabel}</span>
          <span className="dd-chip">
            {doc.pages} page{doc.pages === 1 ? "" : "s"}
          </span>
          {doc.issues.error > 0 && <span className="dd-chip is-error">{doc.issues.error} error{doc.issues.error === 1 ? "" : "s"}</span>}
          {doc.issues.warning > 0 && <span className="dd-chip is-warning">{doc.issues.warning} to review</span>}
        </div>
      </div>
    </article>
  );
}

function Uploader({ onUploaded }: { onUploaded: (d: DocSummary) => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);

  const send = useCallback(
    async (file: File | undefined) => {
      if (!file || busy) return;
      setError(null);
      if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setError(ERRORS.not_pdf);
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setError(ERRORS.too_large);
        return;
      }
      setBusy(true);
      try {
        const { data } = await uploadDoc(file);
        rememberUpload(data);
        onUploaded(data);
        router.push(docHref(data.id, "fields"));
      } catch (e) {
        const err = e instanceof ApiError ? e : null;
        if (err?.code === "quota") setLimitOpen(true);
        else if (err?.code === "offline") openLiveDemo("DocDesk");
        else setError((err && ERRORS[err.code]) ?? err?.message ?? "Upload failed. Please try again.");
      } finally {
        setBusy(false);
        if (input.current) input.current.value = "";
      }
    },
    [busy, onUploaded, router],
  );

  return (
    <div style={{ position: "relative", minHeight: limitOpen ? "21rem" : undefined }}>
      <div
        className={`dd-drop${over ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void send(e.dataTransfer.files[0]);
        }}
      >
        <span className="dd-drop-icon" aria-hidden="true">
          {busy ? <Loader2 size={18} className="dd-spin" /> : <FileUp size={18} />}
        </span>
        <div>
          <h2>{busy ? "Reading your document…" : "Upload a one-page PDF"}</h2>
          <p>{UPLOAD_LIMIT_COPY}</p>
          <p className="dd-note" style={{ marginTop: "0.3rem" }}>
            Kept in memory only and deleted automatically after 60 minutes. Please don&apos;t upload confidential documents.
          </p>
          {error && (
            <p className="dd-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="dd-drop-actions">
          <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => void send(e.target.files?.[0])} aria-label="Choose a PDF" />
          <button type="button" className="dd-btn is-primary" disabled={busy} onClick={() => input.current?.click()}>
            Choose PDF
          </button>
        </div>
      </div>
      <AiLimitDialog
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        message="You've used today's free uploads. Send Azad a message to try DocDesk on your own documents — multi-page included."
      />
    </div>
  );
}
