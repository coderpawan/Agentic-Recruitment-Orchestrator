from __future__ import annotations

import json
import re
from textwrap import dedent
from typing import Any

from crewai import Agent, Crew, Process, Task
from crewai import LLM

from app.config import GROQ_API_KEY, GROQ_MODEL
from app.models import (
    CandidateEvaluation,
    GapItem,
    JDAnalysis,
    OutreachEmail,
)


# LLM factory (Groq)
def _build_llm() -> LLM:
    return LLM(
        model=f"groq/{GROQ_MODEL}",
        api_key=GROQ_API_KEY,
        temperature=0,
    )


#  1. RESEARCHER

def _researcher_agent(llm: LLM) -> Agent:
    return Agent(
        role="JD Researcher",
        goal="Extract structured requirements from a Job Description.",
        backstory=(
            "Seasoned technical recruiter (15 yrs). "
            "Expert at distinguishing must-haves from nice-to-haves."
        ),
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )


def _researcher_task(agent: Agent, jd_text: str) -> Task:
    return Task(
        description=dedent(f"""\
            Analyse the following Job Description and produce a structured
            JSON object with these exact keys:
            - role_title (string)
            - technical_requirements (array of strings)
            - soft_skills (array of strings)
            - cultural_fit_indicators (array of strings)
            - experience_level (string, e.g. "Senior", "Mid-level")
            - education_requirements (array of strings)
            - nice_to_haves (array of strings)
            - summary (string – a 2-3 sentence executive summary)

            Use deep reasoning — do NOT rely on keyword matching.
            Infer implicit requirements from context.

            === JOB DESCRIPTION ===
            {jd_text}
        """),
        expected_output="A single raw JSON object (no markdown fences).",
        agent=agent,
    )


#  2. EVALUATOR

def _evaluator_agent(llm: LLM) -> Agent:
    return Agent(
        role="Candidate Evaluator",
        goal=(
            "Score each resume against JD requirements with match %, "
            "reasoning, strengths, gap analysis, and notable projects."
        ),
        backstory=(
            "Impartial AI evaluator. Balances skill match with "
            "transferable experience and growth potential."
        ),
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )


def _evaluator_task(
    agent: Agent,
    jd_analysis_json: str,
    resumes: list[dict],
) -> Task:
    resumes_block = "\n---\n".join(
        f"RESUME_ID: {r['resume_id']}\nFILENAME: {r['filename']}\n\n{r['text']}"
        for r in resumes
    )
    return Task(
        description=dedent(f"""\
            You are given a structured JD analysis and a set of candidate
            resumes. For EACH resume produce a JSON object with these keys:
            - resume_id (string – copy from the RESUME_ID header)
            - candidate_name (string – extract from resume)
            - match_percentage (number 0-100)
            - reasoning (string – a detailed paragraph explaining WHY
              this candidate is or is not a good fit; use LLM reasoning,
              NOT keyword matching)
            - strengths (array of strings)
            - gap_analysis (array of objects with keys: skill, trainable,
              severity where trainable is boolean and severity is
              "low" | "medium" | "high")
            - notable_projects (array of strings – specific project names
              or descriptions found in the resume)
            - shortlisted (boolean – true if match_percentage >= 60)

            Return a JSON ARRAY of these objects (one per resume).
            Wrap your response in NO markdown fences.

            === JD ANALYSIS ===
            {jd_analysis_json}

            === RESUMES ===
            {resumes_block}
        """),
        expected_output="A raw JSON array of candidate evaluation objects.",
        agent=agent,
    )


#  3. WRITER

def _writer_agent(llm: LLM) -> Agent:
    return Agent(
        role="Outreach Copywriter",
        goal=(
            "Write personalised outreach emails for shortlisted candidates "
            "referencing a specific project from their resume."
        ),
        backstory=(
            "Expert recruiter copywriter with 40%+ response rates. "
            "Concise, warm, always candidate-specific."
        ),
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )


def _writer_task(
    agent: Agent,
    evaluations_json: str,
    jd_analysis_json: str,
    resumes: list[dict],
) -> Task:
    resumes_block = "\n---\n".join(
        f"RESUME_ID: {r['resume_id']}\n\n{r['text']}" for r in resumes
    )
    return Task(
        description=dedent(f"""\
            For each of the following shortlisted candidate evaluations,
            write a personalised outreach email.

            Each email MUST:
            1. Address the candidate by name.
            2. Mention a SPECIFIC project or achievement from their resume.
            3. Explain why their background is a great fit for the role.
            4. Keep the tone professional yet warm, and under 200 words.

            Return a JSON ARRAY of objects with keys:
            - resume_id (string)
            - candidate_name (string)
            - subject (string – the email subject line)
            - body (string – the full email body)

            No markdown fences.

            === JD ANALYSIS ===
            {jd_analysis_json}

            === EVALUATIONS ===
            {evaluations_json}

            === RESUMES ===
            {resumes_block}
        """),
        expected_output="A raw JSON array of email objects.",
        agent=agent,
    )


#  PUBLIC CREW RUNNERS

def _parse_json(raw: str) -> Any:
    # Strip markdown code fences if present
    cleaned = re.sub(r"```(?:json)?\s*", "", raw)
    cleaned = cleaned.strip().rstrip("`")
    return json.loads(cleaned)


async def run_researcher(jd_text: str) -> JDAnalysis:
    llm = _build_llm()
    agent = _researcher_agent(llm)
    task = _researcher_task(agent, jd_text)
    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )
    result = crew.kickoff()
    parsed = _parse_json(result.raw)
    return JDAnalysis(**parsed)


async def run_evaluator(
    jd_analysis: JDAnalysis,
    resumes: list[dict],
) -> list[CandidateEvaluation]:
    llm = _build_llm()
    agent = _evaluator_agent(llm)
    jd_json = jd_analysis.model_dump_json()
    task = _evaluator_task(agent, jd_json, resumes)
    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )
    result = crew.kickoff()
    parsed = _parse_json(result.raw)
    evaluations: list[CandidateEvaluation] = []
    for item in parsed:
        # Normalise gap_analysis items
        gaps = [
            GapItem(**g) if isinstance(g, dict) else GapItem(skill=str(g))
            for g in item.get("gap_analysis", [])
        ]
        item["gap_analysis"] = gaps
        evaluations.append(CandidateEvaluation(**item))
    return evaluations


async def run_writer(
    jd_analysis: JDAnalysis,
    evaluations: list[CandidateEvaluation],
    resumes: list[dict],
) -> list[OutreachEmail]:
    llm = _build_llm()
    agent = _writer_agent(llm)
    jd_json = jd_analysis.model_dump_json()
    evals_json = json.dumps([e.model_dump() for e in evaluations])
    task = _writer_task(agent, evals_json, jd_json, resumes)
    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )
    result = crew.kickoff()
    parsed = _parse_json(result.raw)
    return [OutreachEmail(**e) for e in parsed]
