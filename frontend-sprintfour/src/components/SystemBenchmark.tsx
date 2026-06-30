import { useCallback, useEffect, useState } from "react";

const API_BASE = "http://localhost:3001";

interface BenchmarkResult {
  provider: { tier1: string; glinerActive: boolean; ollamaActive: boolean };
  documents: number;
  efficiency: {
    totalOccurrences: number;
    uniqueEntities: number;
    repeatsResolved: number;
    repeatRate: number;
    dedupFactor: number;
    propagatedOnline: number;
    cacheHitRate: number;
  };
  speed: {
    timeToFirstRedactionMs: number;
    batchWallMs: number;
    throughputDocsPerSec: number;
    perDocP50Ms: number;
    perDocP95Ms: number;
    llmOnlyProjectedMs: number;
    speedupVsLlmOnly: number;
  };
  priority: {
    proRatio: number;
    concurrency: number;
    proDocs: number;
    freeDocs: number;
    proAvgWaitMs: number;
    freeAvgWaitMs: number;
    proP95WaitMs: number;
    freeP95WaitMs: number;
    prioritySpeedup: number;
  };
  generatedAt?: string;
}

function fmtMs(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`;
}

export function SystemBenchmark({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/benchmark${refresh ? "?refresh=1" : ""}`);
      if (!res.ok) throw new Error(`Benchmark failed (${res.status})`);
      setData(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
        Running benchmark over the dataset…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/8 p-5 text-sm text-amber-100">
        Couldn't reach the benchmark API ({error}). Start the backend with{" "}
        <span className="font-mono">bun start</span>, or run{" "}
        <span className="font-mono">bun run benchmark</span> in the backend.
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
            Systems Benchmark
          </div>
          <div className="mt-1 text-sm text-slate-300">
            {data.documents} documents · AI tier:{" "}
            <span className="text-slate-100">{data.provider.tier1}</span> ·{" "}
            {data.provider.ollamaActive ? "Ollama deep-verify on" : "Ollama off (not required)"}
          </div>
        </div>
        <button
          onClick={() => void load(true)}
          disabled={loading}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? "Running…" : "Re-run benchmark"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Efficiency */}
        <Panel title="Efficiency" caption="Cost scales with unique PII, not docs">
          <Hero value={`${data.efficiency.dedupFactor}×`} label="fewer model inferences" tone="emerald" />
          <Row label="Total occurrences" value={data.efficiency.totalOccurrences.toLocaleString()} />
          <Row label="Unique entities" value={data.efficiency.uniqueEntities.toLocaleString()} />
          <Meter label="Repeats (redundant PII)" rate={data.efficiency.repeatRate} tone="emerald" />
          <Meter label="Cache-propagated, streaming" rate={data.efficiency.cacheHitRate} tone="cyan" />
        </Panel>

        {/* Speed */}
        <Panel title="Speed" caption="Tiered pipeline vs LLM-only">
          <Hero value={`${data.speed.speedupVsLlmOnly}×`} label="faster than LLM-only" tone="cyan" />
          <Row label="First redaction" value={fmtMs(data.speed.timeToFirstRedactionMs)} highlight />
          <Row label="Full batch" value={fmtMs(data.speed.batchWallMs)} />
          <Row label="Throughput" value={`${data.speed.throughputDocsPerSec}/s`} />
          <Row label="LLM-only would take" value={fmtMs(data.speed.llmOnlyProjectedMs)} muted />
        </Panel>

        {/* Priority */}
        <Panel title="Pro Priority" caption="Pro requests jump the queue">
          <Hero value={`${data.priority.prioritySpeedup}×`} label="sooner for Pro to start" tone="violet" />
          <WaitBars
            proWait={data.priority.proAvgWaitMs}
            freeWait={data.priority.freeAvgWaitMs}
          />
          <Row label="Pro p95 wait" value={fmtMs(data.priority.proP95WaitMs)} />
          <Row label="Free p95 wait" value={fmtMs(data.priority.freeP95WaitMs)} muted />
        </Panel>
      </div>

      {!compact && (
        <div className="mt-4 text-[11px] leading-5 text-slate-500">
          Efficiency from cross-document entity de-duplication (Aho-Corasick propagation). Speed vs a
          3 B local LLM at ~3 s/doc. Priority simulated over a {Math.round(data.priority.proRatio * 100)}%
          Pro mix on {data.priority.concurrency} workers — Pro jobs are dequeued before Free.
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/15 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-[11px] text-slate-500">{caption}</div>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Hero({ value, label, tone }: { value: string; label: string; tone: "emerald" | "cyan" | "violet" }) {
  const colors = {
    emerald: "text-emerald-300",
    cyan: "text-cyan-300",
    violet: "text-violet-300",
  };
  return (
    <div className="mb-1 border-b border-white/8 pb-3">
      <div className={`text-3xl font-bold ${colors[tone]}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span
        className={`font-mono font-semibold ${
          highlight ? "text-emerald-300" : muted ? "text-slate-500" : "text-slate-200"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Meter({ label, rate, tone }: { label: string; rate: number; tone: "emerald" | "cyan" }) {
  const pct = Math.round(rate * 100);
  const bar = tone === "emerald" ? "bg-emerald-400/70" : "bg-cyan-400/70";
  return (
    <div className="text-xs">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-300">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function WaitBars({ proWait, freeWait }: { proWait: number; freeWait: number }) {
  const max = Math.max(proWait, freeWait, 1);
  return (
    <div className="space-y-2 text-xs">
      <BarLine label="Pro" value={proWait} pct={(proWait / max) * 100} tone="bg-violet-400/80" valueTone="text-violet-200" />
      <BarLine label="Free" value={freeWait} pct={(freeWait / max) * 100} tone="bg-slate-500/70" valueTone="text-slate-300" />
    </div>
  );
}

function BarLine({
  label,
  value,
  pct,
  tone,
  valueTone,
}: {
  label: string;
  value: number;
  pct: number;
  tone: string;
  valueTone: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-slate-400">{label} avg wait</span>
        <span className={`font-mono ${valueTone}`}>{fmtMs(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
