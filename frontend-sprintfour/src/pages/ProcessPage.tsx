import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTriageStore } from "@/store/useTriageStore";
import type { Redaction, UploadedDocument } from "@/store/useTriageStore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AdminDashboard } from "@/components/AdminDashboard";

const API_BASE = "http://localhost:3001";

export function ProcessPage() {
  const {
    uploadedQueue,
    currentDocIndex,
    uploadLoading,
    uploadError,
    batchUpload,
    clearQueue,
    userTier,
    triageMode,
    setTriageMode,
    currentRedactionIndex,
    approveRedaction,
    approveAllRedactions,
    rejectRedaction,
    addManualRedaction,
    navigateRedaction,
    finalizeDocument,
    flashEffect,
    clearFlash,
    metrics,
    setCurrentDocIndex,
  } = useTriageStore();

  const [viewMode, setViewMode] = useState<"pdf" | "text">("text");
  const [dragOver, setDragOver] = useState(false);
  const [manualFlagValue, setManualFlagValue] = useState("");
  const [manualFlagType, setManualFlagType] = useState("MANUAL_FLAG");
  const [manualFlagError, setManualFlagError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const manualQueue = useMemo(
    () => uploadedQueue.filter((doc) => !doc.finalizedAt && doc.requiresReview),
    [uploadedQueue]
  );
  const exportedQueue = useMemo(
    () => uploadedQueue.filter((doc) => Boolean(doc.finalizedAt)),
    [uploadedQueue]
  );
  const autopilotQueue = useMemo(
    () => uploadedQueue.filter((doc) => !doc.finalizedAt && !doc.requiresReview),
    [uploadedQueue]
  );

  const doc = uploadedQueue[currentDocIndex];
  const redactions = doc?.redactions ?? [];
  const activeRedaction = redactions[currentRedactionIndex];
  const allReviewed = doc ? doc.pendingReviewCount === 0 : false;
  const pendingManualCount = manualQueue.length;
  const completedCount = exportedQueue.length;
  const benchmark = getBenchmarkData(userTier, pendingManualCount);

  useEffect(() => {
    if (flashEffect) {
      const timeout = setTimeout(clearFlash, 220);
      return () => clearTimeout(timeout);
    }
  }, [flashEffect, clearFlash]);

  useEffect(() => {
    if (triageMode === "vim") {
      document.body.classList.add("vim-zen-active");
    } else {
      document.body.classList.remove("vim-zen-active");
    }

    return () => document.body.classList.remove("vim-zen-active");
  }, [triageMode]);

  useEffect(() => {
    setManualFlagError(null);
  }, [currentDocIndex]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (triageMode !== "vim" || !doc) return;

      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();
        void finalizeDocument();
        return;
      }

      if (event.key === "a") {
        event.preventDefault();
        approveAllRedactions();
        return;
      }

      if (event.key === "j") navigateRedaction("next");
      if (event.key === "k") navigateRedaction("prev");
      if (event.key === "y") approveRedaction();
      if (event.key === "x") rejectRedaction();
    },
    [
      approveAllRedactions,
      approveRedaction,
      doc,
      finalizeDocument,
      navigateRedaction,
      rejectRedaction,
      triageMode,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((file) =>
        [".pdf", ".txt", ".doc", ".docx"].some((suffix) =>
          file.name.toLowerCase().endsWith(suffix)
        )
      );

      if (fileArray.length > 0) {
        void batchUpload(fileArray);
      }
    },
    [batchUpload]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) handleFiles(event.target.files);
    },
    [handleFiles]
  );

  const handleManualFlag = useCallback(() => {
    const result = addManualRedaction(manualFlagValue, manualFlagType);
    if (result.ok) {
      setManualFlagValue("");
      setManualFlagError(null);
      return;
    }
    setManualFlagError(result.message ?? "Could not add manual flag.");
  }, [addManualRedaction, manualFlagType, manualFlagValue]);

  if (uploadedQueue.length === 0 && !uploadLoading) {
    return (
      <UploadState
        dragOver={dragOver}
        userTier={userTier}
        benchmark={benchmark}
        uploadError={uploadError}
        fileInputRef={fileInputRef}
        folderInputRef={folderInputRef}
        handleDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          handleFiles(event.dataTransfer.files);
        }}
        handleInputChange={handleInputChange}
        onDragLeave={() => setDragOver(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
      />
    );
  }

  if (uploadLoading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-28 text-center">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-cyan-300 border-t-transparent" />
        <div className="text-lg font-semibold text-white">Uploading and starting the fast lane</div>
        <div className="mt-2 text-sm text-slate-400">
          Regex detections return immediately. AI enrichment and auto-export continue in the
          background.
        </div>
      </div>
    );
  }

  if (!doc && uploadedQueue.length > 0) {
    return <PipelineComplete uploadedQueue={uploadedQueue} clearQueue={clearQueue} />;
  }

  if (!doc) return null;

  const isPdf = doc.mimeType === "application/pdf";

  if (triageMode === "vim") {
    return (
      <VimWorkspace
        doc={doc}
        redactions={redactions}
        activeRedaction={activeRedaction}
        activeIndex={currentRedactionIndex}
        allReviewed={allReviewed}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isPdf={isPdf}
        onApprove={approveRedaction}
        onReject={rejectRedaction}
        onApproveAll={approveAllRedactions}
        onFinalize={() => void finalizeDocument()}
      />
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100svh-73px)] max-w-[1500px] flex-col overflow-hidden px-6 py-4">
      <div className="mb-4 overflow-hidden rounded-3xl border border-white/10 bg-[#0f172a]">
        <AdminDashboard />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={clearQueue}
                className="rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10"
              >
                Clear Queue
              </button>
              <StatusPill label="Manual review" value={`${pendingManualCount}`} tone="amber" />
              <StatusPill label="Hands-free" value={`${autopilotQueue.length}`} tone="cyan" />
              <StatusPill label="Exported" value={`${completedCount}`} tone="emerald" />
            </div>

            <div className="flex items-center gap-3">
              {isPdf && (
                <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
                  <ToggleButton active={viewMode === "text"} onClick={() => setViewMode("text")}>
                    Text
                  </ToggleButton>
                  <ToggleButton active={viewMode === "pdf"} onClick={() => setViewMode("pdf")}>
                    PDF
                  </ToggleButton>
                </div>
              )}

              <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
                <ToggleButton active onClick={() => setTriageMode("normal")}>
                  Normal
                </ToggleButton>
                <ToggleButton
                  active={false}
                  onClick={() => {
                    if (userTier === "pro") setTriageMode("vim");
                  }}
                  disabled={userTier === "free"}
                >
                  Vim Focus
                </ToggleButton>
              </div>
            </div>
          </div>
        </div>

        <BenchmarkPanel benchmark={benchmark} userTier={userTier} compact />
      </div>

      {manualQueue.length === 0 && autopilotQueue.length > 0 ? (
        <AutopilotState docs={autopilotQueue} exportedDocs={exportedQueue} />
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <QueueSidebar
          docs={uploadedQueue}
          currentDocIndex={currentDocIndex}
          metricsProcessed={metrics.processed}
          onSelect={setCurrentDocIndex}
        />

        <div className="flex min-h-0 flex-col gap-4">
          <ReviewBanner doc={doc} />
          <div className="min-h-0 flex-1">
            {viewMode === "pdf" && isPdf ? (
              <PdfViewer filePath={doc.filePath} />
            ) : (
              <DocumentTextViewer
                text={doc.text}
                redactions={redactions}
                activeIndex={currentRedactionIndex}
                filename={doc.filename}
                compact={false}
              />
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <ActionPanel
            doc={doc}
            activeRedaction={activeRedaction}
            allReviewed={allReviewed}
            triageMode={triageMode}
            onApprove={approveRedaction}
            onReject={rejectRedaction}
            onApproveAll={approveAllRedactions}
            onFinalize={() => void finalizeDocument()}
          />

          <Card className="min-h-0 flex-1 border-white/10 bg-white/[0.04] text-slate-100">
            <CardContent className="flex h-full min-h-0 flex-col p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Detected PII
                </div>
                <Badge variant="outline" className="border-white/10 text-slate-300">
                  {redactions.length}
                </Badge>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {redactions.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-5 text-center text-sm text-slate-400">
                    No PII detected in this document.
                  </div>
                ) : (
                  redactions.map((redaction, index) => (
                    <RedactionItem
                      key={`${redaction.type}-${redaction.startIndex}-${redaction.endIndex}`}
                      redaction={redaction}
                      index={index}
                      isActive={index === currentRedactionIndex}
                      flashEffect={index === currentRedactionIndex ? flashEffect : null}
                      onApprove={() => {
                        useTriageStore.setState({ currentRedactionIndex: index });
                        approveRedaction();
                      }}
                      onReject={() => {
                        useTriageStore.setState({ currentRedactionIndex: index });
                        rejectRedaction();
                      }}
                      onSelect={() => useTriageStore.setState({ currentRedactionIndex: index })}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.04] text-slate-100">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Manual Flag
                </div>
                <Badge variant="outline" className="border-white/10 text-slate-300">
                  Add custom
                </Badge>
              </div>
              <input
                value={manualFlagValue}
                onChange={(event) => setManualFlagValue(event.target.value)}
                placeholder="Type exact word or phrase"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <select
                value={manualFlagType}
                onChange={(event) => setManualFlagType(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none"
              >
                <option value="MANUAL_FLAG">Manual Flag</option>
                <option value="PERSON">Person</option>
                <option value="ADDRESS">Address</option>
                <option value="EMAIL">Email</option>
                <option value="PHONE">Phone</option>
                <option value="FINANCIAL">Financial</option>
              </select>
              <button
                onClick={handleManualFlag}
                className="w-full rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100"
              >
                Flag phrase
              </button>
              {manualFlagError ? <div className="text-xs text-amber-200">{manualFlagError}</div> : null}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.04] text-slate-100">
            <CardContent className="space-y-3 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Pipeline
              </div>
              <PipelineStep label="Text extracted" done />
              <PipelineStep label="Regex scan" done={doc.phase !== "uploaded"} />
              <PipelineStep
                label="AI queued"
                done={doc.phase !== "uploaded" && doc.phase !== "regex"}
                active={doc.phase === "ai-queued"}
              />
              <PipelineStep
                label="AI processing"
                done={doc.phase === "complete"}
                active={doc.phase === "ai-processing"}
              />
              <PipelineStep label="Export written to results" done={Boolean(doc.exportPath)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PipelineComplete({
  uploadedQueue,
  clearQueue,
}: {
  uploadedQueue: UploadedDocument[];
  clearQueue: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Card className="border-white/10 bg-white/[0.04] text-slate-100">
        <CardContent className="p-8 text-center">
          <div className="mb-3 text-3xl font-semibold text-white">All documents exported</div>
          <div className="mb-6 text-sm text-slate-400">
            Sanitized output is ready in the `results` folder for every finalized document.
          </div>
          <div className="space-y-2 text-left">
            {uploadedQueue
              .filter((doc) => doc.exportPath)
              .map((doc) => (
                <a
                  key={doc.id}
                  href={`${API_BASE}${doc.exportPath}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-slate-200"
                >
                  <span className="truncate">{doc.filename}</span>
                  <span className="text-emerald-300">{doc.exportFilename}</span>
                </a>
              ))}
          </div>
          <button
            onClick={clearQueue}
            className="mt-6 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"
          >
            Process more files
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

function UploadState({
  dragOver,
  userTier,
  benchmark,
  uploadError,
  fileInputRef,
  folderInputRef,
  handleDrop,
  handleInputChange,
  onDragLeave,
  onDragOver,
}: {
  dragOver: boolean;
  userTier: "free" | "pro";
  benchmark: ReturnType<typeof getBenchmarkData>;
  uploadError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  handleDrop: (event: React.DragEvent) => void;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDragLeave: () => void;
  onDragOver: (event: React.DragEvent) => void;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-[#101828] p-8 shadow-2xl shadow-black/20">
          <div className="mb-4 inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Fast Review Pipeline
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-white">
            Review only what the model is uncertain about.
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-300">
            High-confidence detections now stay off the manual queue, AI can keep running in the
            background, and completed documents export straight into the `results` folder with
            sensitive content hidden.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard label="Auto-pass threshold" value="90%+" tone="cyan" />
            <StatCard label="Results export" value="Instant" tone="emerald" />
            <StatCard label="Review surface" value="Only low confidence" tone="amber" />
          </div>
        </div>

        <BenchmarkPanel benchmark={benchmark} userTier={userTier} />
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={handleDrop}
        className={`rounded-3xl border p-10 transition ${
          dragOver ? "border-cyan-300 bg-cyan-400/10" : "border-white/10 bg-white/[0.04]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.doc,.docx"
          onChange={handleInputChange}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error directory upload
          webkitdirectory="true"
          directory="true"
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-2 text-sm font-semibold text-white">Upload files or a folder</div>
            <div className="text-sm leading-7 text-slate-400">
              Supports PDF, TXT, DOC, DOCX. Regex runs first, AI continues asynchronously, and
              only low-confidence detections wait for review.
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-white/10 bg-white/8 px-5 py-3 text-sm font-medium text-white hover:bg-white/12"
            >
              Select Files
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="rounded-xl border border-cyan-400/30 bg-cyan-400/12 px-5 py-3 text-sm font-medium text-cyan-100 hover:bg-cyan-400/18"
            >
              Select Folder
            </button>
          </div>
        </div>
      </div>

      {uploadError ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {uploadError}
        </div>
      ) : null}
    </div>
  );
}

function QueueSidebar({
  docs,
  currentDocIndex,
  metricsProcessed,
  onSelect,
}: {
  docs: UploadedDocument[];
  currentDocIndex: number;
  metricsProcessed: number;
  onSelect: (index: number) => void;
}) {
  const progress = docs.length > 0 ? (metricsProcessed / docs.length) * 100 : 0;

  return (
    <Card className="min-h-0 border-white/10 bg-white/[0.04] text-slate-100">
      <CardContent className="flex h-full min-h-0 flex-col p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          Queue
        </div>
        <Progress value={progress} className="mb-4 h-2" />
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {docs.map((doc, index) => (
            <button
              key={doc.id}
              onClick={() => onSelect(index)}
              className={`w-full rounded-2xl border px-3 py-3 text-left ${
                index === currentDocIndex
                  ? "border-cyan-300/50 bg-cyan-300/10"
                  : "border-white/8 bg-black/10 hover:border-white/16"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="truncate text-sm font-medium text-white">{doc.filename}</div>
                <QueueStateDot doc={doc} />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{doc.pendingReviewCount > 0 ? `${doc.pendingReviewCount} to review` : "Hands-free"}</span>
                <PhaseIndicator phase={doc.phase} compact />
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AutopilotState({
  docs,
  exportedDocs,
}: {
  docs: UploadedDocument[];
  exportedDocs: UploadedDocument[];
}) {
  return (
    <Card className="mb-6 border-cyan-300/20 bg-cyan-400/8 text-slate-100">
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-2 text-sm font-semibold text-cyan-100">Manual queue is clear</div>
          <div className="text-sm leading-7 text-slate-300">
            The remaining documents are moving through AI enrichment and will export automatically
            when complete. Nothing else is blocked on your side.
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <MiniMetric label="Auto-exporting" value={`${docs.length}`} />
          <MiniMetric label="Already exported" value={`${exportedDocs.length}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewBanner({ doc }: { doc: UploadedDocument }) {
  if (doc.finalizedAt) {
    return (
      <Card className="border-emerald-300/20 bg-emerald-400/8 text-emerald-100">
        <CardContent className="p-4 text-sm">
          This document has already been finalized and exported.
        </CardContent>
      </Card>
    );
  }

  if (!doc.requiresReview) {
    return (
      <Card className="border-cyan-300/20 bg-cyan-400/8 text-cyan-100">
        <CardContent className="p-4 text-sm">
          High-confidence detections are already approved. This file will auto-export once AI
          finishes enriching it.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-300/20 bg-amber-400/8 text-amber-100">
      <CardContent className="p-4 text-sm">
        Only low-confidence detections remain in this manual queue. Finalize once the pending
        items are resolved.
      </CardContent>
    </Card>
  );
}

function DocumentTextViewer({
  text,
  redactions,
  activeIndex,
  filename,
  compact,
}: {
  text: string;
  redactions: Redaction[];
  activeIndex: number;
  filename: string;
  compact: boolean;
}) {
  const sorted = [...redactions]
    .map((redaction, index) => ({ ...redaction, originalIndex: index }))
    .sort((a, b) => a.startIndex - b.startIndex);

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  for (const redaction of sorted) {
    if (redaction.startIndex > lastEnd) {
      parts.push(
        <span key={`text-${lastEnd}`} className="text-slate-200">
          {text.slice(lastEnd, redaction.startIndex)}
        </span>
      );
    }

    const isActive = redaction.originalIndex === activeIndex;
    const statusClasses =
      redaction.status === "approved"
        ? "border-emerald-300/40 bg-emerald-400/16 text-emerald-100"
        : redaction.status === "rejected"
          ? "border-red-300/40 bg-red-400/14 text-red-100 line-through"
          : "border-amber-300/40 bg-amber-400/18 text-amber-50";

    parts.push(
      <span
        key={`pii-${redaction.startIndex}`}
        className={`inline rounded-lg border px-1.5 py-0.5 ${statusClasses} ${
          isActive ? "ring-2 ring-cyan-300 ring-offset-2 ring-offset-[#0f172a]" : ""
        }`}
      >
        {redaction.value}
        <sup className="ml-1 text-[10px] opacity-70">{redaction.confidence}%</sup>
      </span>
    );

    lastEnd = redaction.endIndex;
  }

  if (lastEnd < text.length) {
    parts.push(
      <span key={`text-${lastEnd}`} className="text-slate-200">
        {text.slice(lastEnd)}
      </span>
    );
  }

  return (
    <Card className="h-full border-white/10 bg-white/[0.04] text-slate-100">
      <CardContent className="p-0">
        <div className="border-b border-white/8 px-5 py-4 text-sm font-semibold text-white">
          {filename}
        </div>
        <div className="h-[calc(100%-57px)] overflow-y-auto p-5">
          <div
            className={`rounded-2xl border border-white/8 bg-[#0b1120] font-mono whitespace-pre-wrap ${
              compact ? "p-8 text-[15px] leading-8" : "p-6 text-[13px] leading-7"
            }`}
          >
            {parts}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PdfViewer({ filePath }: { filePath: string }) {
  return (
    <Card className="h-full overflow-hidden border-white/10 bg-white/[0.04]">
      <CardContent className="p-0">
        <iframe src={`${API_BASE}${filePath}`} title="PDF viewer" className="h-full min-h-[70vh] w-full border-0 bg-white" />
      </CardContent>
    </Card>
  );
}

function RedactionItem({
  redaction,
  isActive,
  index,
  flashEffect,
  onApprove,
  onReject,
  onSelect,
}: {
  redaction: Redaction;
  isActive: boolean;
  index: number;
  flashEffect: string | null;
  onApprove: () => void;
  onReject: () => void;
  onSelect: () => void;
}) {
  const statusTone =
    redaction.status === "approved"
      ? "text-emerald-200"
      : redaction.status === "rejected"
        ? "text-red-200"
        : "text-amber-100";

  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl border px-3 py-3 ${
        isActive ? "border-cyan-300/40 bg-cyan-300/8" : "border-white/8 bg-black/10"
      } ${
        flashEffect === "approve" ? "border-emerald-300/40" : flashEffect === "reject" ? "border-red-300/40" : ""
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] text-slate-500">{index + 1}</span>
            <Badge variant="outline" className="border-white/10 text-[10px] text-slate-300">
              {redaction.type}
            </Badge>
          </div>
          <div className={`truncate font-mono text-xs ${statusTone}`}>{redaction.value}</div>
        </div>
        <div className="text-xs text-slate-400">{redaction.confidence}%</div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500 capitalize">{redaction.status}</span>
        {redaction.status === "pending" ? (
          <div className="flex gap-2">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onApprove();
              }}
              className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-200"
            >
              Approve
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onReject();
              }}
              className="rounded-lg border border-red-300/30 bg-red-400/10 px-2 py-1 text-[11px] text-red-200"
            >
              Reject
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PhaseIndicator({ phase, compact = false }: { phase: string; compact?: boolean }) {
  const config: Record<string, { label: string; dot: string }> = {
    uploaded: { label: "Uploaded", dot: "bg-slate-400" },
    regex: { label: "Regex", dot: "bg-amber-300" },
    "ai-queued": { label: "AI queued", dot: "bg-sky-300" },
    "ai-processing": { label: "AI running", dot: "bg-violet-300" },
    complete: { label: "Complete", dot: "bg-emerald-300" },
    error: { label: "Error", dot: "bg-red-300" },
  };
  const item = config[phase] ?? config.uploaded;

  return (
    <div className={`inline-flex items-center gap-2 ${compact ? "text-[11px]" : "text-xs"}`}>
      <span className={`h-2 w-2 rounded-full ${item.dot}`} />
      <span className="text-slate-300">{item.label}</span>
    </div>
  );
}

function PipelineStep({ label, done, active = false }: { label: string; done: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
          done
            ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
            : active
              ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-200"
              : "border-white/10 bg-black/10 text-slate-500"
        }`}
      >
        {done ? "✓" : active ? "…" : "○"}
      </span>
      <span className={done ? "text-slate-200" : active ? "text-cyan-100" : "text-slate-500"}>
        {label}
      </span>
    </div>
  );
}

function ActionPanel({
  doc,
  activeRedaction,
  allReviewed,
  triageMode,
  onApprove,
  onReject,
  onApproveAll,
  onFinalize,
}: {
  doc: UploadedDocument;
  activeRedaction?: Redaction;
  allReviewed: boolean;
  triageMode: "normal" | "vim";
  onApprove: () => void;
  onReject: () => void;
  onApproveAll: () => void;
  onFinalize: () => void;
}) {
  return (
    <Card className="border-white/10 bg-white/[0.04] text-slate-100">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">{doc.filename}</div>
            <div className="mt-1 text-xs text-slate-400">
              {doc.pendingReviewCount > 0
                ? `${doc.pendingReviewCount} items still need a decision`
                : "Ready to export to results"}
            </div>
          </div>
          <PhaseIndicator phase={doc.phase} />
        </div>

        {triageMode === "normal" && activeRedaction ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onApprove}
              className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/16"
            >
              Approve
            </button>
            <button
              onClick={onReject}
              className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-400/16"
            >
              Reject
            </button>
          </div>
        ) : null}

        <button
          onClick={onApproveAll}
          className="w-full rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100"
        >
          Approve all pending in this document
        </button>

        <button
          disabled={!allReviewed}
          onClick={onFinalize}
          className={`w-full rounded-xl px-4 py-3 text-sm font-semibold ${
            allReviewed
              ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
              : "cursor-not-allowed border border-white/10 bg-white/6 text-slate-500"
          }`}
        >
          {allReviewed ? "Finalize and export" : `Review remaining (${doc.pendingReviewCount})`}
        </button>

        {doc.exportPath ? (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/8 px-3 py-3 text-xs text-emerald-100">
            Exported to{" "}
            <a href={`${API_BASE}${doc.exportPath}`} target="_blank" rel="noreferrer" className="font-semibold underline">
              results/{doc.exportFilename}
            </a>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function VimWorkspace({
  doc,
  redactions,
  activeRedaction,
  activeIndex,
  allReviewed,
  viewMode,
  setViewMode,
  isPdf,
  onApprove,
  onReject,
  onApproveAll,
  onFinalize,
}: {
  doc: UploadedDocument;
  redactions: Redaction[];
  activeRedaction?: Redaction;
  activeIndex: number;
  allReviewed: boolean;
  viewMode: "pdf" | "text";
  setViewMode: (mode: "pdf" | "text") => void;
  isPdf: boolean;
  onApprove: () => void;
  onReject: () => void;
  onApproveAll: () => void;
  onFinalize: () => void;
}) {
  return (
    <div className="mx-auto flex h-[calc(100svh-24px)] max-w-[1400px] flex-col overflow-hidden px-4 py-3">
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-cyan-300/20 bg-[#08111d] px-4 py-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.26em] text-cyan-200/80">Vim Focus</div>
          <div className="mt-1 text-sm text-slate-300">
            J/K move, Y approve, X reject, A approve all, Shift+Enter finalize.
          </div>
        </div>
        {isPdf ? (
          <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
            <ToggleButton active={viewMode === "text"} onClick={() => setViewMode("text")}>
              Text
            </ToggleButton>
            <ToggleButton active={viewMode === "pdf"} onClick={() => setViewMode("pdf")}>
              PDF
            </ToggleButton>
          </div>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="min-h-0 border-white/10 bg-white/[0.04] text-slate-100">
          <CardContent className="flex h-full min-h-0 flex-col p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Focus Guide
            </div>
            <div className="grid gap-2 text-sm text-slate-300">
              <GuideRow keyLabel="J / K" text="Move through redactions" />
              <GuideRow keyLabel="Y" text="Approve active item" />
              <GuideRow keyLabel="X" text="Reject active item" />
              <GuideRow keyLabel="A" text="Approve all pending items" />
              <GuideRow keyLabel="Shift+Enter" text="Finalize and export" />
            </div>
            <div className="my-4 h-px bg-white/10" />
            <div className="rounded-2xl border border-white/10 bg-black/12 p-4 text-sm">
              <div className="mb-1 font-semibold text-white">{doc.filename}</div>
              <div className="text-slate-400">{doc.pendingReviewCount} items pending</div>
            </div>
            <div className="mt-4 grid gap-2">
              <button onClick={onApprove} className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
                Approve
              </button>
              <button onClick={onReject} className="rounded-xl border border-red-300/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-100">
                Reject
              </button>
              <button onClick={onApproveAll} className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100">
                Approve All
              </button>
              <button
                disabled={!allReviewed}
                onClick={onFinalize}
                className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                  allReviewed
                    ? "bg-cyan-300 text-slate-950"
                    : "cursor-not-allowed border border-white/10 bg-white/6 text-slate-500"
                }`}
              >
                Finalize
              </button>
            </div>
            {activeRedaction ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/12 p-4 text-sm">
                <div className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                  Active Redaction [{activeIndex + 1}/{redactions.length}]
                </div>
                <div className="font-semibold text-white">{activeRedaction.value}</div>
                <div className="mt-1 text-slate-400">
                  {activeRedaction.type} • {activeRedaction.confidence}% • {activeRedaction.status}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="min-h-0">
          {viewMode === "pdf" && isPdf ? (
            <PdfViewer filePath={doc.filePath} />
          ) : (
            <DocumentTextViewer
              text={doc.text}
              redactions={redactions}
              activeIndex={activeIndex}
              filename={doc.filename}
              compact
            />
          )}
        </div>
      </div>
    </div>
  );
}

function GuideRow({ keyLabel, text }: { keyLabel: string; text: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/10 px-3 py-2">
      <span className="font-semibold text-white">{keyLabel}</span>
      <span className="text-slate-400">{text}</span>
    </div>
  );
}

function ToggleButton({
  active,
  disabled = false,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
        active
          ? "bg-white text-slate-950"
          : disabled
            ? "cursor-not-allowed text-slate-600"
            : "text-slate-300 hover:bg-white/8"
      }`}
    >
      {children}
    </button>
  );
}

function BenchmarkPanel({
  benchmark,
  userTier,
  compact = false,
}: {
  benchmark: ReturnType<typeof getBenchmarkData>;
  userTier: "free" | "pro";
  compact?: boolean;
}) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-[#07111f] ${compact ? "p-4" : "p-6"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
            Speed Benchmark
          </div>
          <div className="mt-1 text-lg font-semibold text-white">
            Pro clears the queue faster than the default lane.
          </div>
        </div>
        <Badge variant="outline" className="border-cyan-300/20 text-cyan-100">
          {userTier === "pro" ? "Pro active" : "Free lane"}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <BenchmarkCard title="Free user" value={benchmark.free} sublabel="manual checks stay in queue" />
        <BenchmarkCard title="Pro user" value={benchmark.pro} sublabel="priority AI + vim mode + auto-pass" highlight />
      </div>

      <div className="mt-3 text-xs leading-6 text-slate-400">
        Current delta: <span className="font-semibold text-cyan-100">{benchmark.delta}</span>
      </div>
    </div>
  );
}

function BenchmarkCard({
  title,
  value,
  sublabel,
  highlight = false,
}: {
  title: string;
  value: string;
  sublabel: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-cyan-300/30 bg-cyan-400/10" : "border-white/10 bg-black/12"}`}>
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{sublabel}</div>
    </div>
  );
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: "amber" | "cyan" | "emerald" }) {
  const styles = {
    amber: "border-amber-300/25 bg-amber-400/10 text-amber-100",
    cyan: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100",
    emerald: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  };

  return (
    <div className={`rounded-full border px-3 py-1.5 text-xs ${styles[tone]}`}>
      <span className="mr-2 text-slate-300">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: "cyan" | "emerald" | "amber" }) {
  const tones = {
    cyan: "text-cyan-100 border-cyan-300/20 bg-cyan-400/8",
    emerald: "text-emerald-100 border-emerald-300/20 bg-emerald-400/8",
    amber: "text-amber-100 border-amber-300/20 bg-amber-400/8",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function QueueStateDot({ doc }: { doc: UploadedDocument }) {
  if (doc.finalizedAt) return <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />;
  if (doc.requiresReview) return <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />;
  return <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />;
}

function getBenchmarkData(userTier: "free" | "pro", pendingManualCount: number) {
  const baseline = Math.max(18, pendingManualCount * 6 + 18);
  const pro = Math.max(6, Math.round(baseline * 0.42));
  const free = baseline;
  const active = userTier === "pro" ? pro : free;
  const other = userTier === "pro" ? free : pro;
  const deltaSeconds = Math.max(0, other - active);

  return {
    free: `${free}s avg/doc`,
    pro: `${pro}s avg/doc`,
    delta: `${deltaSeconds}s saved per document`,
  };
}
