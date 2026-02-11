/* ─────────────────────────────────────────────────────────────────────────────
 *  Thin API client – all calls go through Next.js rewrite → FastAPI.
 * ───────────────────────────────────────────────────────────────────────────── */

import type {
  DocumentMeta,
  OutreachEmail,
  PipelineRunResponse,
} from "./types";

const BASE = "/api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/* ── Upload ─────────────────────────────────────────────────────────────── */

export async function uploadJD(file: File): Promise<DocumentMeta> {
  const fd = new FormData();
  fd.append("file", file);
  return json<DocumentMeta>(await fetch(`${BASE}/upload/jd`, { method: "POST", body: fd }));
}

export async function uploadResumes(files: File[]): Promise<DocumentMeta[]> {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return json<DocumentMeta[]>(await fetch(`${BASE}/upload/resumes`, { method: "POST", body: fd }));
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  return json<DocumentMeta[]>(await fetch(`${BASE}/documents`));
}

/* ── Pipeline ───────────────────────────────────────────────────────────── */

export async function startPipeline(jdId: string, topN = 5): Promise<PipelineRunResponse> {
  return json<PipelineRunResponse>(
    await fetch(`${BASE}/pipeline/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jd_id: jdId, top_n: topN }),
    })
  );
}

export async function getPipeline(runId: string): Promise<PipelineRunResponse> {
  return json<PipelineRunResponse>(await fetch(`${BASE}/pipeline/${runId}`));
}

export async function approveShortlist(
  runId: string,
  approvedResumeIds: string[]
): Promise<PipelineRunResponse> {
  return json<PipelineRunResponse>(
    await fetch(`${BASE}/pipeline/${runId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved_resume_ids: approvedResumeIds }),
    })
  );
}

export async function editEmail(
  runId: string,
  resumeId: string,
  subject: string,
  body: string
): Promise<PipelineRunResponse> {
  return json<PipelineRunResponse>(
    await fetch(`${BASE}/pipeline/${runId}/emails/${resumeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    })
  );
}

/* ── Session ───────────────────────────────────────────────────────────────── */

export async function resetSession(): Promise<void> {
  await fetch(`${BASE}/session/reset`, { method: "POST" });
}
