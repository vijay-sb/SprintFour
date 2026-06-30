# Architecture — Conseal.ai

## System Overview

```mermaid
graph TB
    subgraph Frontend["Frontend — React SPA :5173"]
        LP[Landing Page]
        PP[Process Page]
        BP[Benchmarks Page]
        PR[Pricing Page]
        BT[BatchTriage]
        TW[TriageWorkspace]
        SB[SystemBenchmark]
        ZS[(Zustand Store)]

        PP --> BT
        PP --> TW
        BP --> SB
        BT --> ZS
        TW --> ZS
    end

    subgraph Backend["Backend — Bun + Express :3001"]
        API[REST API]
        RE[Regex Engine]
        PQ[Priority Queue]
        DP[Detection Pipeline]
        EC[Entity Cache]
        AC[Aho-Corasick]
        BM[Benchmark Harness]
        MT[Metrics]
    end

    subgraph Providers["Detection Providers"]
        T0[Tier 0 — Regex]
        T1[Tier 1 — GLiNER / Heuristic NER]
        T2[Tier 2 — Ollama LLM]
    end

    subgraph Storage["Disk Storage"]
        UL[/uploads/]
        RS[/results/]
        DS[/dataset/]
    end

    Frontend -- "HTTP REST" --> API
    API --> RE
    API --> PQ
    PQ --> DP
    DP --> EC
    EC --> AC
    DP --> T0
    DP --> T1
    DP --> T2
    API --> BM
    API --> MT
    API --> UL
    API --> RS
    BM --> DS
```

---

## Detection Pipeline

The core idea: **detect each unique entity once, apply everywhere.**

```mermaid
flowchart LR
    DOC[Document Text] --> T0

    subgraph Pipeline
        T0["Tier 0\nRegex\n<1ms"] --> MERGE
        CACHE["Cache\nPropagate\nfree"] --> MERGE
        T1["Tier 1\nGLiNER or\nHeuristic NER"] --> MERGE
        T2["Tier 2\nOllama\noptional"] --> MERGE
        MERGE[Merge + Dedup] --> OUT[Detections]
    end

    DOC --> CACHE
    DOC --> T1
    DOC --> T2
    OUT --> REMEMBER["Remember in\nEntity Cache"]

    style T0 fill:#22c55e,color:#fff
    style CACHE fill:#3b82f6,color:#fff
    style T1 fill:#f59e0b,color:#000
    style T2 fill:#6b7280,color:#fff
```

**Tier availability is graceful** — if GLiNER model isn't loaded, heuristic NER runs instead. If Ollama is down, Tier 2 is skipped. The pipeline never stalls.

---

## Request Flow — Upload to Export

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as Backend API
    participant RX as Regex Engine
    participant PQ as Priority Queue
    participant DP as Detection Pipeline
    participant EC as Entity Cache

    U->>FE: Upload batch (200 files)
    FE->>API: POST /api/upload-batch
    API->>RX: Run regex on all files (parallel)
    RX-->>API: Instant PII hits (<1ms each)
    API-->>FE: Return regex results immediately
    API->>PQ: Enqueue AI jobs (Pro first)

    loop Per document (async)
        PQ->>DP: Process next job
        DP->>EC: Propagate known entities
        DP->>DP: Run Tier 1 NER
        DP->>EC: Remember new entities
        DP-->>PQ: Complete
    end

    FE->>API: Poll /api/document/:id/status
    API-->>FE: Updated detections + phase

    U->>FE: Review & decide (Batch/Doc/Vim)
    FE->>API: POST /api/document/:id/finalize
    API-->>FE: Redacted .txt + .manifest.json
```

---

## Entity Cache & Cross-Document Propagation

```mermaid
flowchart TD
    D1[Doc 1] -->|"detect 'John Smith'"| INF[Model Inference]
    INF -->|remember| EC[(Entity Cache)]

    D2[Doc 2] -->|"Aho-Corasick scan"| EC
    EC -->|"'John Smith' found → free"| P2[Propagated Detection]

    D3[Doc 3] -->|"Aho-Corasick scan"| EC
    EC -->|"'John Smith' found → free"| P3[Propagated Detection]

    D50["Doc 4…200"] -->|"same scan"| EC
    EC -->|"free"| P50[Propagated Detections]

    style EC fill:#3b82f6,color:#fff
    style INF fill:#f59e0b,color:#000
```

> **47,251 occurrences → 3,948 unique entities → 12× fewer inferences**

---

## Priority Queue — Pro vs Free

```mermaid
flowchart LR
    subgraph Incoming
        P1[Pro Doc]
        P2[Pro Doc]
        F1[Free Doc]
        F2[Free Doc]
        F3[Free Doc]
    end

    subgraph Queue["Sorted Queue"]
        direction TB
        Q1["Pro ▸ FIFO"]
        Q2["Free ▸ FIFO"]
    end

    subgraph Workers["Worker Pool (n=2)"]
        W1[Worker 1]
        W2[Worker 2]
    end

    P1 & P2 --> Q1
    F1 & F2 & F3 --> Q2
    Q1 --> W1 & W2
    Q2 --> W1 & W2

    style Q1 fill:#8b5cf6,color:#fff
    style Q2 fill:#6b7280,color:#fff
```

Pro jobs always dequeue before free jobs. Workers process from the front.

---

## Frontend Architecture

```mermaid
graph TD
    subgraph Pages
        LAND[LandingPage]
        PROC[ProcessPage]
        BENCH[BenchmarksPage]
        PRICE[PricingPage]
    end

    subgraph Components
        BT[BatchTriage]
        TW[TriageWorkspace]
        SB[SystemBenchmark]
        AD[AdminDashboard]
        NB[Navbar]
    end

    subgraph Store["Zustand — useTriageStore"]
        DOC_STATE[documents]
        DECISIONS[decisions map]
        POLLING[status polling]
        BULK[bulk actions]
        VIM[vim mode state]
    end

    PROC --> BT
    PROC --> TW
    BENCH --> SB
    BT --> Store
    TW --> Store
    Store -- "GET/POST" --> API[Backend API]
```

### Three Triage Modes

| Mode | Input | UX |
|------|-------|----|
| **Batch** | Mouse/keyboard | Cross-doc sweep — bulk approve by type/confidence |
| **Document** | Mouse | Single file deep review with full text |
| **Vim** | Keyboard only | `j/k` navigate, `y` approve, `x` reject, `a` approve all |

---

## API Endpoints

```
POST   /api/upload-batch        Upload files → regex results + enqueue AI
GET    /api/document/:id        Full document record
GET    /api/document/:id/status Lightweight poll for progressive enrichment
POST   /api/document/:id/finalize Apply decisions → write redacted output
GET    /api/metrics             Live per-tier timing + queue state
GET    /api/benchmark           Run benchmark harness
GET    /api/health              Provider availability
GET    /api/documents           List all processed documents
```

---

## Repo Structure

```
sprintfour/
├── frontend-sprintfour/           # React SPA (Vite + Tailwind)
│   └── src/
│       ├── pages/                 # Landing, Process, Benchmarks, Pricing
│       ├── components/            # BatchTriage, TriageWorkspace, SystemBenchmark
│       └── store/useTriageStore   # Zustand — docs, decisions, polling, vim
│
├── backend-sorintfour/            # Bun + Express API
│   └── src/
│       ├── index.ts               # HTTP endpoints + finalize logic
│       └── services/
│           ├── regexEngine.ts         # Tier 0
│           ├── providers/             # Regex, GLiNER, Heuristic, Ollama
│           ├── detectionPipeline.ts   # Tier composition + merge
│           ├── entityCache.ts         # Content-addressed cache
│           ├── ahoCorasick.ts         # Multi-pattern string matcher
│           ├── priorityQueue.ts       # Pro-first scheduler
│           ├── metrics.ts             # Live timing tracker
│           └── benchmark.ts           # Benchmark harness
│
├── README.md
└── ARCHITECTURE.md
```

---

## Key Design Decisions

| Decision | Why |
|----------|-----|
| **Regex first, AI async** | Instant feedback; AI enriches progressively |
| **Entity cache + Aho-Corasick** | Detect once, propagate free — 12× fewer inferences |
| **Heuristic NER fallback** | System works with zero external models |
| **Pro-first priority queue** | Paid users get measurably faster processing |
| **Decisions not documents** | ~2000 detections collapse to ~15 class decisions |
| **Zustand over Redux** | Minimal boilerplate for a focused state shape |
| **Bun runtime** | Fast startup, native TS, good DX |
