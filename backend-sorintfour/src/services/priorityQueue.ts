// Priority queue for the AI enrichment tier.
//
// Pro requests jump the line: jobs are ordered by (tier desc, FIFO within
// tier), so every Pro document is processed before any Free document that
// is still waiting. A bounded worker pool gives throughput while keeping
// the priority ordering intact. Every job is instrumented (queue wait +
// processing time) and fed to the metrics tracker so the dashboard can
// show the Pro-vs-Free speed difference with real numbers.

import type { RegexMatch } from "./regexEngine.js";
import { detectDocument } from "./detectionPipeline.js";
import { metrics } from "./metrics.js";

export type ProcessingPhase =
  | "uploaded"
  | "regex"
  | "ai-queued"
  | "ai-processing"
  | "complete"
  | "error";

export interface ProcessedDocument {
  id: string;
  originalFilename: string;
  mimeType: string;
  text: string;
  filePath: string;
  redactions: RegexMatch[];
  phase: ProcessingPhase;
  userTier: "free" | "pro";
  uploadedAt: number;
  processedAt?: number;
  finalizedAt?: number;
  exportPath?: string;
  exportFilename?: string;
  error?: string;
  // instrumentation
  enqueuedAt?: number;
  waitMs?: number;
  processMs?: number;
  propagatedCount?: number;
  tier1Provider?: string;
}

interface QueueJob {
  documentId: string;
  tierRank: number; // 1 = pro, 0 = free
  addedAt: number;
}

class PriorityQueue {
  private documents = new Map<string, ProcessedDocument>();
  private queue: QueueJob[] = [];
  private active = 0;
  private maxConcurrency = 2;

  setDocument(doc: ProcessedDocument): void {
    this.documents.set(doc.id, doc);
  }

  getDocument(id: string): ProcessedDocument | undefined {
    return this.documents.get(id);
  }

  getAllDocuments(): ProcessedDocument[] {
    return Array.from(this.documents.values());
  }

  setConcurrency(n: number): void {
    this.maxConcurrency = Math.max(1, n);
  }

  enqueueAIJob(documentId: string, userTier: "free" | "pro"): void {
    const doc = this.documents.get(documentId);
    if (!doc) return;

    const addedAt = Date.now();
    doc.enqueuedAt = addedAt;
    this.queue.push({ documentId, tierRank: userTier === "pro" ? 1 : 0, addedAt });

    // Pro first, then FIFO within the same tier.
    this.queue.sort((a, b) => b.tierRank - a.tierRank || a.addedAt - b.addedAt);

    doc.phase = "ai-queued";
    this.documents.set(documentId, doc);

    this.pump();
  }

  private pump(): void {
    while (this.active < this.maxConcurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      void this.process(job);
    }
  }

  private async process(job: QueueJob): Promise<void> {
    const doc = this.documents.get(job.documentId);
    if (!doc) {
      this.pump();
      return;
    }

    this.active += 1;
    const startedAt = Date.now();
    const waitMs = startedAt - job.addedAt;

    try {
      doc.phase = "ai-processing";
      this.documents.set(doc.id, doc);

      // Tier 2 (Ollama) stays OFF the critical path by default — it's an
      // optional deep-verify enabled via DEEP_VERIFY=1, never a bottleneck.
      const result = await detectDocument(doc.text, {
        deepVerify: process.env.DEEP_VERIFY === "1",
        useCache: true,
      });

      doc.redactions = result.detections.sort((a, b) => a.startIndex - b.startIndex);
      doc.tier1Provider = result.tier1Provider;
      doc.propagatedCount = result.propagated;
      doc.phase = "complete";
      doc.processedAt = Date.now();
      doc.waitMs = waitMs;
      doc.processMs = doc.processedAt - startedAt;

      metrics.record({
        tier: doc.userTier,
        waitMs,
        processMs: doc.processMs,
        occurrences: result.occurrences,
        propagated: result.propagated,
      });

      console.log(
        `✅ ${doc.userTier.toUpperCase()} ${doc.id} — ${doc.redactions.length} PII ` +
          `(${result.propagated} cache-propagated, wait ${waitMs}ms, proc ${doc.processMs}ms)`
      );
    } catch (err) {
      doc.phase = "complete"; // regex results still usable
      doc.error = (err as Error).message;
      console.error(`❌ AI error for ${doc.id}:`, err);
    } finally {
      this.documents.set(doc.id, doc);
      this.active -= 1;
      this.pump();
    }
  }

  getQueueStatus(): { length: number; active: number; pro: number; free: number } {
    return {
      length: this.queue.length,
      active: this.active,
      pro: this.queue.filter((j) => j.tierRank === 1).length,
      free: this.queue.filter((j) => j.tierRank === 0).length,
    };
  }
}

export const priorityQueue = new PriorityQueue();
