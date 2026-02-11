"use client";

import React from "react";
import { Loader2, CheckCircle2, AlertCircle, Clock, Brain, PenTool, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PipelineStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  PipelineStatus,
  { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="w-4 h-4" />,
    variant: "secondary",
  },
  researching: {
    label: "Researcher Agent Working…",
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    variant: "default",
  },
  evaluating: {
    label: "Evaluator Agent Scoring…",
    icon: <Brain className="w-4 h-4 animate-pulse" />,
    variant: "default",
  },
  awaiting_approval: {
    label: "Awaiting Your Approval",
    icon: <ShieldCheck className="w-4 h-4" />,
    variant: "warning",
  },
  writing_emails: {
    label: "Writer Agent Drafting Emails…",
    icon: <PenTool className="w-4 h-4 animate-pulse" />,
    variant: "default",
  },
  completed: {
    label: "Pipeline Complete",
    icon: <CheckCircle2 className="w-4 h-4" />,
    variant: "success",
  },
  failed: {
    label: "Pipeline Failed",
    icon: <AlertCircle className="w-4 h-4" />,
    variant: "destructive",
  },
};

interface StatusBannerProps {
  status: PipelineStatus;
  error?: string | null;
}

export default function StatusBanner({ status, error }: StatusBannerProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className="flex items-center gap-3">
      <Badge variant={cfg.variant} className="gap-1.5 py-1 px-3 text-sm">
        {cfg.icon}
        {cfg.label}
      </Badge>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
