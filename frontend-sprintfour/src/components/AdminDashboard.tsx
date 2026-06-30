import { useTriageStore } from "@/store/useTriageStore";

export function AdminDashboard() {
  const { uploadedQueue, metrics, userTier } = useTriageStore();

  const avgTime =
    metrics.processed > 0
      ? Math.round(metrics.totalTimeSpent / metrics.processed / 1000)
      : 0;

  const queueTotal = uploadedQueue.length + metrics.processed;
  const queueProgress =
    queueTotal > 0 ? Math.round((metrics.processed / queueTotal) * 100) : 0;
  const autoYield =
    uploadedQueue.length > 0
      ? Math.round(
          (uploadedQueue.filter((doc) => !doc.requiresReview).length / uploadedQueue.length) * 100
        )
      : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/50">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
          </span>
          <span className="text-sm font-semibold text-white">Conseal Triage Engine</span>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">
            {userTier} lane
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Metric label="Processed" value={`${metrics.processed}`} sub={`of ${queueTotal}`} color="text-cyan-200" />
          <Metric label="Auto-exported" value={`${metrics.autoFinalizedDocs}`} sub="no reviewer" color="text-emerald-200" />
          <Metric label="Auto yield" value={`${autoYield}%`} sub="hands-free" color="text-violet-200" />
          <Metric label="Avg time" value={`${avgTime}s`} sub="per doc" color="text-amber-200" />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-white/8 px-4 py-2">
        <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Batch</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${queueProgress}%` }}
          />
        </div>
        <span className="w-10 text-right text-xs text-slate-400">{queueProgress}%</span>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className={`text-base font-semibold ${color}`}>{value}</span>
        <span className="text-[10px] text-slate-500">{sub}</span>
      </span>
    </div>
  );
}
