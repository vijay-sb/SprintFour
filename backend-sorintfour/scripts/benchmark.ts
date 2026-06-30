// CLI benchmark — run with:  bun run scripts/benchmark.ts [sampleSize]
//
// Prints the speed / efficiency / priority numbers and writes a JSON
// snapshot to results/benchmark.json for the frontend to display.

import { join } from "path";
import { mkdirSync, writeFileSync } from "fs";
import { runBenchmark } from "../src/services/benchmark.js";

const sampleSize = process.argv[2] ? Number(process.argv[2]) : undefined;
const datasetDir = join(import.meta.dir, "..", "dataset");
const resultsDir = join(import.meta.dir, "..", "results");

function ms(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`;
}

function bar(rate: number, width = 24): string {
  const filled = Math.round(rate * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

const r = await runBenchmark({ datasetDir, sampleSize, proRatio: 0.3, concurrency: 2 });

const line = "─".repeat(56);
console.log(`\n\x1b[1m  CONSEAL TRIAGE ENGINE — BENCHMARK\x1b[0m`);
console.log(`  ${r.documents} documents · tier-1 = ${r.provider.tier1}` +
  ` · ollama ${r.provider.ollamaActive ? "on" : "off"}\n`);

console.log(`\x1b[1m  ① EFFICIENCY — cost scales with unique PII, not docs\x1b[0m`);
console.log(line);
console.log(`  Total PII occurrences      ${r.efficiency.totalOccurrences.toLocaleString()}`);
console.log(`  Unique entities            ${r.efficiency.uniqueEntities.toLocaleString()}`);
console.log(`  Repeats resolved free      ${r.efficiency.repeatsResolved.toLocaleString()}` +
  `  (${(r.efficiency.repeatRate * 100).toFixed(0)}%)`);
console.log(`  Dedup factor               \x1b[32m${r.efficiency.dedupFactor}×\x1b[0m fewer inferences`);
console.log(`  Propagated online          ${r.efficiency.propagatedOnline.toLocaleString()}`);
console.log(`  Cache hit rate             ${bar(r.efficiency.cacheHitRate)} ${(r.efficiency.cacheHitRate * 100).toFixed(0)}%\n`);

console.log(`\x1b[1m  ② SPEED — tiered pipeline vs LLM-only\x1b[0m`);
console.log(line);
console.log(`  Time to first redaction    \x1b[32m${ms(r.speed.timeToFirstRedactionMs)}\x1b[0m  (regex tier)`);
console.log(`  Full batch (wall clock)    ${ms(r.speed.batchWallMs)}`);
console.log(`  Throughput                 ${r.speed.throughputDocsPerSec} docs/sec`);
console.log(`  Per-doc p50 / p95          ${ms(r.speed.perDocP50Ms)} / ${ms(r.speed.perDocP95Ms)}`);
console.log(`  LLM-only would take        ${ms(r.speed.llmOnlyProjectedMs)}`);
console.log(`  Speedup vs LLM-only        \x1b[32m${r.speed.speedupVsLlmOnly}×\x1b[0m\n`);

console.log(`\x1b[1m  ③ PRIORITY — Pro requests jump the line\x1b[0m`);
console.log(line);
console.log(`  Mix                        ${r.priority.proDocs} pro · ${r.priority.freeDocs} free · ${r.priority.concurrency} workers`);
console.log(`  Pro avg wait               \x1b[32m${ms(r.priority.proAvgWaitMs)}\x1b[0m  (p95 ${ms(r.priority.proP95WaitMs)})`);
console.log(`  Free avg wait              \x1b[33m${ms(r.priority.freeAvgWaitMs)}\x1b[0m  (p95 ${ms(r.priority.freeP95WaitMs)})`);
console.log(`  Pro is                     \x1b[32m${r.priority.prioritySpeedup}×\x1b[0m faster to start\n`);

mkdirSync(resultsDir, { recursive: true });
const outPath = join(resultsDir, "benchmark.json");
writeFileSync(outPath, JSON.stringify({ ...r, generatedAt: new Date().toISOString() }, null, 2));
console.log(`  → snapshot written to results/benchmark.json\n`);
