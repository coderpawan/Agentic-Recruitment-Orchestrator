from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# Enums
class PipelineStatus(str, Enum):
    PENDING = "pending"
    RESEARCHING = "researching"
    EVALUATING = "evaluating"
    AWAITING_APPROVAL = "awaiting_approval"
    WRITING_EMAILS = "writing_emails"
    COMPLETED = "completed"
    FAILED = "failed"


# Ingestion
class DocumentMeta(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    doc_type: str  # "jd" | "resume"
    text: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)


# Researcher output
class JDAnalysis(BaseModel):
    role_title: str = ""
    technical_requirements: list[str] = []
    soft_skills: list[str] = []
    cultural_fit_indicators: list[str] = []
    experience_level: str = ""
    education_requirements: list[str] = []
    nice_to_haves: list[str] = []
    summary: str = ""


# Evaluator output
class GapItem(BaseModel):
    skill: str
    trainable: bool = True
    severity: str = "low"  # low | medium | high


class CandidateEvaluation(BaseModel):
    resume_id: str
    candidate_name: str = "Unknown"
    match_percentage: float = 0.0
    reasoning: str = ""
    strengths: list[str] = []
    gap_analysis: list[GapItem] = []
    notable_projects: list[str] = []
    shortlisted: bool = False


# Writer output
class OutreachEmail(BaseModel):
    resume_id: str
    candidate_name: str
    subject: str = ""
    body: str = ""


# Pipeline state (held in-memory)
class PipelineRun(BaseModel):
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: PipelineStatus = PipelineStatus.PENDING
    jd_id: str = ""
    jd_text: str = ""
    jd_analysis: Optional[JDAnalysis] = None
    resume_ids: list[str] = []
    evaluations: list[CandidateEvaluation] = []
    approved_resume_ids: list[str] = []
    emails: list[OutreachEmail] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    error: Optional[str] = None


# API request / response helpers
class StartPipelineRequest(BaseModel):
    jd_id: str
    top_n: int = 5


class ApproveShortlistRequest(BaseModel):
    approved_resume_ids: list[str]


class EditEmailRequest(BaseModel):
    subject: str
    body: str


class PipelineRunResponse(BaseModel):
    run_id: str
    status: PipelineStatus
    jd_analysis: Optional[JDAnalysis] = None
    evaluations: list[CandidateEvaluation] = []
    emails: list[OutreachEmail] = []
    error: Optional[str] = None
