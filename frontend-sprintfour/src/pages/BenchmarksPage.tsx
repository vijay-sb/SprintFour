import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = "http://localhost:3001";

interface StageTiming {
  totalMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
}

interface BenchmarkResult {
  provider: { tier1: string; glinerActive: boolean; ollamaActive: boolean };
  documents: number;
  stages: { regex: StageTiming; ner: StageTiming; cache: StageTiming };
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

const SAMPLE_SIZES = [25, 50, 100, 200];

function dur(ms: number): string {
  if (ms <= 0) return "0";
  if (ms < 1) return `${Math.round(ms * 1000)}µs`;
  if (ms < 1000) return `${ms < 10 ? ms.toFixed(2) : Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

async function fetchBenchmark(sample: number): Promise<BenchmarkResult> {
  const res = await fetch(`${API_BASE}/api/benchmark?refresh=1&sample=${sample}`);
  if (!res.ok) throw new Error(`Benchmark failed (${res.status})`);
  return res.json();
}

export function BenchmarksPage() {
  const [data, setData] = useState<BenchmarkResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [activeSample, setActiveSample] = useState(200);
  const [scaling, setScaling] = useState<BenchmarkResult[]>([]);
  const timerRef = useRef<number | null>(null);

  const startTimer = () => {
    setElapsed(0);
    const t0 = performance.now();
    timerRef.current = window.setInterval(() => setElapsed(performance.now() - t0), 100);
  };
  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const run = useCallback(async (sample: number) => {
    setRunning(true);
    setError(null);
    setScaling([]);
    setActiveSample(sample);
    startTimer();
    try {
      setData(await fetchBenchmark(sample));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      stopTimer();
      setRunning(false);
    }
  }, []);

  const runScaling = useCallback(async () => {
    setRunning(true);
    setError(null);
    setScaling([]);
    startTimer();
    try {
      const collected: BenchmarkResult[] = [];
      for (const size of SAMPLE_SIZES) {
        const r = await fetchBenchmark(size);
        collected.push(r);
        setScaling([...collected]);
        setData(r);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      stopTimer();
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void run(200);
    return stopTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-700">
          Live Engine Benchmarks
        </div>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Every metric, measured on demand</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Runs the real detection pipeline over the dataset in your browser — regex speed, AI speed,
          cache effectiveness, throughput, and Pro priority. Nothing is hard-coded.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">Run on</span>
        {SAMPLE_SIZES.map((size) => (
          <button
            key={size}
            onClick={() => void run(size)}
            disabled={running}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
              activeSample === size && scaling.length === 0
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {size} docs
          </button>
        ))}
        <div className="mx-1 h-6 w-px bg-neutral-200" />
        <button
          onClick={() => void runScaling()}
          disabled={running}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-100 disabled:opacity-50"
        >
          Run scaling test
        </button>

        <div className="ml-auto flex items-center gap-3 text-xs">
          {running ? (
            <span className="flex items-center gap-2 text-neutral-700">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-200 border-t-transparent" />
              running… {(elapsed / 1000).toFixed(1)}s
            </span>
          ) : data ? (
            <span className="text-neutral-400">
              {data.provider.tier1} · {data.provider.ollamaActive ? "ollama on" : "ollama off"} ·{" "}
              {data.provider.glinerActive ? "gliner on" : "heuristic"}
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
          Couldn't reach the benchmark API ({error}). Start the backend with{" "}
          <span className="font-mono">bun start</span> in <span className="font-mono">backend-sorintfour</span>.
        </div>
      ) : null}

      {data ? (
        <div className="space-y-5">
          {/* Pipeline stage latency */}
          <Section
            title="Pipeline stage speed"
            subtitle={`per document · averaged over ${data.documents} docs`}
            note={
              <>
                <p>
                  Every document flows through three stages. Each call is wrapped in{" "}
                  <code>performance.now()</code> and the elapsed time is recorded{" "}
                  <strong>per document</strong>; we then report the average, median (<code>p50</code>),
                  95th percentile (<code>p95</code>) and the summed <code>total</code> across all{" "}
                  {data.documents} docs.
                </p>
                <ul className="ml-4 list-disc space-y-1">
                  <li><strong>Tier 0 Regex</strong> — deterministic pattern matching for structured PII (SSN, email, phone…).</li>
                  <li><strong>Tier 1 AI NER</strong> — the GLiNER model, or the zero-dependency heuristic when no model is loaded.</li>
                  <li><strong>Cache lookup</strong> — one Aho-Corasick scan of the text against the growing gazetteer of confirmed entities; it grows slightly as more unique entities accumulate.</li>
                </ul>
              </>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <StageCard
                label="Tier 0 — Regex"
                desc="Deterministic structured PII"
                stage={data.stages.regex}
                tone="cyan"
                max={maxAvg(data)}
              />
              <StageCard
                label="Tier 1 — AI NER"
                desc={`Names & free-text (${data.provider.tier1})`}
                stage={data.stages.ner}
                tone="violet"
                max={maxAvg(data)}
              />
              <StageCard
                label="Cache lookup"
                desc="Aho-Corasick propagation"
                stage={data.stages.cache}
                tone="emerald"
                max={maxAvg(data)}
              />
            </div>
          </Section>

          {/* End-to-end speed */}
          <Section
            title="End-to-end speed"
            subtitle="tiered pipeline vs an LLM-only baseline"
            note={
              <>
                <p>Wall-clock measurements around the real processing loop:</p>
                <Formula>time to first redaction = regex time on document #1</Formula>
                <Formula>throughput = documents ÷ batch wall-clock seconds</Formula>
                <Formula>LLM-only baseline = documents × 3000ms (a local 3B model at ~3s/doc)</Formula>
                <Formula>speedup = LLM-only baseline ÷ batch wall-clock</Formula>
                <p>
                  "Time to first redaction" is what the user actually sees instantly, because regex
                  returns before any AI runs. The LLM-only figure is a projection (we don't run a 10-minute
                  baseline every click); swap in your measured Ollama latency to make it exact.
                </p>
              </>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <BigStat value={dur(data.speed.timeToFirstRedactionMs)} label="Time to first redaction" tone="emerald" />
              <BigStat value={`${data.speed.throughputDocsPerSec}/s`} label="Throughput" tone="cyan" />
              <BigStat value={dur(data.speed.batchWallMs)} label="Full batch (wall clock)" />
              <BigStat value={`${data.speed.speedupVsLlmOnly}×`} label="Faster than LLM-only" tone="cyan" />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Row label="Per-doc p50" value={dur(data.speed.perDocP50Ms)} />
              <Row label="Per-doc p95" value={dur(data.speed.perDocP95Ms)} />
              <Row label="LLM-only would take" value={dur(data.speed.llmOnlyProjectedMs)} muted />
            </div>
          </Section>

          {/* Caching */}
          <Section
            title="Caching efficiency"
            subtitle="cost scales with unique PII, not document count"
            note={
              <>
                <p>Counted directly from the detections produced across the batch:</p>
                <Formula>total occurrences = every PII detection summed over all docs</Formula>
                <Formula>unique entities = distinct (type + normalized value)</Formula>
                <Formula>dedup factor = total ÷ unique</Formula>
                <Formula>repeat rate ("PII is redundant") = (total − unique) ÷ total</Formula>
                <Formula>propagated streaming = occurrences matched by Aho-Corasick from entities confirmed in earlier docs ÷ total</Formula>
                <p>
                  <strong>Dedup factor</strong> is the headline: each unique entity needs the model once,
                  the rest are matched for free. "Propagated streaming" is lower than the repeat rate
                  because it runs online with no look-ahead — it only knows entities from documents already
                  processed; the repeat rate is the theoretical ceiling.
                </p>
              </>
            }
          >
            <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
              <div>
                <CompareBar
                  topLabel="Total PII occurrences"
                  topValue={data.efficiency.totalOccurrences}
                  bottomLabel="Unique entities (need inference)"
                  bottomValue={data.efficiency.uniqueEntities}
                />
                <div className="mt-3 text-xs text-neutral-500">
                  <span className="font-semibold text-emerald-700">
                    {data.efficiency.repeatsResolved.toLocaleString()} repeats
                  </span>{" "}
                  resolved by propagation — never sent to a model.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <BigStat value={`${data.efficiency.dedupFactor}×`} label="Fewer inferences" tone="emerald" />
                <BigStat value={`${Math.round(data.efficiency.repeatRate * 100)}%`} label="PII is redundant" tone="emerald" />
                <Meter label="Repeats overall" rate={data.efficiency.repeatRate} tone="emerald" />
                <Meter label="Propagated streaming" rate={data.efficiency.cacheHitRate} tone="cyan" />
              </div>
            </div>
          </Section>

          {/* Pro priority */}
          <Section
            title="Pro priority under load"
            subtitle={`${data.priority.proDocs} pro · ${data.priority.freeDocs} free · ${data.priority.concurrency} workers`}
            note={
              <>
                <p>
                  A discrete-event simulation of the real scheduler. All documents are enqueued at{" "}
                  <code>t=0</code>; a pool of <code>{data.priority.concurrency}</code> workers repeatedly
                  pulls the highest-priority job — <strong>Pro before Free</strong>, FIFO within a tier.
                </p>
                <Formula>per-doc cost = max(measured NER time, 80ms) — models a real AI tier (GLiNER ≈ 80ms)</Formula>
                <Formula>wait = time before a worker starts the doc</Formula>
                <Formula>priority speedup = free avg wait ÷ pro avg wait</Formula>
                <p>
                  This isolates queueing behaviour (it's why a single quick upload won't show a gap — the
                  effect only appears when many jobs compete). The mix here is{" "}
                  {Math.round(data.priority.proRatio * 100)}% Pro.
                </p>
              </>
            }
          >
            <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-3">
                <WaitBar label="Pro avg wait" value={data.priority.proAvgWaitMs} max={data.priority.freeAvgWaitMs} tone="bg-neutral-900" valueTone="text-neutral-900" />
                <WaitBar label="Free avg wait" value={data.priority.freeAvgWaitMs} max={data.priority.freeAvgWaitMs} tone="bg-neutral-300" valueTone="text-neutral-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <BigStat value={`${data.priority.prioritySpeedup}×`} label="Sooner for Pro" tone="violet" />
                <BigStat value={dur(data.priority.proP95WaitMs)} label="Pro p95 wait" />
                <Row label="Free p95 wait" value={dur(data.priority.freeP95WaitMs)} muted />
                <Row label="Pro p95 wait" value={dur(data.priority.proP95WaitMs)} />
              </div>
            </div>
          </Section>

          {/* Scaling */}
          {scaling.length > 1 ? (
            <Section
              title="Scaling"
              subtitle="throughput holds as the batch grows — time scales linearly, not worse"
              note={
                <>
                  <p>
                    The same benchmark is re-run at increasing sample sizes ({SAMPLE_SIZES.join(", ")} docs),
                    each a fresh in-memory run.
                  </p>
                  <ul className="ml-4 list-disc space-y-1">
                    <li><strong>Flat throughput</strong> (docs/sec roughly constant across sizes) = no per-document slowdown as volume grows.</li>
                    <li><strong>Linearly growing batch time</strong> = overall cost is <code>O(n)</code> in documents, the goal for a high-volume tool.</li>
                  </ul>
                  <p>A rising batch time with steady throughput is the healthy signature — it means doubling the workload roughly doubles the time, no worse.</p>
                </>
              }
            >
              <div className="grid gap-6 md:grid-cols-2">
                <ScalingChart
                  title="Throughput (docs/sec)"
                  points={scaling.map((s) => ({ label: `${s.documents}`, value: s.speed.throughputDocsPerSec }))}
                  tone="bg-neutral-900"
                  fmt={(v) => `${v}/s`}
                />
                <ScalingChart
                  title="Full batch time"
                  points={scaling.map((s) => ({ label: `${s.documents}`, value: s.speed.batchWallMs }))}
                  tone="bg-neutral-400"
                  fmt={(v) => dur(v)}
                />
              </div>
            </Section>
          ) : null}

          {data.generatedAt ? (
            <div className="text-[11px] text-neutral-400">
              Last run {new Date(data.generatedAt).toLocaleTimeString()} · efficiency from cross-document
              de-duplication · speed vs a 3B local LLM at ~3s/doc · priority simulated at ~80ms/doc AI cost.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function maxAvg(d: BenchmarkResult): number {
  return Math.max(d.stages.regex.avgMs, d.stages.ner.avgMs, d.stages.cache.avgMs, 0.001);
}

function Section({
  title,
  subtitle,
  note,
  children,
}: {
  title: string;
  subtitle: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        <p className="text-[11px] text-neutral-400">{subtitle}</p>
      </div>
      {children}
      {note ? <MethodNote>{note}</MethodNote> : null}
    </div>
  );
}

function MethodNote({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 [&_code]:rounded [&_code]:bg-neutral-200 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[10px] [&_code]:text-neutral-700">
      <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-700">
        How this is measured
      </summary>
      <div className="mt-2 space-y-1.5 text-[11px] leading-5 text-neutral-500">{children}</div>
    </details>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md bg-neutral-100 px-2 py-1 font-mono text-[10px] text-neutral-600">{children}</div>;
}

function StageCard({
  label,
  desc,
  stage,
  tone,
  max,
}: {
  label: string;
  desc: string;
  stage: StageTiming;
  tone: "cyan" | "violet" | "emerald";
  max: number;
}) {
  const colors = {
    cyan: { text: "text-neutral-900", bar: "bg-neutral-900" },
    violet: { text: "text-neutral-900", bar: "bg-neutral-900" },
    emerald: { text: "text-neutral-900", bar: "bg-neutral-900" },
  }[tone];
  const pct = Math.min(100, (stage.avgMs / max) * 100);

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-sm font-semibold text-neutral-900">{label}</div>
      <div className="mb-3 text-[11px] text-neutral-400">{desc}</div>
      <div className={`text-3xl font-bold ${colors.text}`}>{dur(stage.avgMs)}</div>
      <div className="mb-3 text-[11px] text-neutral-400">avg / document</div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
        <MiniStat label="p50" value={dur(stage.p50Ms)} />
        <MiniStat label="p95" value={dur(stage.p95Ms)} />
        <MiniStat label="total" value={dur(stage.totalMs)} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-neutral-100 py-1.5">
      <div className="text-neutral-400">{label}</div>
      <div className="font-mono text-neutral-700">{value}</div>
    </div>
  );
}

function BigStat({ value, label, tone }: { value: string; label: string; tone?: "cyan" | "emerald" | "violet" }) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "cyan" ? "text-neutral-700" : tone === "violet" ? "text-neutral-700" : "text-neutral-900";
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-[11px] text-neutral-500">{label}</div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs">
      <span className="text-neutral-500">{label}</span>
      <span className={`font-mono font-semibold ${muted ? "text-neutral-400" : "text-neutral-700"}`}>{value}</span>
    </div>
  );
}

function Meter({ label, rate, tone }: { label: string; rate: number; tone: "emerald" | "cyan" }) {
  const pct = Math.round(rate * 100);
  const bar = tone === "emerald" ? "bg-emerald-500" : "bg-neutral-900";
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-neutral-500">{label}</span>
        <span className="font-mono text-neutral-700">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CompareBar({
  topLabel,
  topValue,
  bottomLabel,
  bottomValue,
}: {
  topLabel: string;
  topValue: number;
  bottomLabel: string;
  bottomValue: number;
}) {
  const max = Math.max(topValue, bottomValue, 1);
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-neutral-500">{topLabel}</span>
          <span className="font-mono font-semibold text-neutral-700">{topValue.toLocaleString()}</span>
        </div>
        <div className="h-6 overflow-hidden rounded-md bg-neutral-100">
          <div className="h-full rounded-md bg-neutral-300" style={{ width: `${(topValue / max) * 100}%` }} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-neutral-500">{bottomLabel}</span>
          <span className="font-mono font-semibold text-emerald-700">{bottomValue.toLocaleString()}</span>
        </div>
        <div className="h-6 overflow-hidden rounded-md bg-neutral-100">
          <div className="h-full rounded-md bg-neutral-900" style={{ width: `${(bottomValue / max) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function WaitBar({
  label,
  value,
  max,
  tone,
  valueTone,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
  valueTone: string;
}) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-neutral-500">{label}</span>
        <span className={`font-mono ${valueTone}`}>{dur(value)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ScalingChart({
  title,
  points,
  tone,
  fmt,
}: {
  title: string;
  points: { label: string; value: number }[];
  tone: string;
  fmt: (v: number) => string;
}) {
  const max = Math.max(...points.map((p) => p.value), 0.001);
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-4 text-xs font-semibold text-neutral-600">{title}</div>
      <div className="flex h-40 items-end justify-around gap-3">
        {points.map((p) => (
          <div key={p.label} className="flex flex-1 flex-col items-center gap-2">
            <span className="font-mono text-[10px] text-neutral-600">{fmt(p.value)}</span>
            <div
              className={`w-full rounded-t-md ${tone}`}
              style={{ height: `${Math.max(4, (p.value / max) * 100)}%` }}
            />
            <span className="text-[10px] text-neutral-400">{p.label} docs</span>
          </div>
        ))}
      </div>
    </div>
  );
}
