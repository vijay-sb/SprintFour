import express from "express";
import cors from "cors";
import multer from "multer";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, extname } from "path";
import { v4 as uuidv4 } from "uuid";
import { runRegexEngine } from "./services/regexEngine.js";
import { isOllamaAvailable } from "./services/ollamaEngine.js";
import { priorityQueue } from "./services/priorityQueue.js";
import type { ProcessedDocument } from "./services/priorityQueue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// Ensure uploads directory exists
const UPLOADS_DIR = join(__dirname, "..", "uploads");
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
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

// ─── ENDPOINTS ───

// Health check
app.get("/api/health", async (_req, res) => {
  const ollamaUp = await isOllamaAvailable();
  res.json({
    status: "ok",
    ollama: ollamaUp,
    queueStatus: priorityQueue.getQueueStatus(),
  });
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
      // Handle different module structures between Node/Bun and CJS/ESM
      const pdfModule = await import("pdf-parse");
      const parseFunc = (pdfModule as any).PDFParse || (pdfModule as any).default || pdfModule;
      const buffer = readFileSync(filePath);
      const pdfData = await parseFunc(buffer);
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

    // Phase 2: Queue AI processing (async, non-blocking)
    const ollamaUp = await isOllamaAvailable();
    if (ollamaUp) {
      priorityQueue.enqueueAIJob(docId, userTier);
    } else {
      // If Ollama is not available, mark as complete with regex-only results
      doc.phase = "complete";
      priorityQueue.setDocument(doc);
      console.log("⚠️ Ollama not available — using regex-only results");
    }

    // Return immediately with regex results
    res.json({
      documentId: docId,
      filename: req.file.originalname,
      filePath: doc.filePath,
      textLength: text.length,
      phase: doc.phase,
      redactions: regexResults,
      redactionCount: regexResults.length,
    });
  } catch (err) {
    console.error("Upload error:", err);
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
  };

  // Apply decisions to redactions
  if (decisions && Array.isArray(decisions)) {
    for (const decision of decisions) {
      const redaction = doc.redactions.find(
        (r) => r.startIndex === decision.startIndex && r.endIndex === decision.endIndex
      );
      if (redaction) {
        (redaction as typeof redaction & { status: string }).status = decision.status;
      }
    }
    priorityQueue.setDocument(doc);
  }

  res.json({ success: true, documentId: doc.id });
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
  isOllamaAvailable().then((up) =>
    console.log(up ? "🤖 Ollama connected" : "⚠️ Ollama not available — regex-only mode")
  );
});
