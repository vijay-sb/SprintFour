# Conseal.ai — PII Redaction at Volume

> Local-first PII detection and redaction built for a paralegal who has **200 case files to anonymize before end of day** and will abandon any tool that slows her down.

Conseal pairs an **instant deterministic pass** with an **always-on local AI tier** and a **cross-document entity cache**, then puts a reviewer in front of *decisions, not documents*. The result: the human reviews each unique piece of PII once, the machine detects each unique piece of PII once, and 200 files get cleared in seconds — fully on-device.

📄 Deep design rationale lives in **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## The problem

> *Maya is a paralegal. She has 200 case files to anonymize before end of day, and right now she does them one document at a time. She is fast, she is under pressure, and she is exactly the kind of user who will abandon a tool the moment it slows her down.*

Two things make the naive approach fail at volume:

1. **The unit of work is wrong.** Reviewing 200 documents one-by-one means *reading* 200 documents. The same client name, firm address, and boilerplate repeat across the whole batch — re-reviewing them is wasted human effort.
2. **The AI is a bottleneck and a single point of failure.** Running a heavy LLM on every document is slow, and if the model server (Ollama) is down, the whole pipeline stalls.

Conseal solves both — once in the **UX** and once in the **systems layer**, using the same idea: **detect/decide each unique entity once, apply it everywhere.**

---

## What we built

### 1. Batch Triage — review decisions, not documents
- Every detection across the **entire batch** is clustered by **PII type** and by **repeated value** (the client name appearing in 47 files is one row, tagged "47 files").
- Sweeping bulk actions: *Approve all ≥90%*, *Approve all SSNs*, approve a repeated entity everywhere — one click updates that decision across every document.
- A **"needs attention only"** filter collapses the view to the ambiguous long tail.
- **One button finalizes and exports all 200 files.**
- ~2,000 individual decisions collapse to ~15 class decisions + a handful of edge cases.

### 2. Three triage modes
| Mode | For |
|---|---|
| **Batch** (default) | High-volume cross-document sweeping — the Maya workflow |
| **Document** | Detailed single-file review with full text + PII list |
| **Vim** (Pro) | Keyboard-only triage — `j/k` jump **only to items needing review**, `y` approve, `x` reject, `a` approve all, `Shift+Enter` finalize, `Esc` exit |

### 3. A tiered, fault-tolerant detection pipeline
```
Tier 0  Regex            — deterministic, <1ms, structured PII (always on)
Cache   Entity propagate — known entities matched across the corpus for free
Tier 1  Local NER        — GLiNER (ONNX) or heuristic fallback (always on)
Tier 2  LLM deep-verify  — Ollama, optional, off the critical path
```
The AI tier is **never on the critical path** and **never a single point of failure** — whichever providers are available are used, the rest skipped.

### 4. A benchmark suite (in-app + CLI)
A dedicated **Benchmarks** tab runs the real pipeline over the dataset on demand and shows stage-by-stage timing, caching efficiency, throughput, Pro-priority, and a scaling test — every number is live, nothing hard-coded.

---

## Headline numbers (real run, 200 documents)

| Metric | Value |
|---|---|
| Total PII occurrences → unique entities | **47,251 → 3,948** |
| **De-duplication factor** | **12× fewer inferences** (92% of PII is repeats) |
| Time to first redaction | **~5 ms** (regex tier) |
| Throughput | **~52–140 docs/sec** |
| Speedup vs LLM-only baseline | **150–400×** |
| **Pro vs Free queue wait** | **1.2 s vs 5.2 s → 4.4× faster to start** |

---

## Tech stack

**Frontend** — React 19 · TypeScript · Vite · Tailwind CSS v4 · Zustand · React Router
**Backend** — Bun · Express · Multer · pdf-parse · `gliner` (ONNX/Transformers.js)

---

## Repository layout

```
sprintfour/
├── frontend-sprintfour/          # React SPA
│   └── src/
│       ├── pages/                # Landing, Process, Benchmarks, Pricing
│       ├── components/           # BatchTriage, SystemBenchmark, AdminDashboard, Navbar, ui/
│       └── store/useTriageStore.ts   # Zustand store: queue, decisions, polling, bulk actions
│
├── backend-sorintfour/           # Bun + Express API
│   ├── src/
│   │   ├── index.ts              # HTTP endpoints
│   │   └── services/
│   │       ├── regexEngine.ts        # Tier 0 detection
│   │       ├── providers/            # DetectionProvider abstraction (regex/gliner/heuristic/ollama)
│   │       ├── detectionPipeline.ts  # Tier composition + cache propagation
│   │       ├── entityCache.ts        # Content-addressed cache
│   │       ├── ahoCorasick.ts        # Multi-pattern propagation matcher
│   │       ├── priorityQueue.ts      # Pro-first scheduler + worker pool
│   │       ├── metrics.ts            # Live per-tier timing
│   │       └── benchmark.ts          # Benchmark harness
│   ├── scripts/benchmark.ts      # CLI benchmark
│   └── dataset/                  # 200 sample legal/medical documents
│
├── README.md
└── ARCHITECTURE.md               # design decisions + rationale
```

---

## Running locally

**1. Backend** (port `3001`):
```bash
cd backend-sorintfour
bun install
bun start            # or: bun run dev   (hot reload via tsx)
```

**2. Frontend** (port `5173`):
```bash
cd frontend-sprintfour
npm install          # or: bun install
npm run dev
```

Open the printed URL → **Process** tab to triage, **Benchmarks** tab for the numbers.

> The frontend currently expects the backend at `http://localhost:3001`. See the Deployment note in [ARCHITECTURE.md](ARCHITECTURE.md#deployment) for making this configurable.

**Run the benchmark from the CLI:**
```bash
cd backend-sorintfour
bun run benchmark            # full 200-doc run
bun run benchmark 50         # sample of 50
```

### Optional tiers
| Variable | Effect |
|---|---|
| `GLINER_MODEL_PATH=./models/gliner_multi_pii.onnx` | Activates the GLiNER local NER model (otherwise the heuristic NER tier runs — system stays fully functional) |
| `DEEP_VERIFY=1` | Enables the optional Ollama deep-verify tier (off by default so it never blocks) |

---

## API surface

| Endpoint | Purpose |
|---|---|
| `POST /api/upload-batch` | Upload files → instant regex results + enqueue AI enrichment |
| `GET /api/document/:id` | Full document record |
| `GET /api/document/:id/status` | Lightweight poll for progressive enrichment |
| `POST /api/document/:id/finalize` | Apply decisions → write redacted `.txt` + `.manifest.json` |
| `GET /api/metrics` | Live per-tier timing, throughput, cache, queue state |
| `GET /api/benchmark?sample=N&refresh=1` | Run the benchmark harness |
| `GET /api/health` | Provider availability |

Output is written to `backend-sorintfour/results/` as a sanitized text file plus a JSON manifest (the audit trail of what was redacted, when).

---

## Where it goes next
- Durable, resumable state via `bun:sqlite` (survives restart; queryable audit).
- Session-scoped entity cache for multi-tenant isolation.
- SSE/WebSocket streaming to replace status polling.
- Bake the GLiNER ONNX weights into the image for a one-command on-prem deploy.

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the reasoning behind every choice above.

---

*Built for the Sprint Four challenge — Problem 2: Working at Volume.*
