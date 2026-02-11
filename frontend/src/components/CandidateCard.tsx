"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Mail,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Trophy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { CandidateEvaluation, OutreachEmail } from "@/lib/types";

/* ── Helper: colour for match % ───────────────────────────────────────────── */
function matchColor(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function severityVariant(s: string) {
  if (s === "high") return "destructive" as const;
  if (s === "medium") return "warning" as const;
  return "secondary" as const;
}

/* ── Props ─────────────────────────────────────────────────────────────────── */
interface CandidateCardProps {
  evaluation: CandidateEvaluation;
  email?: OutreachEmail;
  selected: boolean;
  onToggleSelect: (resumeId: string) => void;
  onOpenEmail: (email: OutreachEmail) => void;
  showApproval: boolean;
}

/* ── Component ─────────────────────────────────────────────────────────────── */
export default function CandidateCard({
  evaluation,
  email,
  selected,
  onToggleSelect,
  onOpenEmail,
  showApproval,
}: CandidateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const ev = evaluation;

  return (
    <Card
      className={`transition-all duration-200 ${
        selected ? "ring-2 ring-primary" : ""
      } hover:shadow-md`}
    >
      {/* ── Header row ──────────────────────────────────────────────────── */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {showApproval && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect(ev.resume_id)}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
              />
            )}
            <div className="min-w-0">
              <CardTitle className="text-lg truncate">{ev.candidate_name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {ev.resume_id.slice(0, 8)}…
              </p>
            </div>
          </div>

          {/* match circle */}
          <div className="flex flex-col items-center shrink-0">
            <div
              className={`flex items-center justify-center h-14 w-14 rounded-full text-white font-bold text-sm ${matchColor(
                ev.match_percentage
              )}`}
            >
              {Math.round(ev.match_percentage)}%
            </div>
            <span className="text-[10px] text-muted-foreground mt-1">Match</span>
          </div>
        </div>

        {/* progress bar */}
        <Progress
          value={ev.match_percentage}
          className="h-2 mt-2"
          indicatorClassName={matchColor(ev.match_percentage)}
        />
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Strengths pills ───────────────────────────────────────────── */}
        {ev.strengths.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ev.strengths.slice(0, 5).map((s) => (
              <Badge key={s} variant="success" className="text-[11px]">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {s}
              </Badge>
            ))}
            {ev.strengths.length > 5 && (
              <Badge variant="outline" className="text-[11px]">
                +{ev.strengths.length - 5} more
              </Badge>
            )}
          </div>
        )}

        {/* ── Shortlist badge ───────────────────────────────────────────── */}
        {ev.shortlisted && (
          <Badge variant="default" className="gap-1">
            <Trophy className="w-3 h-3" /> Shortlisted
          </Badge>
        )}

        {/* ── Expandable AI Insights ────────────────────────────────────── */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-primary hover:underline w-full text-left"
        >
          <Brain className="w-4 h-4" />
          AI Insights
          {expanded ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
        </button>

        {expanded && (
          <div className="space-y-4 border-t pt-4 animate-in slide-in-from-top-2 duration-200">
            {/* Reasoning */}
            <div>
              <h4 className="text-sm font-semibold mb-1 flex items-center gap-1">
                <Brain className="w-4 h-4 text-primary" /> Evaluator Reasoning
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {ev.reasoning}
              </p>
            </div>

            {/* Gap Analysis */}
            {ev.gap_analysis.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Gap Analysis
                </h4>
                <div className="space-y-1.5">
                  {ev.gap_analysis.map((g) => (
                    <div key={g.skill} className="flex items-center gap-2 text-sm">
                      <Badge variant={severityVariant(g.severity)} className="text-[10px] uppercase">
                        {g.severity}
                      </Badge>
                      <span>{g.skill}</span>
                      {g.trainable && (
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          Trainable
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notable Projects */}
            {ev.notable_projects.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-1">Notable Projects</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                  {ev.notable_projects.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── Email button ──────────────────────────────────────────────── */}
        {email && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={() => onOpenEmail(email)}
          >
            <Mail className="w-4 h-4 mr-2" />
            View Outreach Email
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
