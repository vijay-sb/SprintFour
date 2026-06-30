import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTriageStore } from "@/store/useTriageStore";
import type { Redaction, UploadedDocument } from "@/store/useTriageStore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AdminDashboard } from "@/components/AdminDashboard";
import { BatchTriage } from "@/components/BatchTriage";
import { SystemBenchmark } from "@/components/SystemBenchmark";

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

      if (event.key === "Escape" || event.key === "q") {
        event.preventDefault();
        setTriageMode("normal");
        return;
      }

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
      setTriageMode,
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
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-neutral-200 border-t-transparent" />
        <div className="text-lg font-semibold text-neutral-900">Uploading and starting the fast lane</div>
        <div className="mt-2 text-sm text-neutral-500">
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
        onExit={() => setTriageMode("normal")}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100svh-57px)] max-w-[1600px] flex-col gap-3 px-4 py-4 sm:px-5 xl:h-[calc(100svh-57px)]">
      <AdminDashboard />

      <WorkspaceToolbar
        triageMode={triageMode}
        setTriageMode={setTriageMode}
        userTier={userTier}
        isPdf={isPdf && triageMode === "normal"}
        viewMode={viewMode}
        setViewMode={setViewMode}
        pendingManualCount={pendingManualCount}
        autopilotCount={autopilotQueue.length}
        completedCount={completedCount}
        onClear={clearQueue}
      />

      <main className="min-h-0 flex-1">
        {triageMode === "batch" ? (
          <BatchTriage />
        ) : (
          <div className="grid gap-3 xl:h-full xl:min-h-0 xl:grid-rows-[minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_340px]">
            <div className="max-h-[40vh] xl:max-h-none xl:min-h-0">
              <QueueSidebar
                docs={uploadedQueue}
                currentDocIndex={currentDocIndex}
                metricsProcessed={metrics.processed}
                onSelect={setCurrentDocIndex}
              />
            </div>

            <div className="flex min-h-0 flex-col gap-3">
              <ReviewBanner doc={doc} />
              <div className="min-h-[60vh] flex-1 xl:min-h-0">
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

            <div className="flex flex-col gap-3 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
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

              <Card className="border-neutral-200 bg-white text-neutral-900">
                <CardContent className="flex flex-col p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                      Detected PII
                    </div>
                    <Badge variant="outline" className="border-neutral-200 text-neutral-600">
                      {redactions.length}
                    </Badge>
                  </div>

                  <div className="max-h-[42vh] space-y-2 overflow-y-auto">
                    {redactions.length === 0 ? (
                      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-5 text-center text-sm text-neutral-500">
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

              <Card className="border-neutral-200 bg-white text-neutral-900">
                <CardContent className="space-y-3 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    Manual Flag
                  </div>
                  <input
                    value={manualFlagValue}
                    onChange={(event) => setManualFlagValue(event.target.value)}
                    placeholder="Type exact word or phrase"
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-200 placeholder:text-neutral-400"
                  />
                  <select
                    value={manualFlagType}
                    onChange={(event) => setManualFlagType(event.target.value)}
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-200"
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
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
                  >
                    Flag phrase
                  </button>
                  {manualFlagError ? (
                    <div className="text-xs text-amber-700">{manualFlagError}</div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-neutral-200 bg-white text-neutral-900">
                <CardContent className="space-y-2.5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
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
                  <PipelineStep label="Exported to results" done={Boolean(doc.exportPath)} />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function WorkspaceToolbar({
  triageMode,
  setTriageMode,
  userTier,
  isPdf,
  viewMode,
  setViewMode,
  pendingManualCount,
  autopilotCount,
  completedCount,
  onClear,
}: {
  triageMode: "normal" | "batch" | "vim";
  setTriageMode: (mode: "normal" | "batch" | "vim") => void;
  userTier: "free" | "pro";
  isPdf: boolean;
  viewMode: "pdf" | "text";
  setViewMode: (mode: "pdf" | "text") => void;
  pendingManualCount: number;
  autopilotCount: number;
  completedCount: number;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          <ToggleButton active={triageMode === "batch"} onClick={() => setTriageMode("batch")}>
            Batch
          </ToggleButton>
          <ToggleButton active={triageMode === "normal"} onClick={() => setTriageMode("normal")}>
            Document
          </ToggleButton>
          <ToggleButton
            active={triageMode === "vim"}
            onClick={() => {
              if (userTier === "pro") setTriageMode("vim");
            }}
            disabled={userTier === "free"}
          >
            Vim {userTier === "free" ? "· Pro" : ""}
          </ToggleButton>
        </div>

        {isPdf && (
          <div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
            <ToggleButton active={viewMode === "text"} onClick={() => setViewMode("text")}>
              Text
            </ToggleButton>
            <ToggleButton active={viewMode === "pdf"} onClick={() => setViewMode("pdf")}>
              PDF
            </ToggleButton>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label="Needs review" value={`${pendingManualCount}`} tone="amber" />
        <StatusPill label="Hands-free" value={`${autopilotCount}`} tone="cyan" />
        <StatusPill label="Exported" value={`${completedCount}`} tone="emerald" />
        <button
          onClick={onClear}
          className="rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100"
        >
          Clear queue
        </button>
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
      <Card className="border-neutral-200 bg-white text-neutral-900">
        <CardContent className="p-8 text-center">
          <div className="mb-3 text-3xl font-semibold text-neutral-900">All documents exported</div>
          <div className="mb-6 text-sm text-neutral-500">
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
                  className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
                >
                  <span className="truncate">{doc.filename}</span>
                  <span className="text-emerald-700">{doc.exportFilename}</span>
                </a>
              ))}
          </div>
          <button
            onClick={clearQueue}
            className="mt-6 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
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
        <div className="rounded-2xl border border-neutral-200 bg-white p-8">
          <div className="mb-4 inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-700">
            Built for 200 files before lunch
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-neutral-900">
            Review decisions, not documents.
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-neutral-600">
            Drop your whole caseload. We group every detection across the batch by type and by
            repeated value — so one click redacts a client's name in all 47 files it appears in.
            The high-confidence majority auto-clears; you only touch the ambiguous tail, then export
            everything at once.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard label="Work unit" value="The whole batch" tone="cyan" />
            <StatCard label="Auto-pass" value="90%+ confidence" tone="emerald" />
            <StatCard label="You review" value="Only the edge cases" tone="amber" />
          </div>
        </div>

        <BenchmarkPanel benchmark={benchmark} userTier={userTier} />
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={handleDrop}
        className={`rounded-2xl border p-10 transition ${
          dragOver ? "border-neutral-200 bg-neutral-100" : "border-neutral-200 bg-white"
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
            <div className="mb-2 text-sm font-semibold text-neutral-900">Upload files or a folder</div>
            <div className="text-sm leading-7 text-neutral-500">
              Supports PDF, TXT, DOC, DOCX. Regex runs first, AI continues asynchronously, and
              only low-confidence detections wait for review.
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-neutral-200 bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
            >
              Select Files
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="rounded-xl border border-neutral-200 bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Select Folder
            </button>
          </div>
        </div>
      </div>

      {uploadError ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {uploadError}
        </div>
      ) : null}

      <div className="mt-8">
        <SystemBenchmark />
      </div>
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
    <Card className="flex h-full min-h-0 flex-col border-neutral-200 bg-white py-0 text-neutral-900">
      <CardContent className="flex h-full min-h-0 flex-col p-4">
        <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          <span>Queue</span>
          <span className="text-neutral-400">{docs.length}</span>
        </div>
        <Progress value={progress} className="mb-4 h-1.5" />
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {docs.map((doc, index) => (
            <button
              key={doc.id}
              onClick={() => onSelect(index)}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                index === currentDocIndex
                  ? "border-neutral-200 bg-neutral-100"
                  : "border-neutral-200 bg-neutral-50 hover:border-neutral-200"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="truncate text-sm font-medium text-neutral-900">{doc.filename}</div>
                <QueueStateDot doc={doc} />
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-500">
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

function ReviewBanner({ doc }: { doc: UploadedDocument }) {
  if (doc.finalizedAt) {
    return (
      <Card className="border-emerald-200 bg-emerald-50 text-emerald-700">
        <CardContent className="p-4 text-sm">
          This document has already been finalized and exported.
        </CardContent>
      </Card>
    );
  }

  if (!doc.requiresReview) {
    return (
      <Card className="border-neutral-200 bg-neutral-100 text-neutral-700">
        <CardContent className="p-4 text-sm">
          High-confidence detections are already approved. This file will auto-export once AI
          finishes enriching it.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50 text-amber-700">
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
        <span key={`text-${lastEnd}`} className="text-neutral-700">
          {text.slice(lastEnd, redaction.startIndex)}
        </span>
      );
    }

    const isActive = redaction.originalIndex === activeIndex;
    const statusClasses =
      redaction.status === "approved"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : redaction.status === "rejected"
          ? "border-red-200 bg-red-50 text-red-600 line-through"
          : "border-amber-200 bg-amber-50 text-amber-700";

    parts.push(
      <span
        key={`pii-${redaction.startIndex}`}
        className={`inline rounded-lg border px-1.5 py-0.5 ${statusClasses} ${
          isActive ? "ring-2 ring-neutral-900 ring-offset-2 ring-offset-white" : ""
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
      <span key={`text-${lastEnd}`} className="text-neutral-700">
        {text.slice(lastEnd)}
      </span>
    );
  }

  return (
    <Card className="flex h-full min-h-0 flex-col border-neutral-200 bg-white py-0 text-neutral-900">
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="shrink-0 border-b border-neutral-200 px-5 py-3.5 text-sm font-semibold text-neutral-900">
          {filename}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div
            className={`rounded-lg border border-neutral-200 bg-neutral-50 font-mono whitespace-pre-wrap ${
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
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-neutral-200 bg-white py-0">
      <CardContent className="min-h-0 flex-1 p-0">
        <iframe
          src={`${API_BASE}${filePath}`}
          title="PDF viewer"
          className="h-full w-full border-0 bg-white"
        />
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
      ? "text-emerald-700"
      : redaction.status === "rejected"
        ? "text-red-600"
        : "text-amber-700";

  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl border px-3 py-3 ${
        isActive ? "border-neutral-200 bg-neutral-100" : "border-neutral-200 bg-neutral-50"
      } ${
        flashEffect === "approve" ? "border-emerald-200" : flashEffect === "reject" ? "border-red-200" : ""
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] text-neutral-400">{index + 1}</span>
            <Badge variant="outline" className="border-neutral-200 text-[10px] text-neutral-600">
              {redaction.type}
            </Badge>
          </div>
          <div className={`truncate font-mono text-xs ${statusTone}`}>{redaction.value}</div>
        </div>
        <div className="text-xs text-neutral-500">{redaction.confidence}%</div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-neutral-400 capitalize">{redaction.status}</span>
        {redaction.status === "pending" ? (
          <div className="flex gap-2">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onApprove();
              }}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700"
            >
              Approve
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onReject();
              }}
              className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-600"
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
    uploaded: { label: "Uploaded", dot: "bg-neutral-300" },
    regex: { label: "Regex", dot: "bg-amber-500" },
    "ai-queued": { label: "AI queued", dot: "bg-neutral-400" },
    "ai-processing": { label: "AI running", dot: "bg-neutral-600" },
    complete: { label: "Complete", dot: "bg-emerald-500" },
    error: { label: "Error", dot: "bg-red-500" },
  };
  const item = config[phase] ?? config.uploaded;

  return (
    <div className={`inline-flex items-center gap-2 ${compact ? "text-[11px]" : "text-xs"}`}>
      <span className={`h-2 w-2 rounded-full ${item.dot}`} />
      <span className="text-neutral-600">{item.label}</span>
    </div>
  );
}

function PipelineStep({ label, done, active = false }: { label: string; done: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
          done
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : active
              ? "border-neutral-200 bg-neutral-100 text-neutral-700"
              : "border-neutral-200 bg-neutral-50 text-neutral-400"
        }`}
      >
        {done ? "✓" : active ? "…" : "○"}
      </span>
      <span className={done ? "text-neutral-700" : active ? "text-neutral-700" : "text-neutral-400"}>
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
  triageMode: "normal" | "batch" | "vim";
  onApprove: () => void;
  onReject: () => void;
  onApproveAll: () => void;
  onFinalize: () => void;
}) {
  return (
    <Card className="border-neutral-200 bg-white text-neutral-900">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-900">{doc.filename}</div>
            <div className="mt-1 text-xs text-neutral-500">
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
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Approve
            </button>
            <button
              onClick={onReject}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100"
            >
              Reject
            </button>
          </div>
        ) : null}

        <button
          onClick={onApproveAll}
          className="w-full rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-700"
        >
          Approve all pending in this document
        </button>

        <button
          disabled={!allReviewed}
          onClick={onFinalize}
          className={`w-full rounded-xl px-4 py-3 text-sm font-semibold ${
            allReviewed
              ? "bg-neutral-900 text-white hover:bg-neutral-800"
              : "cursor-not-allowed border border-neutral-200 bg-neutral-100 text-neutral-400"
          }`}
        >
          {allReviewed ? "Finalize and export" : `Review remaining (${doc.pendingReviewCount})`}
        </button>

        {doc.exportPath ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-700">
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
  onExit,
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
  onExit: () => void;
}) {
  return (
    <div className="mx-auto flex h-[calc(100svh-24px)] max-w-[1400px] flex-col overflow-hidden px-4 py-3">
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.26em] text-neutral-700">Vim Focus</div>
          <div className="mt-1 text-sm text-neutral-600">
            J/K move, Y approve, X reject, A approve all, Shift+Enter finalize, Esc to exit.
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPdf ? (
            <div className="flex rounded-xl border border-neutral-200 bg-neutral-50 p-1">
              <ToggleButton active={viewMode === "text"} onClick={() => setViewMode("text")}>
                Text
              </ToggleButton>
              <ToggleButton active={viewMode === "pdf"} onClick={() => setViewMode("pdf")}>
                PDF
              </ToggleButton>
            </div>
          ) : null}
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            <span className="kbd-key">Esc</span> Exit Vim
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="min-h-0 border-neutral-200 bg-white text-neutral-900">
          <CardContent className="flex h-full min-h-0 flex-col p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
              Focus Guide
            </div>
            <div className="grid gap-2 text-sm text-neutral-600">
              <GuideRow keyLabel="J / K" text="Move through redactions" />
              <GuideRow keyLabel="Y" text="Approve active item" />
              <GuideRow keyLabel="X" text="Reject active item" />
              <GuideRow keyLabel="A" text="Approve all pending items" />
              <GuideRow keyLabel="Shift+Enter" text="Finalize and export" />
            </div>
            <div className="my-4 h-px bg-neutral-200" />
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
              <div className="mb-1 font-semibold text-neutral-900">{doc.filename}</div>
              <div className="text-neutral-500">{doc.pendingReviewCount} items pending</div>
            </div>
            <div className="mt-4 grid gap-2">
              <button onClick={onApprove} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                Approve
              </button>
              <button onClick={onReject} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                Reject
              </button>
              <button onClick={onApproveAll} className="rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-700">
                Approve All
              </button>
              <button
                disabled={!allReviewed}
                onClick={onFinalize}
                className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                  allReviewed
                    ? "bg-neutral-900 text-white"
                    : "cursor-not-allowed border border-neutral-200 bg-neutral-100 text-neutral-400"
                }`}
              >
                Finalize
              </button>
            </div>
            {activeRedaction ? (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                <div className="mb-2 text-xs uppercase tracking-[0.22em] text-neutral-400">
                  Active Redaction [{activeIndex + 1}/{redactions.length}]
                </div>
                <div className="font-semibold text-neutral-900">{activeRedaction.value}</div>
                <div className="mt-1 text-neutral-500">
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
    <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
      <span className="font-semibold text-neutral-900">{keyLabel}</span>
      <span className="text-neutral-500">{text}</span>
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
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-neutral-900 text-white"
          : disabled
            ? "cursor-not-allowed text-neutral-300"
            : "text-neutral-600 hover:bg-neutral-100"
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
    <div className={`rounded-3xl border border-neutral-200 bg-neutral-50 ${compact ? "p-4" : "p-6"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-700">
            Speed Benchmark
          </div>
          <div className="mt-1 text-lg font-semibold text-neutral-900">
            Pro clears the queue faster than the default lane.
          </div>
        </div>
        <Badge variant="outline" className="border-neutral-200 text-neutral-700">
          {userTier === "pro" ? "Pro active" : "Free lane"}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <BenchmarkCard title="Free user" value={benchmark.free} sublabel="manual checks stay in queue" />
        <BenchmarkCard title="Pro user" value={benchmark.pro} sublabel="priority AI + vim mode + auto-pass" highlight />
      </div>

      <div className="mt-3 text-xs leading-6 text-neutral-500">
        Current delta: <span className="font-semibold text-neutral-700">{benchmark.delta}</span>
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
    <div className={`rounded-2xl border p-4 ${highlight ? "border-neutral-200 bg-neutral-100" : "border-neutral-200 bg-neutral-50"}`}>
      <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-neutral-900">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{sublabel}</div>
    </div>
  );
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: "amber" | "cyan" | "emerald" }) {
  const styles = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    cyan: "border-neutral-200 bg-neutral-100 text-neutral-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <div className={`rounded-full border px-3 py-1.5 text-xs ${styles[tone]}`}>
      <span className="mr-2 text-neutral-600">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: "cyan" | "emerald" | "amber" }) {
  const tones = {
    cyan: "text-neutral-700 border-neutral-200 bg-neutral-100",
    emerald: "text-emerald-700 border-emerald-200 bg-emerald-50",
    amber: "text-amber-700 border-amber-200 bg-amber-50",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-600">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}

function QueueStateDot({ doc }: { doc: UploadedDocument }) {
  if (doc.finalizedAt) return <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />;
  if (doc.requiresReview) return <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />;
  return <span className="h-2.5 w-2.5 rounded-full bg-neutral-400" />;
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
