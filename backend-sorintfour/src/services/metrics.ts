// Live pipeline metrics — powers /api/metrics and the dashboard.
// Tracks per-tier (pro vs free) wait + processing times so we can show,
// with real numbers, that Pro requests jump the queue.

type Tier = "free" | "pro";

interface JobSample {
  tier: Tier;
  waitMs: number; // time spent in queue before processing started
  processMs: number; // time spent actually processing
  occurrences: number;
  propagated: number; // detections resolved from cache (no inference)
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]!);
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

class MetricsTracker {
  private samples: JobSample[] = [];
  private firstStart = 0;
  private lastEnd = 0;

  record(sample: JobSample): void {
    if (this.firstStart === 0) this.firstStart = Date.now();
    this.lastEnd = Date.now();
    this.samples.push(sample);
  }

  private tierView(tier: Tier) {
    const subset = this.samples.filter((s) => s.tier === tier);
    const waits = subset.map((s) => s.waitMs);
    const procs = subset.map((s) => s.processMs);
    return {
      count: subset.length,
      avgWaitMs: avg(waits),
      p95WaitMs: percentile(waits, 95),
      avgProcessMs: avg(procs),
    };
  }

  snapshot() {
    const total = this.samples.length;
    const elapsedSec = this.firstStart ? Math.max(0.001, (this.lastEnd - this.firstStart) / 1000) : 0;
    const occurrences = this.samples.reduce((a, s) => a + s.occurrences, 0);
    const propagated = this.samples.reduce((a, s) => a + s.propagated, 0);

    const free = this.tierView("free");
    const pro = this.tierView("pro");
    const prioritySpeedup =
      pro.avgWaitMs > 0 ? Number((free.avgWaitMs / Math.max(1, pro.avgWaitMs)).toFixed(1)) : 0;

    return {
      processed: total,
      throughputDocsPerSec: elapsedSec > 0 ? Number((total / elapsedSec).toFixed(2)) : 0,
      occurrences,
      propagated,
      cacheHitRate: occurrences > 0 ? Number((propagated / occurrences).toFixed(3)) : 0,
      tiers: { free, pro },
      prioritySpeedup,
    };
  }

  reset(): void {
    this.samples = [];
    this.firstStart = 0;
    this.lastEnd = 0;
  }
}

export const metrics = new MetricsTracker();
