import express from "express";
import cors from "cors";
import multer from "multer";
import { readFileSync, mkdirSync, existsSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, extname, basename } from "path";
import { v4 as uuidv4 } from "uuid";
import { runRegexEngine } from "./services/regexEngine.js";
import { priorityQueue } from "./services/priorityQueue.js";
import type { ProcessedDocument } from "./services/priorityQueue.js";
import { resolveProviders, providerSummary } from "./services/detectionPipeline.js";
import { metrics } from "./services/metrics.js";
import { runBenchmark, type BenchmarkResult } from "./services/benchmark.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const AUTO_APPROVE_THRESHOLD = 90;

// Ensure uploads directory exists
const UPLOADS_DIR = join(__dirname, "..", "uploads");
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

const RESULTS_DIR = join(__dirname, "..", "results");
if (!existsSync(RESULTS_DIR)) {
  mkdirSync(RESULTS_DIR, { recursive: true });
}

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "text/plain",
      "text/html",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith(".txt")) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${file.mimetype}`));
    }
  },
});

// Serve uploaded files statically (for PDF viewer)
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/results", express.static(RESULTS_DIR));

type FinalizeDecision = {
  startIndex: number;
  endIndex: number;
  status: "approved" | "rejected";
};

type ManualRedaction = {
  type: string;
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
};

function getReviewStats(redactions: ProcessedDocument["redactions"]) {
  const manualReviewCount = redactions.filter(
    (redaction) => redaction.confidence < AUTO_APPROVE_THRESHOLD
  ).length;

  return {
    requiresReview: manualReviewCount > 0,
    autoApprovedCount: redactions.length - manualReviewCount,
    manualReviewCount,
  };
}

function applyDecisions(
  text: string,
  redactions: ProcessedDocument["redactions"],
  decisions: FinalizeDecision[]
) {
  const decisionMap = new Map(
    decisions.map((decision) => [
      `${decision.startIndex}:${decision.endIndex}`,
      decision.status,
    ])
  );

  const resolved = redactions.map((redaction) => ({
    ...redaction,
    status:
      decisionMap.get(`${redaction.startIndex}:${redaction.endIndex}`) ??
      (redaction.confidence >= AUTO_APPROVE_THRESHOLD ? "approved" : "rejected"),
  }));

  const approved = resolved
    .filter((redaction) => redaction.status === "approved")
    .sort((a, b) => b.startIndex - a.startIndex);

  let sanitizedText = text;
  for (const redaction of approved) {
    sanitizedText =
      sanitizedText.slice(0, redaction.startIndex) +
      `[REDACTED:${redaction.type}]` +
      sanitizedText.slice(redaction.endIndex);
  }

  return { resolved, sanitizedText };
}

function mergeManualRedactions(
  existing: ProcessedDocument["redactions"],
  manualRedactions: ManualRedaction[] = []
) {
  const merged = [...existing];

  for (const redaction of manualRedactions) {
    const alreadyExists = merged.some(
      (existingRedaction) =>
        existingRedaction.startIndex === redaction.startIndex &&
        existingRedaction.endIndex === redaction.endIndex
    );

    if (!alreadyExists) {
      merged.push(redaction);
    }
  }

  return merged.sort((a, b) => a.startIndex - b.startIndex);
}

function exportDocument(
  doc: ProcessedDocument,
  decisions: FinalizeDecision[],
  manualRedactions: ManualRedaction[] = []
) {
  const exportableRedactions = mergeManualRedactions(doc.redactions, manualRedactions);
  const { resolved, sanitizedText } = applyDecisions(doc.text, exportableRedactions, decisions);
  const safeBaseName = basename(doc.originalFilename, extname(doc.originalFilename))
    .replace(/[^a-z0-9._-]+/gi, "_")
    .replace(/^_+|_+$/g, "") || doc.id;
  const exportFilename = `${safeBaseName}.${doc.id}.redacted.txt`;
  const exportManifestName = `${safeBaseName}.${doc.id}.manifest.json`;
  const exportFilePath = join(RESULTS_DIR, exportFilename);
  const exportManifestPath = join(RESULTS_DIR, exportManifestName);

  writeFileSync(exportFilePath, sanitizedText, "utf-8");
  writeFileSync(
    exportManifestPath,
    JSON.stringify(
      {
        documentId: doc.id,
        originalFilename: doc.originalFilename,
        exportedAt: new Date().toISOString(),
        redactionCount: resolved.length,
        approvedCount: resolved.filter((redaction) => redaction.status === "approved").length,
        rejectedCount: resolved.filter((redaction) => redaction.status === "rejected").length,
        redactions: resolved,
      },
      null,
      2
    ),
    "utf-8"
  );

  doc.redactions = resolved;
  doc.finalizedAt = Date.now();
  doc.exportFilename = exportFilename;
  doc.exportPath = `/results/${exportFilename}`;

  return {
    exportPath: doc.exportPath,
    exportFilename,
  };
}

// ─── ENDPOINTS ───

// Health check
app.get("/api/health", async (_req, res) => {
  await resolveProviders(true);
  res.json({
    status: "ok",
    providers: providerSummary(),
    queueStatus: priorityQueue.getQueueStatus(),
  });
});

// Live pipeline metrics (powers the dashboard / pro-vs-free comparison)
app.get("/api/metrics", (_req, res) => {
  res.json({
    ...metrics.snapshot(),
    providers: providerSummary(),
    queueStatus: priorityQueue.getQueueStatus(),
  });
});

// Benchmark — speed / efficiency / priority numbers for the pitch.
let cachedBenchmark: (BenchmarkResult & { generatedAt: string }) | null = null;
app.get("/api/benchmark", async (req, res) => {
  try {
    const refresh = req.query.refresh === "1" || req.query.refresh === "true";
    const sampleSize = req.query.sample ? Number(req.query.sample) : undefined;
    if (!cachedBenchmark || refresh || sampleSize) {
      const result = await runBenchmark({
        datasetDir: join(__dirname, "..", "dataset"),
        sampleSize,
        proRatio: 0.3,
        concurrency: 2,
      });
      cachedBenchmark = { ...result, generatedAt: new Date().toISOString() };
    }
    res.json(cachedBenchmark);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Upload & process document
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const userTier = (req.body?.userTier as "free" | "pro") || "free";
    const docId = uuidv4();
    const filePath = req.file.path;

    // Extract text based on file type
    let text = "";
    if (req.file.mimetype === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const buffer = readFileSync(filePath);
      const parser = new PDFParse({ data: buffer });
      const pdfData = await parser.getText();
      text = pdfData.text;
    } else {
      // Text files
      text = readFileSync(filePath, "utf-8");
    }

    if (!text.trim()) {
      res.status(400).json({ error: "Could not extract text from file" });
      return;
    }

    // Phase 1: Run regex engine immediately (< 1ms)
    const regexResults = runRegexEngine(text);

    // Create document record
    const doc: ProcessedDocument = {
      id: docId,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      text,
      filePath: `/uploads/${req.file.filename}`,
      redactions: regexResults,
      phase: "regex",
      userTier,
      uploadedAt: Date.now(),
    };

    priorityQueue.setDocument(doc);

    // Phase 2: Queue AI enrichment (async, non-blocking). The AI tier is
    // always available (GLiNER or heuristic NER), so we always enqueue —
    // Ollama being down no longer skips enrichment.
    priorityQueue.enqueueAIJob(docId, userTier);

    // Return immediately with regex results
    res.json({
      documentId: docId,
      filename: req.file.originalname,
      filePath: doc.filePath,
      textLength: text.length,
      phase: doc.phase,
      redactions: regexResults,
      redactionCount: regexResults.length,
      ...getReviewStats(regexResults),
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// Bulk upload
app.post("/api/upload-batch", upload.array("files", 500), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    const userTier = (req.body?.userTier as "free" | "pro") || "free";
    const results: Array<{
      documentId: string;
      filename: string;
      phase: ProcessedDocument["phase"];
      requiresReview: boolean;
      autoApprovedCount: number;
      manualReviewCount: number;
    }> = [];

    // Process all files in parallel for the initial regex pass
    await Promise.all(
      files.map(async (file) => {
        const docId = uuidv4();
        const filePath = file.path;
        let text = "";

        if (file.mimetype === "application/pdf") {
          const { PDFParse } = await import("pdf-parse");
          const buffer = readFileSync(filePath);
          const parser = new PDFParse({ data: buffer });
          const pdfData = await parser.getText();
          text = pdfData.text;
        } else {
          text = readFileSync(filePath, "utf-8");
        }

        const regexResults = runRegexEngine(text);

        const doc: ProcessedDocument = {
          id: docId,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          text,
          filePath: `/uploads/${file.filename}`,
          redactions: regexResults,
          phase: "regex",
          userTier,
          uploadedAt: Date.now(),
        };

        priorityQueue.setDocument(doc);
        priorityQueue.enqueueAIJob(docId, userTier);

        results.push({
          documentId: docId,
          filename: file.originalname,
          phase: doc.phase,
          ...getReviewStats(regexResults),
        });
      })
    );

    res.json({
      success: true,
      count: results.length,
      documents: results,
    });
  } catch (err) {
    console.error("Batch upload error:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get document with current results
app.get("/api/document/:id", (req, res) => {
  const doc = priorityQueue.getDocument(req.params.id!);
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.json({
    id: doc.id,
    filename: doc.originalFilename,
    mimeType: doc.mimeType,
    text: doc.text,
    filePath: doc.filePath,
    redactions: doc.redactions,
    phase: doc.phase,
    userTier: doc.userTier,
    uploadedAt: doc.uploadedAt,
    processedAt: doc.processedAt,
    finalizedAt: doc.finalizedAt,
    exportPath: doc.exportPath,
    exportFilename: doc.exportFilename,
    ...getReviewStats(doc.redactions),
    error: doc.error,
  });
});

// Poll processing status (lightweight)
app.get("/api/document/:id/status", (req, res) => {
  const doc = priorityQueue.getDocument(req.params.id!);
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.json({
    id: doc.id,
    phase: doc.phase,
    redactionCount: doc.redactions.length,
    redactions: doc.redactions,
    finalizedAt: doc.finalizedAt,
    exportPath: doc.exportPath,
    exportFilename: doc.exportFilename,
    ...getReviewStats(doc.redactions),
    queueStatus: priorityQueue.getQueueStatus(),
  });
});

// Finalize document with redaction decisions
app.post("/api/document/:id/finalize", (req, res) => {
  const doc = priorityQueue.getDocument(req.params.id!);
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const { decisions } = req.body as {
    decisions: Array<{
      startIndex: number;
      endIndex: number;
      status: "approved" | "rejected";
    }>;
    manualRedactions?: ManualRedaction[];
  };

  const normalizedDecisions: FinalizeDecision[] = Array.isArray(decisions)
    ? decisions
    : doc.redactions.map((redaction) => ({
        startIndex: redaction.startIndex,
        endIndex: redaction.endIndex,
        status:
          redaction.confidence >= AUTO_APPROVE_THRESHOLD ? "approved" : "rejected",
      }));

  const exportInfo = exportDocument(doc, normalizedDecisions, req.body.manualRedactions);
  priorityQueue.setDocument(doc);

  res.json({
    success: true,
    documentId: doc.id,
    finalizedAt: doc.finalizedAt,
    exportPath: exportInfo.exportPath,
    exportFilename: exportInfo.exportFilename,
  });
});

// Keep legacy queue endpoint for demo/mock data
app.get("/api/queue", (_req, res) => {
  try {
    const raw = readFileSync(join(__dirname, "mockData.json"), "utf-8");
    const data = JSON.parse(raw);
    const sorted = data.sort(
      (a: { priorityScore: number }, b: { priorityScore: number }) =>
        b.priorityScore - a.priorityScore
    );
    res.json(sorted);
  } catch {
    res.json([]);
  }
});

// Get all processed documents
app.get("/api/documents", (_req, res) => {
  const docs = priorityQueue.getAllDocuments();
  res.json(
    docs.map((d) => ({
      id: d.id,
      filename: d.originalFilename,
      phase: d.phase,
      redactionCount: d.redactions.length,
      userTier: d.userTier,
      uploadedAt: d.uploadedAt,
      processedAt: d.processedAt,
    }))
  );
});

app.listen(PORT, () => {
  console.log(`🚀 Conseal Triage Engine Backend running on http://localhost:${PORT}`);
  console.log(`📂 Uploads directory: ${UPLOADS_DIR}`);
  resolveProviders(true).then(() => {
    const p = providerSummary();
    console.log(
      `🧩 Detection tiers — tier0: ${p.tier0} · tier1: ${p.tier1} · tier2: ${p.tier2}`
    );
    console.log(
      p.gliner
        ? "🧠 GLiNER local NER online"
        : p.ollama
          ? "🤖 Ollama online (deep-verify tier)"
          : "✅ AI tier running on heuristic NER (no external model needed)"
    );
  });
});
