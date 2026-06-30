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

export interface Document {
  documentId: string;
  priorityScore: number;
  content: string;
  suggestedRedactions: Redaction[];
  status: "in-review" | "finalized";
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

  // Upload flow
  uploadedDoc: UploadedDocument | null;
  uploadLoading: boolean;
  uploadError: string | null;
  uploadDocument: (file: File) => Promise<void>;
  pollDocumentStatus: (id: string) => Promise<void>;
  clearUploadedDoc: () => void;

  // Triage mode
  triageMode: "normal" | "vim";
  setTriageMode: (mode: "normal" | "vim") => void;

  // Queue mode (legacy / demo)
  documents: Document[];
  currentDocIndex: number;
  currentRedactionIndex: number;
  loading: boolean;
  error: string | null;
  metrics: Metrics;
  flashEffect: string | null;

  // Current uploaded doc redaction navigation
  currentUploadRedactionIndex: number;

  // Actions
  fetchQueue: () => Promise<void>;
  approveRedaction: () => void;
  rejectRedaction: () => void;
  navigateRedaction: (direction: "next" | "prev") => void;
  finalizeDocument: () => void;
  clearFlash: () => void;

  // Uploaded doc triage actions
  approveUploadRedaction: () => void;
  rejectUploadRedaction: () => void;
  navigateUploadRedaction: (direction: "next" | "prev") => void;
  finalizeUploadedDocument: () => void;
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

export const useTriageStore = create<TriageState>((set, get) => ({
  // User
  userTier: getStoredTier(),
  setUserTier: (tier) => {
    localStorage.setItem("conseal_tier", tier);
    set({ userTier: tier });
  },

  // Upload
  uploadedDoc: null,
  uploadLoading: false,
  uploadError: null,
  currentUploadRedactionIndex: 0,

  uploadDocument: async (file: File) => {
    set({ uploadLoading: true, uploadError: null, uploadedDoc: null });
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userTier", get().userTier);

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Upload failed: ${res.status}`);
      }

      const data = await res.json();

      // Fetch full document
      const docRes = await fetch(`${API_BASE}/api/document/${data.documentId}`);
      const docData = await docRes.json();

      const doc: UploadedDocument = {
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
      };

      set({
        uploadedDoc: doc,
        uploadLoading: false,
        currentUploadRedactionIndex: 0,
        metrics: {
          ...get().metrics,
          documentStartTime: Date.now(),
        },
      });

      // Start polling for AI results if not complete
      if (doc.phase !== "complete") {
        get().pollDocumentStatus(doc.id);
      }
    } catch (err) {
      set({ uploadLoading: false, uploadError: (err as Error).message });
    }
  },

  pollDocumentStatus: async (id: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/document/${id}/status`);
        if (!res.ok) return;

        const data = await res.json();
        const doc = get().uploadedDoc;
        if (!doc || doc.id !== id) return;

        const updatedDoc: UploadedDocument = {
          ...doc,
          phase: data.phase,
          redactions: data.redactions.map((r: Omit<Redaction, "status">) => {
            // Preserve existing decisions
            const existing = doc.redactions.find(
              (e) => e.startIndex === r.startIndex && e.endIndex === r.endIndex
            );
            return {
              ...r,
              status: existing?.status !== "pending"
                ? existing?.status || (r.confidence >= AUTO_APPROVE_THRESHOLD ? "approved" : "pending")
                : r.confidence >= AUTO_APPROVE_THRESHOLD ? "approved" : "pending",
            };
          }),
        };

        set({ uploadedDoc: updatedDoc });

        // Keep polling if not complete
        if (data.phase !== "complete" && data.phase !== "error") {
          setTimeout(poll, 1500);
        }
      } catch {
        // Silently fail, try again
        setTimeout(poll, 3000);
      }
    };

    setTimeout(poll, 2000);
  },

  clearUploadedDoc: () => set({ uploadedDoc: null, uploadError: null, currentUploadRedactionIndex: 0 }),

  // Triage mode
  triageMode: "normal",
  setTriageMode: (mode) => set({ triageMode: mode }),

  // Queue (legacy)
  documents: [],
  currentDocIndex: 0,
  currentRedactionIndex: 0,
  loading: false,
  error: null,
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

  fetchQueue: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/queue`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const raw = await res.json();
      const documents: Document[] = raw.map(
        (doc: Omit<Document, "status"> & { suggestedRedactions: Omit<Redaction, "status">[] }) => ({
          ...doc,
          status: "in-review" as const,
          suggestedRedactions: doc.suggestedRedactions.map((r) => ({
            ...r,
            status: r.confidence >= AUTO_APPROVE_THRESHOLD ? ("approved" as const) : ("pending" as const),
          })),
        })
      );

      let autoApproved = 0;
      documents.forEach((doc) => {
        doc.suggestedRedactions.forEach((r) => {
          if (r.status === "approved") autoApproved++;
        });
      });

      set({
        documents,
        loading: false,
        currentDocIndex: 0,
        currentRedactionIndex: 0,
        metrics: {
          ...get().metrics,
          autoApproved,
          startTime: Date.now(),
          documentStartTime: Date.now(),
        },
      });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  approveRedaction: () => {
    const { documents, currentDocIndex, currentRedactionIndex } = get();
    const doc = documents[currentDocIndex];
    if (!doc) return;
    const redaction = doc.suggestedRedactions[currentRedactionIndex];
    if (!redaction) return;

    const wasAutoApproved = redaction.status === "approved";
    const newDocs = [...documents];
    newDocs[currentDocIndex] = {
      ...doc,
      suggestedRedactions: doc.suggestedRedactions.map((r, i) =>
        i === currentRedactionIndex ? { ...r, status: "approved" as const } : r
      ),
    };

    const metrics = { ...get().metrics };
    if (!wasAutoApproved) metrics.totalApproved++;

    set({ documents: newDocs, metrics, flashEffect: "approve" });
  },

  rejectRedaction: () => {
    const { documents, currentDocIndex, currentRedactionIndex } = get();
    const doc = documents[currentDocIndex];
    if (!doc) return;
    const redaction = doc.suggestedRedactions[currentRedactionIndex];
    if (!redaction) return;

    const wasAutoApproved = redaction.status === "approved";
    const newDocs = [...documents];
    newDocs[currentDocIndex] = {
      ...doc,
      suggestedRedactions: doc.suggestedRedactions.map((r, i) =>
        i === currentRedactionIndex ? { ...r, status: "rejected" as const } : r
      ),
    };

    const metrics = { ...get().metrics };
    metrics.totalRejected++;
    if (wasAutoApproved) {
      metrics.manualOverrides++;
      metrics.autoApproved--;
    }

    set({ documents: newDocs, metrics, flashEffect: "reject" });
  },

  navigateRedaction: (direction) => {
    const { documents, currentDocIndex, currentRedactionIndex } = get();
    const doc = documents[currentDocIndex];
    if (!doc) return;

    const maxIdx = doc.suggestedRedactions.length - 1;
    const newIdx = direction === "next"
      ? Math.min(currentRedactionIndex + 1, maxIdx)
      : Math.max(currentRedactionIndex - 1, 0);

    set({ currentRedactionIndex: newIdx, flashEffect: direction === "next" ? "nav-down" : "nav-up" });
  },

  finalizeDocument: () => {
    const { documents, currentDocIndex, metrics } = get();
    const doc = documents[currentDocIndex];
    if (!doc) return;

    const timeOnDoc = Date.now() - metrics.documentStartTime;
    const newDocs = documents.filter((_, i) => i !== currentDocIndex);
    const newIndex = Math.min(currentDocIndex, newDocs.length - 1);

    set({
      documents: newDocs,
      currentDocIndex: Math.max(newIndex, 0),
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

  clearFlash: () => set({ flashEffect: null }),

  // Uploaded doc triage actions
  approveUploadRedaction: () => {
    const { uploadedDoc, currentUploadRedactionIndex } = get();
    if (!uploadedDoc) return;
    const redaction = uploadedDoc.redactions[currentUploadRedactionIndex];
    if (!redaction) return;

    const wasAutoApproved = redaction.status === "approved";
    const newRedactions = uploadedDoc.redactions.map((r, i) =>
      i === currentUploadRedactionIndex ? { ...r, status: "approved" as const } : r
    );

    const metrics = { ...get().metrics };
    if (!wasAutoApproved) metrics.totalApproved++;

    set({
      uploadedDoc: { ...uploadedDoc, redactions: newRedactions },
      metrics,
      flashEffect: "approve",
    });
  },

  rejectUploadRedaction: () => {
    const { uploadedDoc, currentUploadRedactionIndex } = get();
    if (!uploadedDoc) return;
    const redaction = uploadedDoc.redactions[currentUploadRedactionIndex];
    if (!redaction) return;

    const wasAutoApproved = redaction.status === "approved";
    const newRedactions = uploadedDoc.redactions.map((r, i) =>
      i === currentUploadRedactionIndex ? { ...r, status: "rejected" as const } : r
    );

    const metrics = { ...get().metrics };
    metrics.totalRejected++;
    if (wasAutoApproved) {
      metrics.manualOverrides++;
      metrics.autoApproved--;
    }

    set({
      uploadedDoc: { ...uploadedDoc, redactions: newRedactions },
      metrics,
      flashEffect: "reject",
    });
  },

  navigateUploadRedaction: (direction) => {
    const { uploadedDoc, currentUploadRedactionIndex } = get();
    if (!uploadedDoc) return;
    const maxIdx = uploadedDoc.redactions.length - 1;
    const newIdx = direction === "next"
      ? Math.min(currentUploadRedactionIndex + 1, maxIdx)
      : Math.max(currentUploadRedactionIndex - 1, 0);

    set({
      currentUploadRedactionIndex: newIdx,
      flashEffect: direction === "next" ? "nav-down" : "nav-up",
    });
  },

  finalizeUploadedDocument: () => {
    const { uploadedDoc, metrics } = get();
    if (!uploadedDoc) return;

    const timeOnDoc = Date.now() - metrics.documentStartTime;

    // Send finalize to backend
    const decisions = uploadedDoc.redactions.map((r) => ({
      startIndex: r.startIndex,
      endIndex: r.endIndex,
      status: r.status === "pending" ? "approved" : r.status,
    }));

    fetch(`${API_BASE}/api/document/${uploadedDoc.id}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisions }),
    }).catch(console.error);

    set({
      uploadedDoc: null,
      currentUploadRedactionIndex: 0,
      flashEffect: "finalize",
      metrics: {
        ...metrics,
        processed: metrics.processed + 1,
        totalTimeSpent: metrics.totalTimeSpent + timeOnDoc,
        documentStartTime: Date.now(),
      },
    });
  },
}));
