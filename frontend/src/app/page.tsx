"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Rocket,
  Users,
  CheckCheck,
  FileSearch2,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CandidateCard from "@/components/CandidateCard";
import EmailModal from "@/components/EmailModal";
import UploadPanel from "@/components/UploadPanel";
import StatusBanner from "@/components/StatusBanner";
import {
  startPipeline,
  getPipeline,
  approveShortlist,
  editEmail,
  resetSession,
} from "@/lib/api";
import type {
  DocumentMeta,
  PipelineRunResponse,
  OutreachEmail,
  PipelineStatus,
} from "@/lib/types";

/* ── Polling statuses that require continued fetching ──────────────────────── */
const ACTIVE_STATUSES: PipelineStatus[] = [
  "pending",
  "researching",
  "evaluating",
  "writing_emails",
];

export default function DashboardPage() {
  /* ── Upload state ────────────────────────────────────────────────────────── */
  const [jd, setJd] = useState<DocumentMeta | null>(null);
  const [resumes, setResumes] = useState<DocumentMeta[]>([]);

  /* ── Pipeline state ──────────────────────────────────────────────────────── */
  const [pipeline, setPipeline] = useState<PipelineRunResponse | null>(null);
  const [launching, setLaunching] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Approval selection ──────────────────────────────────────────────────── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* ── Email modal ─────────────────────────────────────────────────────────── */
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [activeEmail, setActiveEmail] = useState<OutreachEmail | null>(null);

  /* ── Top-N setting ───────────────────────────────────────────────────────── */
  const [topN, setTopN] = useState(5);

  /* ── Polling logic ───────────────────────────────────────────────────────── */
  const startPolling = useCallback((runId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const data = await getPipeline(runId);
        setPipeline(data);
        if (!ACTIVE_STATUSES.includes(data.status)) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
        }
      } catch {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
      }
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  /* ── Handlers ────────────────────────────────────────────────────────────── */  const handleNewJD = async (doc: DocumentMeta) => {
    // Purge all previous session state for a clean slate
    setResumes([]);
    setPipeline(null);
    setSelectedIds(new Set());
    setTopN(5);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setJd(doc);
  };

  const handleResumesUploaded = (docs: DocumentMeta[]) => {
    setResumes((prev) => {
      const next = [...prev, ...docs];
      // Auto-clamp topN to the new total
      if (topN > next.length) setTopN(next.length);
      return next;
    });
  };
  const handleLaunch = async () => {
    if (!jd) return;
    setLaunching(true);
    try {
      const data = await startPipeline(jd.id, Math.min(topN, resumes.length));
      setPipeline(data);
      startPolling(data.run_id);
    } catch (err) {
      console.error(err);
      alert("Failed to start pipeline");
    } finally {
      setLaunching(false);
    }
  };

  const toggleSelect = (rid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(rid) ? next.delete(rid) : next.add(rid);
      return next;
    });
  };

  const handleApprove = async () => {
    if (!pipeline) return;
    try {
      const data = await approveShortlist(pipeline.run_id, Array.from(selectedIds));
      setPipeline(data);
      startPolling(pipeline.run_id);
    } catch (err) {
      console.error(err);
      alert("Approval failed");
    }
  };

  const handleSaveEmail = async (resumeId: string, subject: string, body: string) => {
    if (!pipeline) return;
    try {
      const data = await editEmail(pipeline.run_id, resumeId, subject, body);
      setPipeline(data);
      setEmailModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save email");
    }
  };

  /* ── Derived data ────────────────────────────────────────────────────────── */
  const emailMap = new Map(pipeline?.emails.map((e) => [e.resume_id, e]) ?? []);
  const shortlistedCount = pipeline?.evaluations.filter((e) => e.shortlisted).length ?? 0;
  const avgMatch =
    pipeline && pipeline.evaluations.length > 0
      ? Math.round(
          pipeline.evaluations.reduce((s, e) => s + e.match_percentage, 0) /
            pipeline.evaluations.length
        )
      : 0;

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center gap-4 px-4">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">
            Recruitment Command Center
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* ── Step 1: Upload ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileSearch2 className="w-5 h-5" /> Step 1 — Upload Documents
          </h2>
          <UploadPanel
            onJDUploaded={handleNewJD}
            onResumesUploaded={handleResumesUploaded}
            topN={topN}
            onTopNChange={setTopN}
            maxTopN={resumes.length}
          />
        </section>

        {/* ── Launch Pipeline ─────────────────────────────────────────────── */}
        {jd && resumes.length > 0 && !pipeline && (
          <section className="flex items-center gap-4">
            <Button onClick={handleLaunch} disabled={launching} size="lg">
              <Rocket className="w-5 h-5 mr-2" />
              {launching ? "Launching…" : "Launch Agent Pipeline"}
            </Button>
          </section>
        )}

        {/* ── Pipeline Status ─────────────────────────────────────────────── */}
        {pipeline && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <StatusBanner status={pipeline.status} error={pipeline.error} />
              {pipeline.evaluations.length > 0 && (
                <div className="flex gap-3">
                  <Badge variant="outline" className="gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {pipeline.evaluations.length} evaluated
                  </Badge>
                  <Badge variant="success" className="gap-1">
                    {shortlistedCount} shortlisted
                  </Badge>
                  <Badge variant="secondary">Avg {avgMatch}% match</Badge>
                </div>
              )}
            </div>

            {/* ── JD Analysis summary ──────────────────────────────────── */}
            {pipeline.jd_analysis && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">JD Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    <strong>Role:</strong> {pipeline.jd_analysis.role_title}
                  </p>
                  <p>
                    <strong>Level:</strong> {pipeline.jd_analysis.experience_level}
                  </p>
                  <p className="text-muted-foreground">{pipeline.jd_analysis.summary}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {pipeline.jd_analysis.technical_requirements.map((r) => (
                      <Badge key={r} variant="secondary" className="text-xs">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Candidate Cards Grid ─────────────────────────────────── */}
            {pipeline.evaluations.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" /> Candidates
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pipeline.evaluations
                    .sort((a, b) => b.match_percentage - a.match_percentage)
                    .map((ev) => (
                      <CandidateCard
                        key={ev.resume_id}
                        evaluation={ev}
                        email={emailMap.get(ev.resume_id)}
                        selected={selectedIds.has(ev.resume_id)}
                        onToggleSelect={toggleSelect}
                        onOpenEmail={(em) => {
                          setActiveEmail(em);
                          setEmailModalOpen(true);
                        }}
                        showApproval={pipeline.status === "awaiting_approval"}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* ── Approve button (HITL) ────────────────────────────────── */}
            {pipeline.status === "awaiting_approval" && (
              <div className="flex justify-end">
                <Button
                  size="lg"
                  disabled={selectedIds.size === 0}
                  onClick={handleApprove}
                >
                  <CheckCheck className="w-5 h-5 mr-2" />
                  Approve {selectedIds.size} Candidate{selectedIds.size !== 1 ? "s" : ""} & Draft
                  Emails
                </Button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── Email edit modal ──────────────────────────────────────────────── */}
      <EmailModal
        email={activeEmail}
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        onSave={handleSaveEmail}
      />
    </div>
  );
}
