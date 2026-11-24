"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Upload } from "lucide-react";
import { previewImportAction, runImportAction, type ImportActionResult } from "../../data/actions";
import { CSV_LIMITS, parseCsv } from "../../lib/csv";

interface Column {
  source: string;
  target: string;
  required: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** CSV → map columns → preview (dry run on the server) → import. */
export function ImportWizard({
  datasetId,
  schema,
  sampleHref,
  onDone,
  onCancel,
}: {
  datasetId: number;
  schema: Column[];
  sampleHref: string;
  onDone: (jobId: number, message: string) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<{ name: string; text: string; headers: string[]; rows: number } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Extract<ImportActionResult, { ok: true }> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const missing = useMemo(() => schema.filter((c) => c.required && !mapping[c.target]).map((c) => c.source), [schema, mapping]);

  const choose = async (f: File | undefined) => {
    setFile(null);
    setPreview(null);
    setMessage(null);
    setFileError(null);
    if (!f) return;
    if (f.size > CSV_LIMITS.bytes) return setFileError("File is larger than 1 MB");
    try {
      const text = await f.text();
      const parsed = parseCsv(text);
      setFile({ name: f.name, text, headers: parsed.headers, rows: parsed.rows.length });
      const auto: Record<string, string> = {};
      for (const c of schema) {
        const hit = parsed.headers.find((h) => norm(h) === norm(c.source)) ?? parsed.headers.find((h) => norm(h) === norm(c.target));
        if (hit) auto[c.target] = hit;
      }
      setMapping(auto);
    } catch (err) {
      setFileError((err as Error).message);
    }
  };

  const doPreview = () =>
    start(async () => {
      setMessage(null);
      const res = await previewImportAction(datasetId, file!.text, mapping);
      if (res.ok) setPreview(res);
      else setMessage(res.message);
    });

  const doImport = () =>
    start(async () => {
      const res = await runImportAction(datasetId, file!.text, mapping, file!.name);
      if (res.ok && res.jobId) onDone(res.jobId, `Imported ${res.imported} of ${res.total} rows${res.rejected ? ` — ${res.rejected} rejected (see the run)` : ""}`);
      else setMessage(res.ok ? "Import finished without a run record" : res.message);
    });

  return (
    <div className="ops-form ops-action-form ops-import">
      <div className="ops-import-file">
        <label className="ops-btn">
          <Upload size={14} /> {file ? "Choose another file" : "Choose CSV file"}
          <input type="file" accept=".csv,text/csv" className="ops-sr" onChange={(e) => void choose(e.target.files?.[0])} />
        </label>
        <a className="ops-link" href={sampleHref} download>
          <Download size={12} /> Download a sample file
        </a>
      </div>
      {fileError && (
        <p className="ops-error" role="alert">
          {fileError}
        </p>
      )}
      {file && (
        <>
          <p className="ops-hint">
            <strong>{file.name}</strong> · {file.rows.toLocaleString("en-IN")} rows · {file.headers.length} columns
          </p>
          <fieldset className="ops-mapping">
            <legend>Map columns</legend>
            {schema.map((c) => (
              <div key={c.target} className="ops-mapping-row">
                <label htmlFor={`map-${c.target}`}>
                  {c.source}
                  {c.required && <span aria-hidden="true"> *</span>}
                  <em>→ {c.target}</em>
                </label>
                <select
                  id={`map-${c.target}`}
                  value={mapping[c.target] ?? ""}
                  onChange={(e) => {
                    setPreview(null);
                    setMapping({ ...mapping, [c.target]: e.target.value });
                  }}
                >
                  <option value="">{c.required ? "Choose a column…" : "Not in file"}</option>
                  {file.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </fieldset>
          {missing.length > 0 && <p className="ops-hint">Map {missing.join(", ")} to continue.</p>}
        </>
      )}

      {preview && (
        <section className="ops-preview" aria-live="polite">
          <p>
            <strong className="ops-notice">{preview.imported.toLocaleString("en-IN")} rows ready</strong>
            {preview.rejected > 0 && <strong className="ops-error"> · {preview.rejected.toLocaleString("en-IN")} will be rejected</strong>}
            <span className="ops-hint"> of {preview.total.toLocaleString("en-IN")} — nothing has been saved yet</span>
          </p>
          <div className="ops-scroll ops-lines-scroll">
            <table className="ops-table ops-lines">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Result</th>
                  {schema.map((c) => (
                    <th key={c.target}>{c.target}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((r) => (
                  <tr key={r.row}>
                    <td className="ops-dim">{r.row}</td>
                    <td className={r.ok ? "ops-notice" : "ops-error"}>{r.ok ? "OK" : r.errors.join("; ")}</td>
                    {schema.map((c) => (
                      <td key={c.target}>{r.values[c.target] || <span className="ops-null">—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {message && (
        <p className="ops-error" role="alert">
          {message}
        </p>
      )}

      <div className="ops-form-actions">
        <button type="button" className="ops-btn is-ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        {!preview ? (
          <button type="button" className="ops-btn is-primary" disabled={!file || missing.length > 0 || pending} onClick={doPreview}>
            {pending ? "Checking…" : "Preview"}
          </button>
        ) : (
          <button type="button" className="ops-btn is-primary" disabled={pending || preview.imported === 0} onClick={doImport}>
            {pending ? "Importing…" : `Import ${preview.imported.toLocaleString("en-IN")} rows`}
          </button>
        )}
      </div>
    </div>
  );
}
