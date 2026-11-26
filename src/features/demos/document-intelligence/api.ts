"use client";

import { DOCDESK_API } from "./nav";
import type { Answer, Comparison, DocDetail, DocSummary, Extraction, Limits, QualityReport, ReviewItem } from "./types";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export interface Quota {
  remaining: number | null;
  limit: number | null;
}

async function call<T>(path: string, init?: RequestInit): Promise<{ data: T; quota: Quota }> {
  let res: Response;
  try {
    res = await fetch(`${DOCDESK_API}/${path}`, { ...init, cache: "no-store" });
  } catch {
    throw new ApiError("network", "Couldn't reach DocDesk. Check your connection and try again.", 0);
  }
  const quota: Quota = {
    remaining: res.headers.has("x-ai-remaining") ? Number(res.headers.get("x-ai-remaining")) : null,
    limit: res.headers.has("x-ai-limit") ? Number(res.headers.get("x-ai-limit")) : null,
  };
  if (!res.ok) {
    let code = "error";
    let message = "Something went wrong. Please try again.";
    try {
      const body = (await res.json()) as { detail?: { code?: string; message?: string } | string };
      if (body.detail && typeof body.detail === "object") {
        code = body.detail.code ?? code;
        message = body.detail.message ?? message;
      }
    } catch {
      /* not JSON */
    }
    const err = new ApiError(code, message, res.status);
    (err as ApiError & { quota?: Quota }).quota = quota;
    throw err;
  }
  return { data: (await res.json()) as T, quota };
}

export const listDocs = () => call<{ documents: DocSummary[] }>("documents").then((r) => r.data.documents);
export const getDoc = (id: string) => call<DocDetail>(`documents/${id}`).then((r) => r.data);
export const getExtraction = (id: string) => call<Extraction>(`documents/${id}/extract`).then((r) => r.data);
export const getLimits = () => call<Limits>("limits").then((r) => r.data);
export const getQuality = () => call<QualityReport>("quality").then((r) => r.data);
export const getReview = (uploads: string[]) => call<{ items: ReviewItem[] }>(`review?uploads=${encodeURIComponent(uploads.join(","))}`).then((r) => r.data.items);
export const compareDocs = (a: string, b: string) => call<Comparison>(`compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`).then((r) => r.data);
export const pageSrc = (id: string, n: number) => `${DOCDESK_API}/documents/${id}/pages/${n}`;

export const askDoc = (id: string, body: { question: string; history: { role: string; content: string }[] } | { example: number }) =>
  call<Answer>(`documents/${id}/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export async function uploadDoc(file: File) {
  const form = new FormData();
  form.set("file", file);
  return call<DocDetail>("documents", { method: "POST", body: form });
}

/* Visitor uploads are remembered for this browser tab only (the service deletes them after an hour). */
const KEY = "docdesk.uploads";
export function rememberedUploads(): DocSummary[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as DocSummary[];
  } catch {
    return [];
  }
}
export function rememberUpload(doc: DocSummary) {
  try {
    const list = [doc, ...rememberedUploads().filter((d) => d.id !== doc.id)].slice(0, 10);
    sessionStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}
export function forgetUpload(id: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(rememberedUploads().filter((d) => d.id !== id)));
  } catch {
    /* storage unavailable */
  }
}

/* Small per-browser state (approvals, edits, review decisions). */
export function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`docdesk.${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(`docdesk.${key}`, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}
