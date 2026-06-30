import { useTriageStore } from "@/store/useTriageStore";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function AdminDashboard() {
  const { uploadedQueue, metrics } = useTriageStore();

  const avgTime =
    metrics.processed > 0
      ? Math.round(metrics.totalTimeSpent / metrics.processed / 1000)
      : 0;

  const totalTimeSavedSeconds = metrics.processed * 45 - (metrics.totalTimeSpent / 1000);
  const timeSaved = Math.max(0, Math.round(totalTimeSavedSeconds));

  const totalRedactions =
    metrics.totalApproved +
    metrics.totalRejected +
    metrics.autoApproved;

  const autoRate =
    totalRedactions > 0
      ? Math.round((metrics.autoApproved / totalRedactions) * 100)
      : 0;

  const queueTotal = uploadedQueue.length + metrics.processed;
  const queueProgress =
    queueTotal > 0 ? Math.round((metrics.processed / queueTotal) * 100) : 0;

  return (
    <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-sm font-bold tracking-wider text-slate-200 uppercase">
            Conseal <span className="text-cyan-400">Triage Engine</span>
          </h1>
          <span className="text-xs font-mono text-slate-600 ml-2">v1.0</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-mono">VIM MODE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-emerald-400 font-mono">ACTIVE</span>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-5 gap-0 border-t border-slate-800">
        <MetricCell
          label="Processed"
          value={metrics.processed.toString()}
          sublabel={`of ${queueTotal}`}
          color="text-cyan-400"
        />
        <MetricCell
          label="Avg Time"
          value={`${avgTime}s`}
          sublabel="per doc"
          color="text-amber-400"
        />
        <MetricCell
          label="Time Saved"
          value={formatTimeSaved(timeSaved)}
          sublabel="vs manual"
          color="text-emerald-400"
        />
        <MetricCell
          label="Auto-Approve"
          value={`${autoRate}%`}
          sublabel={`${metrics.autoApproved} items`}
          color="text-violet-400"
        />
        <MetricCell
          label="Overrides"
          value={metrics.manualOverrides.toString()}
          sublabel="manual fixes"
          color="text-red-400"
        />
      </div>

      {/* Queue Progress */}
      <div className="px-6 py-2 border-t border-slate-800/50">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500 w-20">QUEUE</span>
          <Progress value={queueProgress} className="flex-1 h-1.5" />
          <span className="text-xs font-mono text-slate-500 w-12 text-right">
            {queueProgress}%
          </span>
        </div>
      </div>

      {/* Auto-Approve vs Manual bar */}
      <div className="px-6 py-2 border-t border-slate-800/50 flex items-center gap-3">
        <span className="text-xs font-mono text-slate-500 w-20">YIELD</span>
        <div className="flex-1 flex h-1.5 rounded-full overflow-hidden bg-slate-800">
          {totalRedactions > 0 && (
            <>
              <div
                className="bg-violet-500 transition-all duration-500"
                style={{
                  width: `${(metrics.autoApproved / totalRedactions) * 100}%`,
                }}
              />
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${(metrics.totalApproved / totalRedactions) * 100}%`,
                }}
              />
              <div
                className="bg-red-500 transition-all duration-500"
                style={{
                  width: `${(metrics.totalRejected / totalRedactions) * 100}%`,
                }}
              />
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="text-violet-400">● auto</span>
          <span className="text-emerald-400">● manual</span>
          <span className="text-red-400">● rejected</span>
        </div>
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  sublabel,
  color,
}: {
  label: string;
  value: string;
  sublabel: string;
  color: string;
}) {
  return (
    <div className="px-4 py-3 border-r border-slate-800 last:border-r-0 text-center">
      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-600">{sublabel}</div>
    </div>
  );
}

function formatTimeSaved(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

// Keep Card and CardContent exports available for other use
export { Card, CardContent };
