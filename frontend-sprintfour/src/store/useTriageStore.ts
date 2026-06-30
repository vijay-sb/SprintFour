import { create } from "zustand";

const API_BASE = "http://localhost:3001";

export interface Redaction {
  type: string;
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
  status: "pending" | "approved" | "rejected";
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
}

export interface Metrics {
  processed: number;
  totalApproved: number;
  totalRejected: number;
  autoApproved: number;
  manualOverrides: number;
  startTime: number;
  totalTimeSpent: number;
  documentStartTime: number;
}

interface TriageState {
  // User
  userTier: "free" | "pro";
  setUserTier: (tier: "free" | "pro") => void;

  // Queue mode (Bulk Upload)
  uploadedQueue: UploadedDocument[];
  currentDocIndex: number;
  currentRedactionIndex: number;
  uploadLoading: boolean;
  uploadError: string | null;
  flashEffect: string | null;

  batchUpload: (files: File[]) => Promise<void>;
  pollQueueStatus: () => void;
  clearQueue: () => void;

  // Triage mode
  triageMode: "normal" | "vim";
  setTriageMode: (mode: "normal" | "vim") => void;

  // Metrics
  metrics: Metrics;

  // Triage actions for current document in queue
  approveRedaction: () => void;
  rejectRedaction: () => void;
  navigateRedaction: (direction: "next" | "prev") => void;
  finalizeDocument: () => void;
  clearFlash: () => void;
  setCurrentDocIndex: (index: number) => void;
}

const AUTO_APPROVE_THRESHOLD = 90;

function getStoredTier(): "free" | "pro" {
  try {
    const stored = localStorage.getItem("conseal_tier");
    return stored === "pro" ? "pro" : "free";
  } catch {
    return "free";
  }
}

export const useTriageStore = create<TriageState>((set, get) => {
  let pollingInterval: number | null = null;

  const startPolling = () => {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = window.setInterval(async () => {
      const state = get();
      if (state.uploadedQueue.length === 0) return;

      // Find documents that are not complete/error
      const pendingDocs = state.uploadedQueue.filter(
        (doc) => doc.phase !== "complete" && doc.phase !== "error"
      );

      if (pendingDocs.length === 0) {
        clearInterval(pollingInterval!);
        return;
      }

      // Fetch status for pending docs
      for (const doc of pendingDocs) {
        try {
          const res = await fetch(`${API_BASE}/api/document/${doc.id}/status`);
          if (res.ok) {
            const data = await res.json();
            set((prev) => {
              const newQueue = [...prev.uploadedQueue];
              const docIndex = newQueue.findIndex((d) => d.id === doc.id);
              if (docIndex !== -1) {
                const currentDoc = newQueue[docIndex];
                newQueue[docIndex] = {
                  ...currentDoc,
                  phase: data.phase,
                  redactions: data.redactions.map((r: Omit<Redaction, "status">) => {
                    const existing = currentDoc.redactions.find(
                      (e) => e.startIndex === r.startIndex && e.endIndex === r.endIndex
                    );
                    return {
                      ...r,
                      status:
                        existing?.status !== "pending"
                          ? existing?.status || (r.confidence >= AUTO_APPROVE_THRESHOLD ? "approved" : "pending")
                          : r.confidence >= AUTO_APPROVE_THRESHOLD ? "approved" : "pending",
                    };
                  }),
                };
              }
              return { uploadedQueue: newQueue };
            });
          }
        } catch (err) {
          // Ignore polling errors
        }
      }
    }, 2000);
  };

  return {
    // User
    userTier: getStoredTier(),
    setUserTier: (tier) => {
      localStorage.setItem("conseal_tier", tier);
      set({ userTier: tier });
    },

    // Queue state
    uploadedQueue: [],
    currentDocIndex: 0,
    currentRedactionIndex: 0,
    uploadLoading: false,
    uploadError: null,
    flashEffect: null,

    metrics: {
      processed: 0,
      totalApproved: 0,
      totalRejected: 0,
      autoApproved: 0,
      manualOverrides: 0,
      startTime: Date.now(),
      totalTimeSpent: 0,
      documentStartTime: Date.now(),
    },

    // Upload
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
        const documentIds = data.documents.map((d: any) => d.documentId);

        // Fetch all full documents
        const fullDocs: UploadedDocument[] = [];
        for (const id of documentIds) {
          const docRes = await fetch(`${API_BASE}/api/document/${id}`);
          if (docRes.ok) {
            const docData = await docRes.json();
            fullDocs.push({
              id: docData.id,
              filename: docData.filename,
              mimeType: docData.mimeType,
              text: docData.text,
              filePath: docData.filePath,
              redactions: docData.redactions.map((r: Omit<Redaction, "status">) => ({
                ...r,
                status: r.confidence >= AUTO_APPROVE_THRESHOLD ? "approved" : "pending",
              })),
              phase: docData.phase,
              userTier: docData.userTier,
              uploadedAt: docData.uploadedAt,
            });
          }
        }

        let autoApproved = get().metrics.autoApproved;
        fullDocs.forEach((doc) => {
          doc.redactions.forEach((r) => {
            if (r.status === "approved") autoApproved++;
          });
        });

        set({
          uploadedQueue: [...get().uploadedQueue, ...fullDocs],
          uploadLoading: false,
          currentDocIndex: get().uploadedQueue.length, // Start at first new document
          currentRedactionIndex: 0,
          metrics: {
            ...get().metrics,
            autoApproved,
            documentStartTime: Date.now(),
          },
        });

        startPolling();
      } catch (err) {
        set({ uploadLoading: false, uploadError: (err as Error).message });
      }
    },

    pollQueueStatus: () => {
      startPolling();
    },

    clearQueue: () => {
      if (pollingInterval) clearInterval(pollingInterval);
      set({ uploadedQueue: [], uploadError: null, currentDocIndex: 0, currentRedactionIndex: 0 });
    },

    // Triage mode
    triageMode: "normal",
    setTriageMode: (mode) => set({ triageMode: mode }),

    // Actions
    approveRedaction: () => {
      const { uploadedQueue, currentDocIndex, currentRedactionIndex, metrics } = get();
      const doc = uploadedQueue[currentDocIndex];
      if (!doc) return;
      const redaction = doc.redactions[currentRedactionIndex];
      if (!redaction) return;

      const wasAutoApproved = redaction.status === "approved";
      const newQueue = [...uploadedQueue];
      newQueue[currentDocIndex] = {
        ...doc,
        redactions: doc.redactions.map((r, i) =>
          i === currentRedactionIndex ? { ...r, status: "approved" as const } : r
        ),
      };

      const newMetrics = { ...metrics };
      if (!wasAutoApproved) newMetrics.totalApproved++;

      set({ uploadedQueue: newQueue, metrics: newMetrics, flashEffect: "approve" });
    },

    rejectRedaction: () => {
      const { uploadedQueue, currentDocIndex, currentRedactionIndex, metrics } = get();
      const doc = uploadedQueue[currentDocIndex];
      if (!doc) return;
      const redaction = doc.redactions[currentRedactionIndex];
      if (!redaction) return;

      const wasAutoApproved = redaction.status === "approved";
      const newQueue = [...uploadedQueue];
      newQueue[currentDocIndex] = {
        ...doc,
        redactions: doc.redactions.map((r, i) =>
          i === currentRedactionIndex ? { ...r, status: "rejected" as const } : r
        ),
      };

      const newMetrics = { ...metrics };
      newMetrics.totalRejected++;
      if (wasAutoApproved) {
        newMetrics.manualOverrides++;
        newMetrics.autoApproved--;
      }

      set({ uploadedQueue: newQueue, metrics: newMetrics, flashEffect: "reject" });
    },

    navigateRedaction: (direction) => {
      const { uploadedQueue, currentDocIndex, currentRedactionIndex } = get();
      const doc = uploadedQueue[currentDocIndex];
      if (!doc) return;

      const maxIdx = doc.redactions.length - 1;
      const newIdx =
        direction === "next"
          ? Math.min(currentRedactionIndex + 1, maxIdx)
          : Math.max(currentRedactionIndex - 0 - 1, 0);

      set({
        currentRedactionIndex: newIdx,
        flashEffect: direction === "next" ? "nav-down" : "nav-up",
      });
    },

    finalizeDocument: () => {
      const { uploadedQueue, currentDocIndex, metrics } = get();
      const doc = uploadedQueue[currentDocIndex];
      if (!doc) return;

      const timeOnDoc = Date.now() - metrics.documentStartTime;

      // Send finalize to backend
      const decisions = doc.redactions.map((r) => ({
        startIndex: r.startIndex,
        endIndex: r.endIndex,
        status: r.status === "pending" ? "approved" : r.status,
      }));

      fetch(`${API_BASE}/api/document/${doc.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions }),
      }).catch(console.error);

      // Move to next document automatically! (or if last, stay on it but mark done)
      const nextIndex =
        currentDocIndex + 1 < uploadedQueue.length ? currentDocIndex + 1 : currentDocIndex;

      set({
        currentDocIndex: nextIndex,
        currentRedactionIndex: 0,
        flashEffect: "finalize",
        metrics: {
          ...metrics,
          processed: metrics.processed + 1,
          totalTimeSpent: metrics.totalTimeSpent + timeOnDoc,
          documentStartTime: Date.now(),
        },
      });
    },

    setCurrentDocIndex: (index: number) => {
      if (index >= 0 && index < get().uploadedQueue.length) {
        set({
          currentDocIndex: index,
          currentRedactionIndex: 0,
          metrics: {
            ...get().metrics,
            documentStartTime: Date.now(),
          },
        });
      }
    },

    clearFlash: () => set({ flashEffect: null }),
  };
});
