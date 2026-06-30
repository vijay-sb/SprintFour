// Priority queue for AI processing jobs
// Pro users get priority multiplier — their jobs run first

import type { RegexMatch } from "./regexEngine.js";
import { runOllamaEngine, mergeResults } from "./ollamaEngine.js";

export type ProcessingPhase = "uploaded" | "regex" | "ai-queued" | "ai-processing" | "complete" | "error";

export interface ProcessedDocument {
  id: string;
  originalFilename: string;
  mimeType: string;
  text: string;
  filePath: string; // path to stored file on disk
  redactions: RegexMatch[];
  phase: ProcessingPhase;
  userTier: "free" | "pro";
  uploadedAt: number;
  processedAt?: number;
  finalizedAt?: number;
  exportPath?: string;
  exportFilename?: string;
  error?: string;
}

interface QueueJob {
  documentId: string;
  priority: number; // higher = processed first
  addedAt: number;
}

class PriorityQueue {
  private documents: Map<string, ProcessedDocument> = new Map();
  private queue: QueueJob[] = [];
  private processing = false;

  // Store a document
  setDocument(doc: ProcessedDocument): void {
    this.documents.set(doc.id, doc);
  }

  // Get a document
  getDocument(id: string): ProcessedDocument | undefined {
    return this.documents.get(id);
  }

  // Get all documents
  getAllDocuments(): ProcessedDocument[] {
    return Array.from(this.documents.values());
  }

  // Add AI processing job to queue
  enqueueAIJob(documentId: string, userTier: "free" | "pro"): void {
    const doc = this.documents.get(documentId);
    if (!doc) return;

    // Pro users get 2x priority multiplier
    const basePriority = Date.now();
    const priority = userTier === "pro" ? basePriority * 2 : basePriority;

    this.queue.push({
      documentId,
      priority,
      addedAt: Date.now(),
    });

    // Sort: highest priority first
    this.queue.sort((a, b) => b.priority - a.priority);

    // Update phase
    doc.phase = "ai-queued";
    this.documents.set(documentId, doc);

    // Start processing if not already running
    this.processNext();
  }

  // Process next job in queue
  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const job = this.queue.shift()!;
    const doc = this.documents.get(job.documentId);

    if (!doc) {
      this.processing = false;
      this.processNext();
      return;
    }

    try {
      doc.phase = "ai-processing";
      this.documents.set(doc.id, doc);

      console.log(`🤖 AI processing: ${doc.id} (${doc.userTier} user)`);
      const aiResults = await runOllamaEngine(doc.text);

      // Merge AI results with existing regex results
      doc.redactions = mergeResults(doc.redactions, aiResults);
      doc.phase = "complete";
      doc.processedAt = Date.now();

      console.log(`✅ AI complete: ${doc.id} — ${doc.redactions.length} total redactions`);
    } catch (err) {
      console.error(`❌ AI error for ${doc.id}:`, err);
      doc.phase = "complete"; // Still mark complete — regex results are available
      doc.error = (err as Error).message;
    }

    this.documents.set(doc.id, doc);
    this.processing = false;

    // Process next in queue
    this.processNext();
  }

  // Get queue status
  getQueueStatus(): { length: number; processing: boolean; jobs: QueueJob[] } {
    return {
      length: this.queue.length,
      processing: this.processing,
      jobs: [...this.queue],
    };
  }
}

// Singleton instance
export const priorityQueue = new PriorityQueue();
