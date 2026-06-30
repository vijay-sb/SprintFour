import { useEffect, useCallback, useRef, useState } from "react";
import { useTriageStore } from "@/store/useTriageStore";
import type { Redaction } from "@/store/useTriageStore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function TriageWorkspace() {
  const {
    uploadedQueue,
    currentDocIndex,
    currentRedactionIndex,
    flashEffect,
    approveRedaction,
    rejectRedaction,
    navigateRedaction,
    finalizeDocument,
    clearFlash,
  } = useTriageStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [showFinalize, setShowFinalize] = useState(false);

  const currentDoc = uploadedQueue[currentDocIndex];

  // Clear flash effect after animation
  useEffect(() => {
    if (flashEffect) {
      const t = setTimeout(clearFlash, 300);
      return () => clearTimeout(t);
    }
  }, [flashEffect, clearFlash]);

  // Vim-mode keyboard bindings
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!currentDoc) return;

      // Shift+Enter -> Finalize
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        finalizeDocument();
        return;
      }

      switch (e.key) {
        case "j":
          navigateRedaction("next");
          break;
        case "k":
          navigateRedaction("prev");
          break;
        case "y":
          approveRedaction();
          break;
        case "x":
          rejectRedaction();
          break;
      }
    },
    [currentDoc, navigateRedaction, approveRedaction, rejectRedaction, finalizeDocument]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Show finalize hint when all redactions are reviewed
  useEffect(() => {
    if (!currentDoc) {
      setShowFinalize(false);
      return;
    }
    const allReviewed = currentDoc.redactions.every(
      (r: Redaction) => r.status !== "pending"
    );
    setShowFinalize(allReviewed);
  }, [currentDoc]);

  if (!currentDoc) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <div className="text-6xl">✅</div>
          <h2 className="text-2xl font-bold text-emerald-400">Queue Clear</h2>
          <p className="text-slate-400">All documents have been processed.</p>
        </div>
      </div>
    );
  }

  const redactions = currentDoc.redactions;
  const activeRedaction = redactions[currentRedactionIndex];

  return (
    <div
      ref={containerRef}
      className={`space-y-6 transition-all duration-200 ${
        flashEffect === "finalize"
          ? "opacity-0 translate-x-10"
          : "opacity-100 translate-x-0"
      }`}
    >
      {/* Document Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono px-2 py-1 rounded bg-slate-800 text-cyan-400 border border-cyan-400/30">
            {currentDoc.id}
          </span>
          <Badge variant="outline" className="border-violet-500/50 text-violet-400 text-xs">
            Tier: {currentDoc.userTier}
          </Badge>
          <span className="text-xs text-slate-500">
            {currentDocIndex + 1} of {uploadedQueue.length} remaining
          </span>
        </div>
        <div
          className={`text-xs font-mono px-3 py-1 rounded transition-all duration-300 ${
            showFinalize
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 animate-pulse"
              : "bg-slate-800 text-slate-500 border border-slate-700"
          }`}
        >
          {showFinalize ? "⇧ SHIFT+ENTER to finalize" : "Review all redactions"}
        </div>
      </div>

      {/* Context Snippet */}
      <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur">
        <CardContent className="p-6">
          <div className="text-xs font-mono text-slate-500 mb-3 uppercase tracking-wider">
            Context Snippet
          </div>
          <div className="text-base leading-relaxed font-mono">
            <HighlightedContent
              content={currentDoc.text}
              redactions={redactions}
              activeIndex={currentRedactionIndex}
            />
          </div>
        </CardContent>
      </Card>

      {/* Redaction Cards */}
      <div className="space-y-2">
        <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">
          Suggested Redactions ({redactions.length})
        </div>
        {redactions.map((r: Redaction, i: number) => (
          <RedactionCard
            key={`${r.type}-${r.startIndex}`}
            redaction={r}
            isActive={i === currentRedactionIndex}
            index={i}
            flashEffect={i === currentRedactionIndex ? flashEffect : null}
          />
        ))}
      </div>

      {/* Active Redaction Detail */}
      {activeRedaction && (
        <Card
          className={`border transition-all duration-200 ${
            flashEffect === "approve"
              ? "border-emerald-500 bg-emerald-500/10"
              : flashEffect === "reject"
              ? "border-red-500 bg-red-500/10"
              : "border-slate-700/50 bg-slate-900/50"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-slate-400">
                  [{currentRedactionIndex + 1}/{redactions.length}]
                </span>
                <div>
                  <span className="text-sm text-slate-300 font-medium">
                    {activeRedaction.value}
                  </span>
                  <span className="text-xs text-slate-500 ml-2">
                    ({activeRedaction.type})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ConfidenceMeter confidence={activeRedaction.confidence} />
                <div className="flex gap-2">
                  <kbd className="kbd-key bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
                    Y
                  </kbd>
                  <span className="text-xs text-slate-500">approve</span>
                  <kbd className="kbd-key bg-red-500/20 text-red-400 border-red-500/40">
                    X
                  </kbd>
                  <span className="text-xs text-slate-500">reject</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keyboard Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-slate-600 pt-2 border-t border-slate-800">
        <span>
          <kbd className="kbd-key">J</kbd> next
        </span>
        <span>
          <kbd className="kbd-key">K</kbd> prev
        </span>
        <span>
          <kbd className="kbd-key bg-emerald-500/10 text-emerald-500 border-emerald-500/30">Y</kbd> approve
        </span>
        <span>
          <kbd className="kbd-key bg-red-500/10 text-red-500 border-red-500/30">X</kbd> reject
        </span>
        <span>
          <kbd className="kbd-key bg-cyan-500/10 text-cyan-400 border-cyan-500/30">⇧↵</kbd> finalize
        </span>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function HighlightedContent({
  content,
  redactions,
  activeIndex,
}: {
  content: string;
  redactions: Redaction[];
  activeIndex: number;
}) {
  // Sort redactions by startIndex to render in order
  const sorted = [...redactions]
    .map((r, i) => ({ ...r, originalIndex: i }))
    .sort((a, b) => a.startIndex - b.startIndex);

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  sorted.forEach((r) => {
    // Text before redaction
    if (r.startIndex > lastEnd) {
      parts.push(
        <span key={`text-${lastEnd}`} className="text-slate-300">
          {content.slice(lastEnd, r.startIndex)}
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
        className={`inline-block px-1 rounded border transition-all duration-200 ${statusClasses} ${
          isActive
            ? "ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-900 scale-105"
            : ""
        }`}
      >
        {r.value}
        <sup className="text-[10px] ml-0.5 opacity-60">{r.confidence}%</sup>
      </span>
    );

    lastEnd = r.endIndex;
  });

  // Trailing text
  if (lastEnd < content.length) {
    parts.push(
      <span key={`text-${lastEnd}`} className="text-slate-300">
        {content.slice(lastEnd)}
      </span>
    );
  }

  return <>{parts}</>;
}

function RedactionCard({
  redaction,
  isActive,
  index,
  flashEffect,
}: {
  redaction: Redaction;
  isActive: boolean;
  index: number;
  flashEffect: string | null;
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
      className={`flex items-center gap-3 px-4 py-2 rounded-lg border transition-all duration-200 cursor-default ${
        isActive
          ? "bg-slate-800/80 border-cyan-500/50 shadow-lg shadow-cyan-500/5"
          : "bg-slate-900/30 border-slate-800 hover:border-slate-700"
      } ${
        flashEffect === "approve"
          ? "border-emerald-500 bg-emerald-500/5"
          : flashEffect === "reject"
          ? "border-red-500 bg-red-500/5"
          : ""
      }`}
    >
      <span className="text-xs font-mono text-slate-600 w-4">{index + 1}</span>
      <span className={`w-4 text-center font-bold ${statusColor}`}>
        {statusIcon}
      </span>
      <Badge
        variant="outline"
        className={`text-xs ${
          isActive ? "border-cyan-500/50 text-cyan-400" : "border-slate-700 text-slate-500"
        }`}
      >
        {redaction.type}
      </Badge>
      <span className={`text-sm font-mono flex-1 ${isActive ? "text-slate-200" : "text-slate-400"}`}>
        {redaction.value}
      </span>
      <ConfidenceMeter confidence={redaction.confidence} small />
    </div>
  );
}

function ConfidenceMeter({
  confidence,
  small = false,
}: {
  confidence: number;
  small?: boolean;
}) {
  const color =
    confidence >= 90
      ? "bg-emerald-500"
      : confidence >= 75
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className={`flex items-center gap-1.5 ${small ? "w-16" : "w-24"}`}>
      <div className={`flex-1 ${small ? "h-1" : "h-1.5"} bg-slate-700 rounded-full overflow-hidden`}>
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className={`font-mono ${small ? "text-[10px]" : "text-xs"} text-slate-500`}>
        {confidence}
      </span>
    </div>
  );
}
