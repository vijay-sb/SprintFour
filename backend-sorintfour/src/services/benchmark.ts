// Benchmark harness — produces the numbers for the pitch.
//
// Measures the three claims:
//   1. Speed       — tiered pipeline vs LLM-only (throughput, p50/p95).
//   2. Efficiency  — entity cache: occurrences resolved without inference.
//   3. Priority    — Pro requests wait far less than Free (scheduler sim).

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { regexProvider } from "./providers/regexProvider.js";
import { glinerProvider } from "./providers/glinerProvider.js";
import { heuristicNerProvider } from "./providers/heuristicNerProvider.js";
import { isOllamaAvailable } from "./ollamaEngine.js";
import { EntityCache } from "./entityCache.js";
import type { Detection } from "./providers/types.js";

// Representative per-document latency of an LLM-only pipeline (local 3B model).
const LLM_ONLY_LATENCY_MS = 3000;
// Representative per-document cost of the always-on AI tier (GLiNER CPU
// ~80ms). The heuristic fallback is sub-millisecond, which would make the
// priority simulation's absolute wait times unrealistically small, so the
// scheduler sim models the real AI-tier cost instead.
const AI_TIER_LATENCY_MS = 80;

export interface BenchmarkOptions {
  datasetDir: string;
  sampleSize?: number;
  proRatio?: number; // fraction of docs that are Pro
  concurrency?: number; // worker pool size for the priority sim
}

export interface BenchmarkResult {
  provider: { tier1: string; glinerActive: boolean; ollamaActive: boolean };
  documents: number;
  efficiency: {
    totalOccurrences: number;
    uniqueEntities: number;
    repeatsResolved: number;
    repeatRate: number; // 0..1
    dedupFactor: number; // total / unique
    propagatedOnline: number; // resolved by Aho-Corasick as the batch streamed
    cacheHitRate: number; // propagatedOnline / total
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
    prioritySpeedup: number; // freeAvgWait / proAvgWait
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!);
}

function mergeSimple(groups: Detection[][]): Detection[] {
  const all = groups.flat().sort((a, b) => a.startIndex - b.startIndex);
  const out: Detection[] = [];
  for (const det of all) {
    const overlap = out.find((e) => det.startIndex < e.endIndex && det.endIndex > e.startIndex);
    if (!overlap) out.push({ ...det });
    else if (det.confidence > overlap.confidence) overlap.confidence = det.confidence;
  }
  return out;
}

// Simulate the priority scheduler: every doc is enqueued at t=0, a pool of
// `concurrency` workers pulls Pro-first. Returns per-tier wait times.
function simulatePriority(
  docs: { tier: "free" | "pro"; ms: number }[],
  concurrency: number
) {
  const ordered = docs
    .map((d, i) => ({ ...d, i }))
    .sort((a, b) => (b.tier === "pro" ? 1 : 0) - (a.tier === "pro" ? 1 : 0) || a.i - b.i);

  const workers = new Array(Math.max(1, concurrency)).fill(0);
  const waits = { free: [] as number[], pro: [] as number[] };

  for (const job of ordered) {
    let w = 0;
    for (let k = 1; k < workers.length; k++) if (workers[k] < workers[w]) w = k;
    const startAt = workers[w]!;
    waits[job.tier].push(startAt); // arrived at t=0, so wait = startAt
    workers[w] = startAt + job.ms;
  }

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  return {
    proAvgWaitMs: avg(waits.pro),
    freeAvgWaitMs: avg(waits.free),
    proP95WaitMs: percentile(waits.pro, 95),
    freeP95WaitMs: percentile(waits.free, 95),
  };
}

export async function runBenchmark(opts: BenchmarkOptions): Promise<BenchmarkResult> {
  const proRatio = opts.proRatio ?? 0.3;
  const concurrency = opts.concurrency ?? 2;

  const files = readdirSync(opts.datasetDir)
    .filter((f) => f.endsWith(".txt"))
    .slice(0, opts.sampleSize ?? Infinity);

  const glinerActive = await glinerProvider.isAvailable();
  const ollamaActive = await isOllamaAvailable();
  const tier1 = glinerActive ? glinerProvider : heuristicNerProvider;

  const cache = new EntityCache();
  const uniqueKeys = new Set<string>();
  const perDocMs: number[] = [];
  const tierAssignments: { tier: "free" | "pro"; ms: number }[] = [];

  let totalOccurrences = 0;
  let propagatedOnline = 0;
  let timeToFirstRedactionMs = 0;

  const batchStart = performance.now();

  let idx = 0;
  for (const file of files) {
    const text = readFileSync(join(opts.datasetDir, file), "utf-8");

    // Tier 0 timing → time-to-first-redaction
    const t0 = performance.now();
    const regexHits = await regexProvider.detect(text);
    if (idx === 0) timeToFirstRedactionMs = Number((performance.now() - t0).toFixed(2));

    // Cache propagation (free) — entities confirmed by earlier docs
    const propagated = cache.propagate(text);

    // Tier 1 NER (the "inference")
    const nerStart = performance.now();
    const tier1Hits = await tier1.detect(text);
    const docMs = performance.now() - nerStart;
    perDocMs.push(docMs);

    const merged = mergeSimple([regexHits, propagated, tier1Hits]);
    totalOccurrences += merged.length;
    propagatedOnline += merged.filter((d) => d.provider === "cache-propagated").length;

    for (const det of merged) {
      uniqueKeys.add(`${det.type}::${det.value.trim().toLowerCase()}`);
      if (det.provider !== "cache-propagated") {
        cache.remember(det.value, det.type, det.confidence, true);
      }
    }

    tierAssignments.push({
      tier: idx < Math.round(files.length * proRatio) ? "pro" : "free",
      ms: Math.max(docMs, AI_TIER_LATENCY_MS),
    });
    idx += 1;
  }

  const batchWallMs = Number((performance.now() - batchStart).toFixed(1));
  const uniqueEntities = uniqueKeys.size;
  const repeatsResolved = Math.max(0, totalOccurrences - uniqueEntities);

  // shuffle-free deterministic tier split, then simulate the scheduler
  const proDocs = tierAssignments.filter((t) => t.tier === "pro").length;
  const sim = simulatePriority(tierAssignments, concurrency);

  return {
    provider: { tier1: tier1.name, glinerActive, ollamaActive },
    documents: files.length,
    efficiency: {
      totalOccurrences,
      uniqueEntities,
      repeatsResolved,
      repeatRate: totalOccurrences > 0 ? Number((repeatsResolved / totalOccurrences).toFixed(3)) : 0,
      dedupFactor: uniqueEntities > 0 ? Number((totalOccurrences / uniqueEntities).toFixed(1)) : 0,
      propagatedOnline,
      cacheHitRate: totalOccurrences > 0 ? Number((propagatedOnline / totalOccurrences).toFixed(3)) : 0,
    },
    speed: {
      timeToFirstRedactionMs,
      batchWallMs,
      throughputDocsPerSec: batchWallMs > 0 ? Number((files.length / (batchWallMs / 1000)).toFixed(1)) : 0,
      perDocP50Ms: percentile(perDocMs, 50),
      perDocP95Ms: percentile(perDocMs, 95),
      llmOnlyProjectedMs: files.length * LLM_ONLY_LATENCY_MS,
      speedupVsLlmOnly:
        batchWallMs > 0
          ? Number(((files.length * LLM_ONLY_LATENCY_MS) / batchWallMs).toFixed(1))
          : 0,
    },
    priority: {
      proRatio,
      concurrency,
      proDocs,
      freeDocs: files.length - proDocs,
      proAvgWaitMs: sim.proAvgWaitMs,
      freeAvgWaitMs: sim.freeAvgWaitMs,
      proP95WaitMs: sim.proP95WaitMs,
      freeP95WaitMs: sim.freeP95WaitMs,
      prioritySpeedup:
        sim.proAvgWaitMs > 0 ? Number((sim.freeAvgWaitMs / sim.proAvgWaitMs).toFixed(1)) : 0,
    },
  };
}
