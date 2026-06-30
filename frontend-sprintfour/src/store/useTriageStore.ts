import { create } from "zustand";

const API_BASE = "http://localhost:3001";
const AUTO_APPROVE_THRESHOLD = 90;

export interface Redaction {
  type: string;
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
  status: "pending" | "approved" | "rejected";
  source?: "system" | "manual";
}

export interface UploadedDocument {
  id: string;
  filename: string;
  mimeType: string;
  text: string;
  filePath: string;
  redactions: Redaction[];
  phase: "uploaded" | "regex" | "ai-queued" | "ai-processing" | "complete" | "error";
  userTier: "free" | "pro";
  uploadedAt: number;
  processedAt?: number;
  finalizedAt?: number;
  exportPath?: string;
  exportFilename?: string;
  requiresReview: boolean;
  pendingReviewCount: number;
  autoApprovedCount: number;
}

export interface Metrics {
  processed: number;
  totalApproved: number;
  totalRejected: number;
  autoApproved: number;
  manualOverrides: number;
  autoFinalizedDocs: number;
  startTime: number;
  totalTimeSpent: number;
  documentStartTime: number;
}

interface ApiDocument {
  id: string;
  filename: string;
  mimeType: string;
  text: string;
  filePath: string;
  redactions: Array<Omit<Redaction, "status">>;
  phase: UploadedDocument["phase"];
  userTier: UploadedDocument["userTier"];
  uploadedAt: number;
  processedAt?: number;
  finalizedAt?: number;
  exportPath?: string;
  exportFilename?: string;
}

interface ApiDocumentStatus {
  id: string;
  phase: UploadedDocument["phase"];
  redactions: Array<Omit<Redaction, "status">>;
  finalizedAt?: number;
  exportPath?: string;
  exportFilename?: string;
}

interface TriageState {
  userTier: "free" | "pro";
  setUserTier: (tier: "free" | "pro") => void;
  uploadedQueue: UploadedDocument[];
  currentDocId: string | null;
  currentDocIndex: number;
  currentRedactionIndex: number;
  uploadLoading: boolean;
  uploadError: string | null;
  flashEffect: string | null;
  triageMode: "normal" | "vim";
  metrics: Metrics;
  batchUpload: (files: File[]) => Promise<void>;
  pollQueueStatus: () => void;
  clearQueue: () => void;
  setTriageMode: (mode: "normal" | "vim") => void;
  approveRedaction: () => void;
  approveAllRedactions: () => void;
  rejectRedaction: () => void;
  addManualRedaction: (value: string, type?: string) => { ok: boolean; message?: string };
  navigateRedaction: (direction: "next" | "prev") => void;
  finalizeDocument: () => Promise<void>;
  clearFlash: () => void;
  setCurrentDocIndex: (index: number) => void;
}

function getStoredTier(): "free" | "pro" {
  try {
    const stored = localStorage.getItem("conseal_tier");
    return stored === "pro" ? "pro" : "free";
  } catch {
    return "free";
  }
}

function redactionKey(redaction: Pick<Redaction, "startIndex" | "endIndex">) {
  return `${redaction.startIndex}:${redaction.endIndex}`;
}

function deriveReviewState(redactions: Redaction[]) {
  const pendingReviewCount = redactions.filter(
    (redaction) => redaction.status === "pending"
  ).length;
  const autoApprovedCount = redactions.filter(
    (redaction) =>
      redaction.status === "approved" && redaction.confidence >= AUTO_APPROVE_THRESHOLD
  ).length;

  return {
    requiresReview: pendingReviewCount > 0,
    pendingReviewCount,
    autoApprovedCount,
  };
}

function overlapsExisting(
  redactions: Redaction[],
  startIndex: number,
  endIndex: number
) {
  return redactions.some(
    (redaction) =>
      startIndex < redaction.endIndex && endIndex > redaction.startIndex
  );
}

function mergeRedactions(
  incoming: Array<Omit<Redaction, "status">>,
  existing?: UploadedDocument
): Redaction[] {
  const existingStatuses = new Map(
    (existing?.redactions ?? []).map((redaction) => [redactionKey(redaction), redaction.status])
  );

  return incoming.map((redaction) => {
    const preserved = existingStatuses.get(redactionKey(redaction));
    return {
      ...redaction,
      status:
        preserved && preserved !== "pending"
          ? preserved
          : redaction.confidence >= AUTO_APPROVE_THRESHOLD
            ? "approved"
            : "pending",
    };
  });
}

function normalizeDocument(apiDoc: ApiDocument, existing?: UploadedDocument): UploadedDocument {
  const redactions = mergeRedactions(apiDoc.redactions, existing);
  return {
    id: apiDoc.id,
    filename: apiDoc.filename,
    mimeType: apiDoc.mimeType,
    text: apiDoc.text,
    filePath: apiDoc.filePath,
    redactions,
    phase: apiDoc.phase,
    userTier: apiDoc.userTier,
    uploadedAt: apiDoc.uploadedAt,
    processedAt: apiDoc.processedAt,
    finalizedAt: apiDoc.finalizedAt,
    exportPath: apiDoc.exportPath,
    exportFilename: apiDoc.exportFilename,
    ...deriveReviewState(redactions),
  };
}

function mergeDocumentStatus(
  status: ApiDocumentStatus,
  existing: UploadedDocument
): UploadedDocument {
  const redactions = mergeRedactions(status.redactions, existing);
  const manualOnlyRedactions = existing.redactions.filter(
    (redaction) =>
      redaction.source === "manual" &&
      !redactions.some(
        (existingRedaction) =>
          existingRedaction.startIndex === redaction.startIndex &&
          existingRedaction.endIndex === redaction.endIndex
      )
  );
  const mergedRedactions = [...redactions, ...manualOnlyRedactions].sort(
    (a, b) => a.startIndex - b.startIndex
  );
  return {
    ...existing,
    redactions: mergedRedactions,
    phase: status.phase,
    finalizedAt: status.finalizedAt ?? existing.finalizedAt,
    exportPath: status.exportPath ?? existing.exportPath,
    exportFilename: status.exportFilename ?? existing.exportFilename,
    ...deriveReviewState(mergedRedactions),
  };
}

function findPreferredDocIndex(queue: UploadedDocument[]) {
  const manualIndex = queue.findIndex(
    (doc) => !doc.finalizedAt && doc.requiresReview
  );
  if (manualIndex !== -1) return manualIndex;

  const pendingAutoIndex = queue.findIndex((doc) => !doc.finalizedAt);
  return pendingAutoIndex === -1 ? 0 : pendingAutoIndex;
}

function getSelectedDocIndex(
  queue: UploadedDocument[],
  selectedDocId: string | null
) {
  if (selectedDocId) {
    const explicitIndex = queue.findIndex((doc) => doc.id === selectedDocId);
    if (explicitIndex !== -1) return explicitIndex;
  }

  return findPreferredDocIndex(queue);
}

function decisionsForDocument(doc: UploadedDocument) {
  return doc.redactions.map((redaction) => ({
    startIndex: redaction.startIndex,
    endIndex: redaction.endIndex,
    status: redaction.status === "pending" ? "approved" : redaction.status,
  }));
}

function manualRedactionsForDocument(doc: UploadedDocument) {
  return doc.redactions
    .filter((redaction) => redaction.source === "manual")
    .map(({ type, value, startIndex, endIndex, confidence }) => ({
      type,
      value,
      startIndex,
      endIndex,
      confidence,
    }));
}

export const useTriageStore = create<TriageState>((set, get) => {
  let pollingInterval: number | null = null;
  let autoFinalizeRunning = false;

  const syncSelection = (
    queue: UploadedDocument[],
    selectedDocId: string | null,
    currentRedactionIndex = 0
  ) => {
    const currentDocIndex = getSelectedDocIndex(queue, selectedDocId);
    const currentDoc = queue[currentDocIndex];
    const maxIndex = currentDoc ? Math.max(0, currentDoc.redactions.length - 1) : 0;

    return {
      currentDocId: currentDoc?.id ?? null,
      currentDocIndex,
      currentRedactionIndex: Math.min(currentRedactionIndex, maxIndex),
    };
  };

  const maybeAutoFinalizeDocuments = async () => {
    if (autoFinalizeRunning) return;

    const candidates = get().uploadedQueue.filter(
      (doc) => !doc.finalizedAt && doc.phase === "complete" && !doc.requiresReview
    );

    if (candidates.length === 0) return;
    autoFinalizeRunning = true;

    for (const doc of candidates) {
      try {
        const res = await fetch(`${API_BASE}/api/document/${doc.id}/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decisions: decisionsForDocument(doc),
            manualRedactions: manualRedactionsForDocument(doc),
          }),
        });

        if (!res.ok) continue;
        const data = await res.json();

        set((state) => {
          const queue = state.uploadedQueue.map((existing) =>
            existing.id === doc.id
              ? {
                  ...existing,
                  finalizedAt: data.finalizedAt ?? Date.now(),
                  exportPath: data.exportPath,
                  exportFilename: data.exportFilename,
                }
              : existing
          );

          return {
            uploadedQueue: queue,
            ...syncSelection(queue, state.currentDocId, state.currentRedactionIndex),
            metrics: {
              ...state.metrics,
              processed: state.metrics.processed + 1,
              autoFinalizedDocs: state.metrics.autoFinalizedDocs + 1,
            },
          };
        });
      } catch {
        // Leave document in queue if export fails.
      }
    }

    autoFinalizeRunning = false;
  };

  const startPolling = () => {
    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = window.setInterval(async () => {
      const state = get();
      const pendingDocs = state.uploadedQueue.filter(
        (doc) => !doc.finalizedAt && doc.phase !== "complete" && doc.phase !== "error"
      );

      if (pendingDocs.length === 0) {
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = null;
        await maybeAutoFinalizeDocuments();
        return;
      }

      for (const doc of pendingDocs) {
        try {
          const res = await fetch(`${API_BASE}/api/document/${doc.id}/status`);
          if (!res.ok) continue;

          const data = (await res.json()) as ApiDocumentStatus;
          set((prev) => {
            const queue = prev.uploadedQueue.map((existing) =>
              existing.id === doc.id ? mergeDocumentStatus(data, existing) : existing
            );
            return {
              uploadedQueue: queue,
              ...syncSelection(queue, prev.currentDocId, prev.currentRedactionIndex),
            };
          });
        } catch {
          // Ignore polling failures.
        }
      }

      await maybeAutoFinalizeDocuments();
    }, 2000);
  };

  return {
    userTier: getStoredTier(),
    setUserTier: (tier) => {
      localStorage.setItem("conseal_tier", tier);
      set({ userTier: tier });
    },

    uploadedQueue: [],
    currentDocId: null,
    currentDocIndex: 0,
    currentRedactionIndex: 0,
    uploadLoading: false,
    uploadError: null,
    flashEffect: null,
    triageMode: "normal",

    metrics: {
      processed: 0,
      totalApproved: 0,
      totalRejected: 0,
      autoApproved: 0,
      manualOverrides: 0,
      autoFinalizedDocs: 0,
      startTime: Date.now(),
      totalTimeSpent: 0,
      documentStartTime: Date.now(),
    },

    batchUpload: async (files: File[]) => {
      set({ uploadLoading: true, uploadError: null });

      try {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("userTier", get().userTier);

        const res = await fetch(`${API_BASE}/api/upload-batch`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `Upload failed: ${res.status}`);
        }

        const data = await res.json();
        const docs = await Promise.all(
          data.documents.map(async (item: { documentId: string }) => {
            const docRes = await fetch(`${API_BASE}/api/document/${item.documentId}`);
            if (!docRes.ok) {
              throw new Error(`Could not fetch document ${item.documentId}`);
            }
            return (await docRes.json()) as ApiDocument;
          })
        );

        set((state) => {
          const existing = new Map(state.uploadedQueue.map((doc) => [doc.id, doc]));
          const appended = docs.map((doc) => normalizeDocument(doc, existing.get(doc.id)));
          const queue = [...state.uploadedQueue, ...appended];

          const autoApproved = queue.reduce(
            (sum, doc) => sum + doc.autoApprovedCount,
            0
          );

          return {
            uploadedQueue: queue,
            uploadLoading: false,
            ...syncSelection(
              queue,
              state.currentDocId ?? queue[getSelectedDocIndex(queue, null)]?.id ?? null
            ),
            metrics: {
              ...state.metrics,
              autoApproved,
              documentStartTime: Date.now(),
            },
          };
        });

        startPolling();
        await maybeAutoFinalizeDocuments();
      } catch (err) {
        set({ uploadLoading: false, uploadError: (err as Error).message });
      }
    },

    pollQueueStatus: () => {
      startPolling();
    },

    clearQueue: () => {
      if (pollingInterval) clearInterval(pollingInterval);
      pollingInterval = null;
      set({
        uploadedQueue: [],
        currentDocId: null,
        uploadError: null,
        currentDocIndex: 0,
        currentRedactionIndex: 0,
      });
    },

    setTriageMode: (mode) => set({ triageMode: mode }),

    approveRedaction: () => {
      const state = get();
      const doc = state.uploadedQueue[state.currentDocIndex];
      const redaction = doc?.redactions[state.currentRedactionIndex];
      if (!doc || !redaction) return;

      const wasAutoApproved = redaction.status === "approved" && redaction.confidence >= AUTO_APPROVE_THRESHOLD;
      const nextRedactions = doc.redactions.map((item, index) =>
        index === state.currentRedactionIndex ? { ...item, status: "approved" as const } : item
      );
      const updatedDoc = { ...doc, redactions: nextRedactions, ...deriveReviewState(nextRedactions) };

      set({
        uploadedQueue: state.uploadedQueue.map((item) => (item.id === doc.id ? updatedDoc : item)),
        currentDocId: doc.id,
        flashEffect: "approve",
        metrics: {
          ...state.metrics,
          totalApproved: wasAutoApproved ? state.metrics.totalApproved : state.metrics.totalApproved + 1,
        },
      });
    },

    approveAllRedactions: () => {
      const state = get();
      const doc = state.uploadedQueue[state.currentDocIndex];
      if (!doc) return;

      const pendingCount = doc.redactions.filter((redaction) => redaction.status === "pending").length;
      if (pendingCount === 0) return;

      const nextRedactions = doc.redactions.map((redaction) =>
        redaction.status === "pending"
          ? { ...redaction, status: "approved" as const }
          : redaction
      );
      const updatedDoc = { ...doc, redactions: nextRedactions, ...deriveReviewState(nextRedactions) };

      set({
        uploadedQueue: state.uploadedQueue.map((item) => (item.id === doc.id ? updatedDoc : item)),
        currentDocId: doc.id,
        flashEffect: "approve",
        metrics: {
          ...state.metrics,
          totalApproved: state.metrics.totalApproved + pendingCount,
        },
      });
    },

    rejectRedaction: () => {
      const state = get();
      const doc = state.uploadedQueue[state.currentDocIndex];
      const redaction = doc?.redactions[state.currentRedactionIndex];
      if (!doc || !redaction) return;

      const wasAutoApproved = redaction.status === "approved" && redaction.confidence >= AUTO_APPROVE_THRESHOLD;
      const nextRedactions = doc.redactions.map((item, index) =>
        index === state.currentRedactionIndex ? { ...item, status: "rejected" as const } : item
      );
      const updatedDoc = { ...doc, redactions: nextRedactions, ...deriveReviewState(nextRedactions) };

      set({
        uploadedQueue: state.uploadedQueue.map((item) => (item.id === doc.id ? updatedDoc : item)),
        currentDocId: doc.id,
        flashEffect: "reject",
        metrics: {
          ...state.metrics,
          totalRejected: state.metrics.totalRejected + 1,
          manualOverrides: wasAutoApproved
            ? state.metrics.manualOverrides + 1
            : state.metrics.manualOverrides,
          autoApproved: wasAutoApproved
            ? Math.max(0, state.metrics.autoApproved - 1)
            : state.metrics.autoApproved,
        },
      });
    },

    addManualRedaction: (value, type = "MANUAL_FLAG") => {
      const state = get();
      const doc = state.uploadedQueue[state.currentDocIndex];
      const phrase = value.trim();
      if (!doc || phrase.length === 0) {
        return { ok: false, message: "Enter text to flag." };
      }

      let searchIndex = doc.text.indexOf(phrase);
      while (searchIndex !== -1) {
        const endIndex = searchIndex + phrase.length;
        if (!overlapsExisting(doc.redactions, searchIndex, endIndex)) {
          const manualRedaction: Redaction = {
            type,
            value: phrase,
            startIndex: searchIndex,
            endIndex,
            confidence: 100,
            status: "pending",
            source: "manual",
          };

          const nextRedactions = [...doc.redactions, manualRedaction].sort(
            (a, b) => a.startIndex - b.startIndex
          );
          const updatedDoc = {
            ...doc,
            redactions: nextRedactions,
            ...deriveReviewState(nextRedactions),
          };
          const currentRedactionIndex = nextRedactions.findIndex(
            (redaction) =>
              redaction.startIndex === manualRedaction.startIndex &&
              redaction.endIndex === manualRedaction.endIndex
          );

          set({
            uploadedQueue: state.uploadedQueue.map((item) => (item.id === doc.id ? updatedDoc : item)),
            currentDocId: doc.id,
            currentRedactionIndex,
          });
          return { ok: true };
        }
        searchIndex = doc.text.indexOf(phrase, searchIndex + phrase.length);
      }

      return { ok: false, message: "Phrase not found or already flagged everywhere it appears." };
    },

    navigateRedaction: (direction) => {
      const doc = get().uploadedQueue[get().currentDocIndex];
      if (!doc || doc.redactions.length === 0) return;

      const maxIndex = doc.redactions.length - 1;
      const nextIndex =
        direction === "next"
          ? Math.min(get().currentRedactionIndex + 1, maxIndex)
          : Math.max(get().currentRedactionIndex - 1, 0);

      set({
        currentDocId: doc.id,
        currentRedactionIndex: nextIndex,
        flashEffect: direction === "next" ? "nav-down" : "nav-up",
      });
    },

    finalizeDocument: async () => {
      const state = get();
      const doc = state.uploadedQueue[state.currentDocIndex];
      if (!doc || doc.finalizedAt) return;

      const timeOnDoc = Date.now() - state.metrics.documentStartTime;
      const res = await fetch(`${API_BASE}/api/document/${doc.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisions: decisionsForDocument(doc),
          manualRedactions: manualRedactionsForDocument(doc),
        }),
      });

      if (!res.ok) {
        throw new Error(`Finalize failed for ${doc.filename}`);
      }

      const data = await res.json();

      set((prev) => {
        const queue = prev.uploadedQueue.map((item) =>
          item.id === doc.id
            ? {
                ...item,
                finalizedAt: data.finalizedAt ?? Date.now(),
                exportPath: data.exportPath,
                exportFilename: data.exportFilename,
                requiresReview: false,
                pendingReviewCount: 0,
              }
            : item
        );

        return {
          uploadedQueue: queue,
          ...syncSelection(queue, doc.id),
          flashEffect: "finalize",
          metrics: {
            ...prev.metrics,
            processed: prev.metrics.processed + 1,
            totalTimeSpent: prev.metrics.totalTimeSpent + timeOnDoc,
            documentStartTime: Date.now(),
          },
        };
      });

      await maybeAutoFinalizeDocuments();
    },

    setCurrentDocIndex: (index) => {
      if (index < 0 || index >= get().uploadedQueue.length) return;
      const doc = get().uploadedQueue[index];
      set({
        currentDocId: doc?.id ?? null,
        currentDocIndex: index,
        currentRedactionIndex: 0,
        metrics: {
          ...get().metrics,
          documentStartTime: Date.now(),
        },
      });
    },

    clearFlash: () => set({ flashEffect: null }),
  };
});
