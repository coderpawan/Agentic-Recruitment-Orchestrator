/* ─────────────────────────────────────────────────────────────────────────────
 *  TypeScript types mirroring the backend Pydantic models.
 * ───────────────────────────────────────────────────────────────────────────── */

export type PipelineStatus =
  | "pending"
  | "researching"
  | "evaluating"
  | "awaiting_approval"
  | "writing_emails"
  | "completed"
  | "failed";

export interface DocumentMeta {
  id: string;
  filename: string;
  doc_type: "jd" | "resume";
  text: string;
  uploaded_at: string;
}

export interface JDAnalysis {
  role_title: string;
  technical_requirements: string[];
  soft_skills: string[];
  cultural_fit_indicators: string[];
  experience_level: string;
  education_requirements: string[];
  nice_to_haves: string[];
  summary: string;
}

export interface GapItem {
  skill: string;
  trainable: boolean;
  severity: "low" | "medium" | "high";
}

export interface CandidateEvaluation {
  resume_id: string;
  candidate_name: string;
  match_percentage: number;
  reasoning: string;
  strengths: string[];
  gap_analysis: GapItem[];
  notable_projects: string[];
  shortlisted: boolean;
}

export interface OutreachEmail {
  resume_id: string;
  candidate_name: string;
  subject: string;
  body: string;
}

export interface PipelineRunResponse {
  run_id: string;
  status: PipelineStatus;
  jd_analysis: JDAnalysis | null;
  evaluations: CandidateEvaluation[];
  emails: OutreachEmail[];
  error: string | null;
}
