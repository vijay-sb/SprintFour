import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

interface Redaction {
  type: string;
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

interface Document {
  documentId: string;
  priorityScore: number;
  content: string;
  suggestedRedactions: Redaction[];
}

app.get("/api/queue", (_req, res) => {
  const raw = readFileSync(join(__dirname, "mockData.json"), "utf-8");
  const data: Document[] = JSON.parse(raw);
  // Cognitive Priority Queue: highest priority first
  const sorted = data.sort((a, b) => b.priorityScore - a.priorityScore);
  res.json(sorted);
});

app.listen(PORT, () => {
  console.log(`🚀 Triage Engine Backend running on http://localhost:${PORT}`);
});
