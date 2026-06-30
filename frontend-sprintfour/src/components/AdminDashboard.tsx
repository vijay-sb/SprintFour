import { useTriageStore } from "@/store/useTriageStore";
import { Progress } from "@/components/ui/progress";

export function AdminDashboard() {
  const { uploadedQueue, metrics, userTier } = useTriageStore();

  const avgTime =
    metrics.processed > 0
      ? Math.round(metrics.totalTimeSpent / metrics.processed / 1000)
      : 0;

  const queueTotal = uploadedQueue.length + metrics.processed;
  const queueProgress =
    queueTotal > 0 ? Math.round((metrics.processed / queueTotal) * 100) : 0;
  const freeEta = Math.max(18, uploadedQueue.length * 6 + 18);
  const proEta = Math.max(6, Math.round(freeEta * 0.42));
  const autoYield = uploadedQueue.length > 0
    ? Math.round(
        (uploadedQueue.filter((doc) => !doc.requiresReview).length / uploadedQueue.length) * 100
      )
    : 0;

  return (
    <div className="bg-[#0b1220] text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-cyan-300" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-100/80">
              Conseal Triage Engine
            </div>
            <div className="mt-1 text-sm text-slate-300">
              Pro users stay ahead with priority AI and fewer manual stops.
            </div>
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs text-slate-300">
          Active lane: <span className="ml-1 font-semibold text-white">{userTier}</span>
        </div>
      </div>

      <div className="grid gap-px border-t border-white/8 bg-white/8 md:grid-cols-5">
        <MetricCell
          label="Processed"
          value={metrics.processed.toString()}
          sublabel={`of ${queueTotal}`}
          color="text-cyan-100"
        />
        <MetricCell
          label="Avg Time"
          value={`${avgTime}s`}
          sublabel="manual review"
          color="text-amber-100"
        />
        <MetricCell
          label="Auto-Exported"
          value={metrics.autoFinalizedDocs.toString()}
          sublabel="no reviewer needed"
          color="text-emerald-100"
        />
        <MetricCell
          label="Auto Yield"
          value={`${autoYield}%`}
          sublabel="hands-free docs"
          color="text-violet-100"
        />
        <MetricCell
          label="Benchmark"
          value={`${proEta}s`}
          sublabel={`pro vs ${freeEta}s free`}
          color="text-sky-100"
        />
      </div>

      <div className="border-t border-white/8 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="w-24 text-xs uppercase tracking-[0.2em] text-slate-400">Queue</span>
          <Progress value={queueProgress} className="flex-1 h-1.5" />
          <span className="w-12 text-right text-xs text-slate-400">
            {queueProgress}%
          </span>
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
    <div className="bg-[#0b1220] px-4 py-4 text-center">
      <div className="mb-1 text-[10px] uppercase tracking-[0.22em] text-slate-500">
        {label}
      </div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400">{sublabel}</div>
    </div>
  );
}
