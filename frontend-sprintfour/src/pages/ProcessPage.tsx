import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTriageStore } from "@/store/useTriageStore";
import type { Redaction } from "@/store/useTriageStore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const API_BASE = "http://localhost:3001";

export function ProcessPage() {
  const {
    uploadedDoc,
    uploadLoading,
    uploadError,
    uploadDocument,
    clearUploadedDoc,
    userTier,
    triageMode,
    setTriageMode,
    currentUploadRedactionIndex,
    approveUploadRedaction,
    rejectUploadRedaction,
    navigateUploadRedaction,
    finalizeUploadedDocument,
    flashEffect,
    clearFlash,
    metrics,
  } = useTriageStore();

  const [viewMode, setViewMode] = useState<"pdf" | "text">("text");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flash effect cleanup
  useEffect(() => {
    if (flashEffect) {
      const t = setTimeout(clearFlash, 300);
      return () => clearTimeout(t);
    }
  }, [flashEffect, clearFlash]);

  // Vim-mode keyboard bindings (only when vim mode active and doc loaded)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!uploadedDoc || triageMode !== "vim") return;
      // Don't capture if typing in an input
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;

      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        finalizeUploadedDocument();
        return;
      }

      switch (e.key) {
        case "j": navigateUploadRedaction("next"); break;
        case "k": navigateUploadRedaction("prev"); break;
        case "y": approveUploadRedaction(); break;
        case "x": rejectUploadRedaction(); break;
      }
    },
    [uploadedDoc, triageMode, navigateUploadRedaction, approveUploadRedaction, rejectUploadRedaction, finalizeUploadedDocument]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // File handlers
  const handleFile = useCallback(
    (file: File) => {
      uploadDocument(file);
    },
    [uploadDocument]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // If no document uploaded yet, show upload zone
  if (!uploadedDoc && !uploadLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-3">Process Document</h1>
          <p className="text-sm text-slate-400">
            Upload a PDF or text file to begin PII detection and redaction.
          </p>
        </div>

        {/* Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed p-16 text-center transition-all ${
            dragOver
              ? "border-cyan-500 bg-cyan-500/10 scale-[1.01]"
              : "border-slate-700 bg-slate-900/30 hover:border-slate-600 hover:bg-slate-900/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.doc,.docx"
            onChange={handleInputChange}
            className="hidden"
          />
          <div className={`text-5xl mb-4 transition-transform ${dragOver ? "scale-110" : ""}`}>
            📄
          </div>
          <div className="text-sm font-medium text-slate-300 mb-2">
            Drop your document here, or{" "}
            <span className="text-cyan-400 underline underline-offset-2">browse files</span>
          </div>
          <div className="text-xs text-slate-500">
            Supports PDF, TXT, DOC, DOCX — up to 50MB
          </div>

          {userTier === "pro" && (
            <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-[10px] text-violet-400">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              Priority processing enabled
            </div>
          )}
        </div>

        {uploadError && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {uploadError}
          </div>
        )}

        {/* Quick Stats */}
        {metrics.processed > 0 && (
          <div className="mt-10 grid grid-cols-3 gap-4">
            <StatCard label="Processed Today" value={metrics.processed.toString()} color="text-cyan-400" />
            <StatCard
              label="Avg Time"
              value={`${metrics.processed > 0 ? Math.round(metrics.totalTimeSpent / metrics.processed / 1000) : 0}s`}
              color="text-amber-400"
            />
            <StatCard label="Redactions Made" value={(metrics.totalApproved + metrics.totalRejected).toString()} color="text-emerald-400" />
          </div>
        )}
      </div>
    );
  }

  // Loading state
  if (uploadLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-32">
        <div className="text-center space-y-6">
          <div className="w-12 h-12 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <div>
            <div className="text-sm font-medium text-slate-200">Processing document...</div>
            <div className="text-xs text-slate-500 mt-1">Running regex PII detection</div>
          </div>
        </div>
      </div>
    );
  }

  // Document loaded — show viewer + triage
  const doc = uploadedDoc!;
  const redactions = doc.redactions;
  const activeRedaction = redactions[currentUploadRedactionIndex];
  const allReviewed = redactions.every((r) => r.status !== "pending");
  const isPdf = doc.mimeType === "application/pdf";

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={clearUploadedDoc}
            className="px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-800 rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors"
          >
            ← Back
          </button>
          <span className="text-sm font-medium text-slate-200 truncate max-w-[300px]">
            {doc.filename}
          </span>
          <PhaseIndicator phase={doc.phase} />
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          {isPdf && (
            <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 p-0.5">
              <button
                onClick={() => setViewMode("pdf")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === "pdf"
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                PDF View
              </button>
              <button
                onClick={() => setViewMode("text")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === "text"
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Text + PII
              </button>
            </div>
          )}

          {/* Mode Toggle */}
          <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 p-0.5">
            <button
              onClick={() => setTriageMode("normal")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                triageMode === "normal"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              Normal
            </button>
            <button
              onClick={() => {
                if (userTier === "free") return;
                setTriageMode("vim");
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                triageMode === "vim"
                  ? "bg-violet-500/30 text-violet-300 border border-violet-500/30"
                  : userTier === "free"
                  ? "text-slate-600 cursor-not-allowed"
                  : "text-slate-400 hover:text-slate-300"
              }`}
              title={userTier === "free" ? "Upgrade to Pro for Vim Mode" : ""}
            >
              Vim Mode
              {userTier === "free" && (
                <span className="px-1 py-0.5 rounded bg-violet-500/20 text-violet-400 text-[8px] font-bold">PRO</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Viewer — 2/3 width */}
        <div className="lg:col-span-2">
          {viewMode === "pdf" && isPdf ? (
            <PdfViewer filePath={doc.filePath} />
          ) : (
            <DocumentTextViewer
              text={doc.text}
              redactions={redactions}
              activeIndex={currentUploadRedactionIndex}
            />
          )}
        </div>

        {/* Sidebar — Redactions Panel */}
        <div className="space-y-4">
          {/* Processing Status */}
          <Card className="bg-slate-900/80 border-slate-700/50">
            <CardContent className="p-4">
              <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">
                Processing Pipeline
              </div>
              <div className="space-y-2">
                <PipelineStep label="Text Extracted" done={true} />
                <PipelineStep label="Regex Scan" done={doc.phase !== "uploaded"} />
                <PipelineStep
                  label="AI Analysis"
                  done={doc.phase === "complete"}
                  active={doc.phase === "ai-processing" || doc.phase === "ai-queued"}
                />
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {redactions.length} PII items detected
              </div>
            </CardContent>
          </Card>

          {/* Redaction List */}
          <Card className="bg-slate-900/80 border-slate-700/50">
            <CardContent className="p-4">
              <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">
                Detected PII ({redactions.length})
              </div>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {redactions.map((r, i) => (
                  <RedactionItem
                    key={`${r.type}-${r.startIndex}`}
                    redaction={r}
                    isActive={i === currentUploadRedactionIndex}
                    index={i}
                    mode={triageMode}
                    flashEffect={i === currentUploadRedactionIndex ? flashEffect : null}
                    onApprove={() => {
                      useTriageStore.setState({ currentUploadRedactionIndex: i });
                      approveUploadRedaction();
                    }}
                    onReject={() => {
                      useTriageStore.setState({ currentUploadRedactionIndex: i });
                      rejectUploadRedaction();
                    }}
                    onSelect={() => useTriageStore.setState({ currentUploadRedactionIndex: i })}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-2">
            {triageMode === "normal" && activeRedaction && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={approveUploadRedaction}
                  className="py-2 px-4 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/30 transition-colors"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={rejectUploadRedaction}
                  className="py-2 px-4 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium hover:bg-red-500/30 transition-colors"
                >
                  ✗ Reject
                </button>
              </div>
            )}

            <button
              onClick={finalizeUploadedDocument}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                allReviewed
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40"
                  : "bg-slate-800 text-slate-500 border border-slate-700"
              }`}
            >
              {allReviewed ? "✓ Finalize Document" : `Review remaining (${redactions.filter((r) => r.status === "pending").length})`}
            </button>
          </div>

          {/* Vim Mode Legend */}
          {triageMode === "vim" && (
            <Card className="bg-slate-900/80 border-violet-500/30">
              <CardContent className="p-3">
                <div className="text-[10px] font-mono text-violet-400 uppercase tracking-wider mb-2">
                  Vim Controls
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span className="text-slate-400"><kbd className="kbd-key">J</kbd> next</span>
                  <span className="text-slate-400"><kbd className="kbd-key">K</kbd> prev</span>
                  <span className="text-slate-400"><kbd className="kbd-key bg-emerald-500/10 text-emerald-500 border-emerald-500/30">Y</kbd> approve</span>
                  <span className="text-slate-400"><kbd className="kbd-key bg-red-500/10 text-red-500 border-red-500/30">X</kbd> reject</span>
                  <span className="col-span-2 text-slate-400"><kbd className="kbd-key bg-cyan-500/10 text-cyan-400 border-cyan-500/30">⇧↵</kbd> finalize</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-center">
      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}

function PhaseIndicator({ phase }: { phase: string }) {
  const config: Record<string, { label: string; color: string }> = {
    uploaded: { label: "Uploaded", color: "bg-slate-500" },
    regex: { label: "Regex Done", color: "bg-amber-500" },
    "ai-queued": { label: "AI Queued", color: "bg-blue-500 animate-pulse" },
    "ai-processing": { label: "AI Processing...", color: "bg-violet-500 animate-pulse" },
    complete: { label: "Complete", color: "bg-emerald-500" },
    error: { label: "Error", color: "bg-red-500" },
  };

  const c = config[phase] || config.uploaded!;

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${c.color}`} />
      <span className="text-xs text-slate-400">{c.label}</span>
    </div>
  );
}

function PipelineStep({ label, done, active }: { label: string; done: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
          done
            ? "bg-emerald-500/20 text-emerald-400"
            : active
            ? "bg-violet-500/20 text-violet-400 animate-pulse"
            : "bg-slate-800 text-slate-600"
        }`}
      >
        {done ? "✓" : active ? "⟳" : "○"}
      </span>
      <span className={`text-xs ${done ? "text-slate-300" : active ? "text-violet-400" : "text-slate-600"}`}>
        {label}
      </span>
    </div>
  );
}

function PdfViewer({ filePath }: { filePath: string }) {
  const pdfUrl = `${API_BASE}${filePath}`;
  return (
    <Card className="bg-slate-900/80 border-slate-700/50 overflow-hidden">
      <CardContent className="p-0">
        <iframe
          src={pdfUrl}
          className="w-full h-[80vh] border-0 bg-white"
          title="PDF Viewer"
        />
      </CardContent>
    </Card>
  );
}

function DocumentTextViewer({
  text,
  redactions,
  activeIndex,
}: {
  text: string;
  redactions: Redaction[];
  activeIndex: number;
}) {
  const sorted = [...redactions]
    .map((r, i) => ({ ...r, originalIndex: i }))
    .sort((a, b) => a.startIndex - b.startIndex);

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  sorted.forEach((r) => {
    if (r.startIndex > lastEnd) {
      parts.push(
        <span key={`text-${lastEnd}`} className="text-slate-300">
          {text.slice(lastEnd, r.startIndex)}
        </span>
      );
    }

    const isActive = r.originalIndex === activeIndex;
    const statusClasses =
      r.status === "approved"
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
        : r.status === "rejected"
        ? "bg-red-500/20 text-red-300 line-through border-red-500/40"
        : "bg-amber-500/20 text-amber-300 border-amber-500/40";

    parts.push(
      <span
        key={`pii-${r.startIndex}`}
        className={`inline px-1 rounded border transition-all duration-200 ${statusClasses} ${
          isActive
            ? "ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-900 scale-105 font-semibold"
            : ""
        }`}
      >
        {r.value}
        <sup className="text-[10px] ml-0.5 opacity-60">{r.confidence}%</sup>
      </span>
    );

    lastEnd = r.endIndex;
  });

  if (lastEnd < text.length) {
    parts.push(
      <span key={`text-${lastEnd}`} className="text-slate-300">
        {text.slice(lastEnd)}
      </span>
    );
  }

  return (
    <Card className="bg-slate-900/80 border-slate-700/50">
      <CardContent className="p-0">
        <div className="px-4 py-2 border-b border-slate-700/50 flex items-center justify-between">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
            Document Text — PII Highlighted
          </span>
          <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-500">
            {redactions.length} PII items
          </Badge>
        </div>
        <div className="p-8 max-h-[80vh] overflow-y-auto">
          <div className="max-w-none bg-slate-950/50 rounded-lg p-8 border border-slate-800/50 font-mono text-sm leading-7 whitespace-pre-wrap">
            {parts}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RedactionItem({
  redaction,
  isActive,
  index,
  mode,
  flashEffect,
  onApprove,
  onReject,
  onSelect,
}: {
  redaction: Redaction;
  isActive: boolean;
  index: number;
  mode: "normal" | "vim";
  flashEffect: string | null;
  onApprove: () => void;
  onReject: () => void;
  onSelect: () => void;
}) {
  const statusIcon =
    redaction.status === "approved" ? "✓" : redaction.status === "rejected" ? "✗" : "?";
  const statusColor =
    redaction.status === "approved"
      ? "text-emerald-400"
      : redaction.status === "rejected"
      ? "text-red-400"
      : "text-amber-400";

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all duration-200 ${
        isActive
          ? "bg-slate-800/80 border-cyan-500/50"
          : "bg-transparent border-transparent hover:bg-slate-800/40 hover:border-slate-700"
      } ${
        flashEffect === "approve" ? "border-emerald-500 bg-emerald-500/5" : ""
      } ${
        flashEffect === "reject" ? "border-red-500 bg-red-500/5" : ""
      }`}
    >
      <span className={`w-4 text-center font-bold text-xs ${statusColor}`}>{statusIcon}</span>
      <Badge
        variant="outline"
        className={`text-[9px] px-1.5 ${isActive ? "border-cyan-500/50 text-cyan-400" : "border-slate-700 text-slate-500"}`}
      >
        {redaction.type}
      </Badge>
      <span className={`text-xs font-mono flex-1 truncate ${isActive ? "text-slate-200" : "text-slate-400"}`}>
        {redaction.value}
      </span>
      {mode === "normal" && isActive && redaction.status === "pending" && (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(); }}
            className="w-5 h-5 rounded flex items-center justify-center bg-emerald-500/20 text-emerald-400 text-[10px] hover:bg-emerald-500/30"
          >
            ✓
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onReject(); }}
            className="w-5 h-5 rounded flex items-center justify-center bg-red-500/20 text-red-400 text-[10px] hover:bg-red-500/30"
          >
            ✗
          </button>
        </div>
      )}
    </div>
  );
}
