import { create } from "zustand";

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
  documents: Document[];
  currentDocIndex: number;
  currentRedactionIndex: number;
  loading: boolean;
  error: string | null;
  metrics: Metrics;
  flashEffect: string | null;

  // Actions
  fetchQueue: () => Promise<void>;
  approveRedaction: () => void;
  rejectRedaction: () => void;
  navigateRedaction: (direction: "next" | "prev") => void;
  finalizeDocument: () => void;
  clearFlash: () => void;
}

const AUTO_APPROVE_THRESHOLD = 90;

export const useTriageStore = create<TriageState>((set, get) => ({
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
      const res = await fetch("http://localhost:3001/api/queue");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const raw = await res.json();
      const documents: Document[] = raw.map(
        (doc: Omit<Document, "status"> & { suggestedRedactions: Omit<Redaction, "status">[] }) => ({
          ...doc,
          status: "in-review" as const,
          suggestedRedactions: doc.suggestedRedactions.map((r) => {
            const isAutoApproved = r.confidence >= AUTO_APPROVE_THRESHOLD;
            return {
              ...r,
              status: isAutoApproved ? ("approved" as const) : ("pending" as const),
            };
          }),
        })
      );

      // Count auto-approves
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
    if (!wasAutoApproved) {
      metrics.totalApproved++;
    }

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

  navigateRedaction: (direction: "next" | "prev") => {
    const { documents, currentDocIndex, currentRedactionIndex } = get();
    const doc = documents[currentDocIndex];
    if (!doc) return;

    const maxIdx = doc.suggestedRedactions.length - 1;
    let newIdx = currentRedactionIndex;

    if (direction === "next") {
      newIdx = Math.min(currentRedactionIndex + 1, maxIdx);
    } else {
      newIdx = Math.max(currentRedactionIndex - 1, 0);
    }

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
}));
