"use client";

import React, { useCallback, useState } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { uploadJD, uploadResumes } from "@/lib/api";
import type { DocumentMeta } from "@/lib/types";

interface UploadPanelProps {
  onJDUploaded: (doc: DocumentMeta) => void;
  onResumesUploaded: (docs: DocumentMeta[]) => void;
  topN: number;
  onTopNChange: (n: number) => void;
  maxTopN: number;
}

export default function UploadPanel({ onJDUploaded, onResumesUploaded, topN, onTopNChange, maxTopN }: UploadPanelProps) {
  const [jdLoading, setJdLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [jdFile, setJdFile] = useState<string | null>(null);
  const [resumeFiles, setResumeFiles] = useState<string[]>([]);

  const handleJD = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setJdLoading(true);
      try {
        const doc = await uploadJD(file);
        setJdFile(doc.filename);
        onJDUploaded(doc);
      } catch (err) {
        console.error(err);
        alert("Failed to upload JD");
      } finally {
        setJdLoading(false);
      }
    },
    [onJDUploaded]
  );

  const handleResumes = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setResumeLoading(true);
      try {
        const docs = await uploadResumes(Array.from(files));
        setResumeFiles(docs.map((d) => d.filename));
        onResumesUploaded(docs);
      } catch (err) {
        console.error(err);
        alert("Failed to upload resumes");
      } finally {
        setResumeLoading(false);
      }
    },
    [onResumesUploaded]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* JD upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Job Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 cursor-pointer hover:border-primary/50 transition-colors">
            {jdLoading ? (
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            ) : (
              <Upload className="w-8 h-8 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">
              {jdFile ? jdFile : "Upload PDF or TXT"}
            </span>
            <input
              type="file"
              accept=".pdf,.txt,.text,.md"
              className="hidden"
              onChange={handleJD}
              disabled={jdLoading}
            />
          </label>
          {jdFile && (
            <Badge variant="success" className="mt-2">
              Uploaded
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Resume upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Resumes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 cursor-pointer hover:border-primary/50 transition-colors">
            {resumeLoading ? (
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            ) : (
              <Upload className="w-8 h-8 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">
              {resumeFiles.length > 0
                ? `${resumeFiles.length} file(s) uploaded`
                : "Upload multiple PDFs"}
            </span>
            <input
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={handleResumes}
              disabled={resumeLoading}
            />
          </label>
          {resumeFiles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {resumeFiles.map((f) => (
                <Badge key={f} variant="secondary" className="text-xs">
                  {f}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Top N input — visible once resumes are uploaded */}
      {resumeFiles.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <label htmlFor="topN" className="text-sm font-medium whitespace-nowrap">
                Top Candidates to Analyze
              </label>
              <input
                id="topN"
                type="number"
                min={1}
                max={maxTopN || 1}
                value={topN}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(Number(e.target.value), maxTopN || 1));
                  onTopNChange(v);
                }}
                className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
              <span className="text-xs text-muted-foreground">
                (max {maxTopN} — total resumes uploaded)
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
