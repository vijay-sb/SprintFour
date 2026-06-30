# Conseal.ai — PII Redaction at Volume

Local-first tool to anonymize hundreds of legal/medical documents fast. Review **decisions, not documents** — and the AI runs on-device with no single point of failure.

## Demo

https://github.com/user-attachments/assets/recording1.mp4

> If the player above doesn't load, watch [`recording1.mp4`](recording1.mp4) directly.

<video src="recording1.mp4" controls width="100%"></video>

## Setup

**Backend** (port 3001)
```bash
cd backend-sorintfour
bun install
bun start
```

**Frontend** (port 5173)
```bash
cd frontend-sprintfour
npm install
npm run dev
```

Open the printed URL → **Process** tab to triage, **Benchmarks** tab for live numbers.

Optional:
```bash
bun run benchmark        # run the benchmark from the CLI
GLINER_MODEL_PATH=./models/gliner.onnx bun start   # enable the GLiNER model tier
```

## Workflow & services

A document flows top to bottom; each service does one job.

| Service | What it does (in short) |
|---|---|
| **regexEngine** | Tier 0. Instantly matches structured PII (SSN, email, phone, card) by pattern. Returns in <1ms so the user sees results immediately. |
| **providers/** | A common `DetectionProvider` interface for regex, GLiNER, heuristic, and Ollama. Lets the pipeline swap engines and degrade gracefully if one is down. |
| **glinerProvider / heuristicNerProvider** | Tier 1 (AI). GLiNER (local ONNX model) finds names/addresses; if no model is loaded, the rule-based heuristic runs instead — so the AI tier is never empty. |
| **ollamaProvider** | Tier 2 (optional). Heavy LLM deep-verify, off the critical path — used only when explicitly enabled, never a bottleneck. |
| **detectionPipeline** | Composes the tiers: regex → cache propagation → NER → optional LLM, then merges results. Decides which providers are available. |
| **entityCache** | Remembers every confirmed entity once. Cost scales with *unique* PII, not document count. |
| **ahoCorasick** | Single-pass multi-pattern matcher. Propagates a known entity across the whole corpus in one linear scan — the 47 repeats of a name cost zero AI calls. |
| **priorityQueue** | Pro-first scheduler with a worker pool. Pro documents are processed before Free under load. |
| **metrics** | Records per-tier queue wait + processing time so the dashboard shows real Pro-vs-Free speed. |
| **benchmark** | Runs the whole pipeline over the dataset and reports speed, caching, and priority numbers. |

On the frontend, the **store** holds the queue and decisions, **BatchTriage** groups every detection across all files by type/value for one-click bulk approval, and results export to `backend-sorintfour/results/` as a redacted `.txt` + a `.manifest.json` audit file.

## Benchmark results (200 documents)

| Metric | Result |
|---|---|
| PII occurrences → unique entities | 47,251 → 3,948 |
| De-duplication | **12× fewer AI inferences** (92% of PII is repeats) |
| Time to first redaction | **~5 ms** (regex) |
| Throughput | ~52–140 docs/sec |
| Speedup vs LLM-only | **150–400×** |
| Pro vs Free queue wait | **1.2 s vs 5.2 s (4.4× faster)** |
