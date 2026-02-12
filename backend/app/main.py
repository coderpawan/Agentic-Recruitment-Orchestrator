from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Dict

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.agents import run_evaluator, run_researcher, run_writer
from app.config import DEFAULT_TOP_N, FRONTEND_URL
from app.ingestion import save_and_extract
from app.models import (
    ApproveShortlistRequest,
    CandidateEvaluation,
    DocumentMeta,
    EditEmailRequest,
    PipelineRun,
    PipelineRunResponse,
    PipelineStatus,
    StartPipelineRequest,
)
from app.vector_store import add_resume, get_full_resume_text, query_resumes, reset_collection

logger = logging.getLogger("recruitment_orchestrator")

# ── In-memory stores (swap for a real DB in production) ───────────────────────
documents: Dict[str, DocumentMeta] = {}
pipeline_runs: Dict[str, PipelineRun] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🟢 Recruitment Orchestrator starting …")
    yield
    logger.info("🔴 Recruitment Orchestrator shutting down …")


app = FastAPI(
    title="Agentic Recruitment Orchestrator",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


#  UPLOAD ENDPOINTS

@app.post("/api/upload/jd", response_model=DocumentMeta)
async def upload_jd(file: UploadFile = File(...)):
    # Purge previous session state
    documents.clear()
    pipeline_runs.clear()
    reset_collection()

    file_bytes = await file.read()
    meta = await save_and_extract(file_bytes, file.filename, doc_type="jd")
    documents[meta.id] = meta
    return meta


@app.post("/api/upload/resumes", response_model=list[DocumentMeta])
async def upload_resumes(files: list[UploadFile] = File(...)):
    results: list[DocumentMeta] = []
    for f in files:
        file_bytes = await f.read()
        meta = await save_and_extract(file_bytes, f.filename, doc_type="resume")
        documents[meta.id] = meta
        # Store embedding in vector DB
        add_resume(resume_id=meta.id, filename=meta.filename, text=meta.text)
        results.append(meta)
    return results


@app.get("/api/documents", response_model=list[DocumentMeta])
async def list_documents():
    return list(documents.values())


#  PIPELINE ENDPOINTS

@app.post("/api/pipeline/start", response_model=PipelineRunResponse)
async def start_pipeline(req: StartPipelineRequest):
    jd = documents.get(req.jd_id)
    if not jd or jd.doc_type != "jd":
        raise HTTPException(404, "JD not found")

    # Clamp top_n to the number of resumes in this session
    resume_count = sum(1 for d in documents.values() if d.doc_type == "resume")
    if resume_count == 0:
        raise HTTPException(400, "No resumes uploaded yet")
    effective_top_n = min(req.top_n, resume_count)

    run = PipelineRun(jd_id=req.jd_id, jd_text=jd.text)
    pipeline_runs[run.run_id] = run

    # Launch the pipeline asynchronously so the endpoint returns immediately
    asyncio.create_task(_run_pipeline(run, effective_top_n))

    return _to_response(run)


async def _run_pipeline(run: PipelineRun, top_n: int):
    try:
        # ── Step 1: Researcher ────────────────────────────────────────────
        run.status = PipelineStatus.RESEARCHING
        jd_analysis = await run_researcher(run.jd_text)
        run.jd_analysis = jd_analysis
        logger.info(f"[{run.run_id}] Researcher complete")

        # ── Step 2: Vector search ─────────────────────────────────────────
        retrieved = query_resumes(run.jd_text, top_n=top_n)
        if not retrieved:
            run.status = PipelineStatus.FAILED
            run.error = "No resumes found in the vector store."
            return

        # Reassemble full text for each resume
        resumes_for_eval: list[dict] = []
        for r in retrieved:
            full_text = get_full_resume_text(r["resume_id"])
            resumes_for_eval.append(
                {
                    "resume_id": r["resume_id"],
                    "filename": r["filename"],
                    "text": full_text or r["text"],
                }
            )
        run.resume_ids = [r["resume_id"] for r in resumes_for_eval]

        # ── Step 3: Evaluator ─────────────────────────────────────────────
        run.status = PipelineStatus.EVALUATING
        evaluations = await run_evaluator(jd_analysis, resumes_for_eval)
        run.evaluations = evaluations
        logger.info(f"[{run.run_id}] Evaluator complete – {len(evaluations)} candidates scored")

        # ── Pause for human approval ──────────────────────────────────────
        run.status = PipelineStatus.AWAITING_APPROVAL

    except Exception as exc:
        logger.exception(f"[{run.run_id}] Pipeline error")
        run.status = PipelineStatus.FAILED
        run.error = str(exc)


@app.get("/api/pipeline/{run_id}", response_model=PipelineRunResponse)
async def get_pipeline(run_id: str):
    run = pipeline_runs.get(run_id)
    if not run:
        raise HTTPException(404, "Pipeline run not found")
    return _to_response(run)


@app.post("/api/pipeline/{run_id}/approve", response_model=PipelineRunResponse)
async def approve_shortlist(run_id: str, req: ApproveShortlistRequest):
    run = pipeline_runs.get(run_id)
    if not run:
        raise HTTPException(404, "Pipeline run not found")
    if run.status != PipelineStatus.AWAITING_APPROVAL:
        raise HTTPException(400, f"Cannot approve in status {run.status}")

    run.approved_resume_ids = req.approved_resume_ids
    # Launch email-writing in background
    asyncio.create_task(_write_emails(run))
    return _to_response(run)


async def _write_emails(run: PipelineRun):
    try:
        run.status = PipelineStatus.WRITING_EMAILS

        approved_evals = [
            e for e in run.evaluations if e.resume_id in run.approved_resume_ids
        ]
        if not approved_evals:
            run.status = PipelineStatus.COMPLETED
            return

        # Gather resume texts for the writer
        resumes_for_writer: list[dict] = []
        for ev in approved_evals:
            text = get_full_resume_text(ev.resume_id)
            doc = documents.get(ev.resume_id)
            resumes_for_writer.append(
                {
                    "resume_id": ev.resume_id,
                    "filename": doc.filename if doc else "unknown",
                    "text": text,
                }
            )

        emails = await run_writer(run.jd_analysis, approved_evals, resumes_for_writer)
        run.emails = emails
        run.status = PipelineStatus.COMPLETED
        logger.info(f"[{run.run_id}] Writer complete – {len(emails)} emails drafted")

    except Exception as exc:
        logger.exception(f"[{run.run_id}] Writer error")
        run.status = PipelineStatus.FAILED
        run.error = str(exc)


@app.put("/api/pipeline/{run_id}/emails/{resume_id}", response_model=PipelineRunResponse)
async def edit_email(run_id: str, resume_id: str, req: EditEmailRequest):
    run = pipeline_runs.get(run_id)
    if not run:
        raise HTTPException(404, "Pipeline run not found")

    for email in run.emails:
        if email.resume_id == resume_id:
            email.subject = req.subject
            email.body = req.body
            return _to_response(run)

    raise HTTPException(404, "Email not found for given resume_id")


# Helpers

def _to_response(run: PipelineRun) -> PipelineRunResponse:
    return PipelineRunResponse(
        run_id=run.run_id,
        status=run.status,
        jd_analysis=run.jd_analysis,
        evaluations=run.evaluations,
        emails=run.emails,
        error=run.error,
    )


# Session reset (explicit)

@app.post("/api/session/reset")
async def reset_session():
    """Manually purge all in-memory state and ChromaDB embeddings."""
    documents.clear()
    pipeline_runs.clear()
    reset_collection()
    return {"status": "ok"}


# Dev entry-point
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
