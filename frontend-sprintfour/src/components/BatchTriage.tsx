import { useMemo, useState } from "react";
import { useTriageStore } from "@/store/useTriageStore";
import type { BulkFilter, Redaction, UploadedDocument } from "@/store/useTriageStore";

const AUTO_APPROVE_THRESHOLD = 90;

interface Instance {
  docId: string;
  filename: string;
  redaction: Redaction;
  snippet: string;
}

interface ValueGroup {
  value: string;
  type: string;
  instances: Instance[];
  docIds: Set<string>;
  pending: number;
  approved: number;
  rejected: number;
  minConfidence: number;
  maxConfidence: number;
}

interface TypeGroup {
  type: string;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  docIds: Set<string>;
  minConfidence: number;
  maxConfidence: number;
  values: ValueGroup[];
}

const TYPE_META: Record<string, { label: string; tone: string }> = {
  SSN: { label: "Social Security", tone: "rose" },
  PHONE: { label: "Phone", tone: "sky" },
  EMAIL: { label: "Email", tone: "cyan" },
  PERSON: { label: "Names", tone: "violet" },
  ADDRESS: { label: "Address", tone: "amber" },
  CREDIT_CARD: { label: "Credit card", tone: "rose" },
  FINANCIAL: { label: "Financial", tone: "emerald" },
  DATE: { label: "Dates", tone: "slate" },
  IP_ADDRESS: { label: "IP address", tone: "sky" },
  MEDICAL_ID: { label: "Medical ID", tone: "rose" },
  BANK_ACCOUNT: { label: "Bank account", tone: "emerald" },
  PASSPORT: { label: "Passport", tone: "amber" },
  DRIVERS_LICENSE: { label: "Driver's license", tone: "amber" },
  VEHICLE_ID: { label: "Vehicle ID", tone: "slate" },
  MANUAL_FLAG: { label: "Manual flag", tone: "cyan" },
};

const NEUTRAL_TONE = {
  dot: "bg-neutral-900",
  text: "text-neutral-700",
  soft: "bg-neutral-50",
  ring: "ring-neutral-200",
};

function tone(_type: string) {
  return NEUTRAL_TONE;
}

function typeLabel(type: string) {
  return TYPE_META[type]?.label ?? type;
}

function buildSnippet(text: string, redaction: Redaction) {
  const pad = 32;
  const start = Math.max(0, redaction.startIndex - pad);
  const end = Math.min(text.length, redaction.endIndex + pad);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}

function summarize(redactions: Redaction[]) {
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let min = 100;
  let max = 0;
  for (const r of redactions) {
    if (r.status === "pending") pending += 1;
    else if (r.status === "approved") approved += 1;
    else rejected += 1;
    min = Math.min(min, r.confidence);
    max = Math.max(max, r.confidence);
  }
  return { pending, approved, rejected, min, max };
}

export function BatchTriage() {
  const { uploadedQueue, bulkDecide, finalizeAll, batchFinalizing, metrics } = useTriageStore();

  const [onlyAttention, setOnlyAttention] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const activeDocs = useMemo(
    () => uploadedQueue.filter((doc) => !doc.finalizedAt),
    [uploadedQueue]
  );
  const finalizedDocs = uploadedQueue.length - activeDocs.length;

  const { groups, totals } = useMemo(() => buildGroups(activeDocs), [activeDocs]);

  const visibleGroups = useMemo(() => {
    if (!onlyAttention) return groups;
    return groups
      .filter((g) => g.pending > 0)
      .map((g) => ({ ...g, values: g.values.filter((v) => v.pending > 0) }));
  }, [groups, onlyAttention]);

  const sweep = (filter: BulkFilter, status: "approved" | "rejected") => bulkDecide(filter, status);

  const allResolved = totals.pending === 0;
  const clearedPct =
    totals.total > 0 ? Math.round(((totals.total - totals.pending) / totals.total) * 100) : 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Command bar */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-700">
              Batch Triage
            </div>
            <div className="mt-1 text-sm text-neutral-600">
              Decide once, apply everywhere. {totals.total.toLocaleString()} detections across{" "}
              {activeDocs.length} open {activeDocs.length === 1 ? "file" : "files"}.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => sweep({ confidenceGte: AUTO_APPROVE_THRESHOLD, onlyPending: true }, "approved")}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
            >
              Approve all ≥{AUTO_APPROVE_THRESHOLD}%
            </button>
            <button
              onClick={() => sweep({ onlyPending: true }, "approved")}
              className="rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              Approve everything pending
            </button>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={onlyAttention}
                onChange={(e) => setOnlyAttention(e.target.checked)}
                className="h-3.5 w-3.5 accent-neutral-900"
              />
              Needs attention only
            </label>
          </div>
        </div>

        {/* progress + finalize */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-500">
              <span>{clearedPct}% of decisions resolved</span>
              <span>
                {totals.pending.toLocaleString()} pending · {totals.approved.toLocaleString()} approved ·{" "}
                {totals.rejected.toLocaleString()} skipped
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-neutral-900 transition-all duration-500"
                style={{ width: `${clearedPct}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => void finalizeAll()}
            disabled={batchFinalizing || activeDocs.length === 0}
            className={`rounded-lg px-5 py-3 text-sm font-semibold transition ${
              batchFinalizing || activeDocs.length === 0
                ? "cursor-not-allowed bg-neutral-100 text-neutral-400"
                : allResolved
                  ? "bg-neutral-900 text-white hover:bg-neutral-800"
                  : "bg-neutral-900 text-white hover:bg-neutral-800"
            }`}
          >
            {batchFinalizing
              ? "Exporting…"
              : allResolved
                ? `Export all ${activeDocs.length} files`
                : `Export ${activeDocs.length} files (${totals.pending} still pending)`}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral-500">
          <Stat label="Exported" value={`${finalizedDocs + metrics.autoFinalizedDocs}`} />
          <Stat label="Repeated entities" value={`${totals.repeatedValues}`} />
          <Stat label="PII classes" value={`${groups.length}`} />
        </div>
      </div>

      {/* Groups */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {activeDocs.length === 0 ? (
          <EmptyState />
        ) : visibleGroups.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm text-emerald-700">
            Nothing left needs your attention. Export when you're ready.
          </div>
        ) : (
          visibleGroups.map((group) => (
            <GroupCard
              key={group.type}
              group={group}
              expanded={Boolean(expanded[group.type])}
              onToggle={() =>
                setExpanded((prev) => ({ ...prev, [group.type]: !prev[group.type] }))
              }
              onApproveGroup={() => sweep({ types: [group.type], onlyPending: true }, "approved")}
              onRejectGroup={() => sweep({ types: [group.type], onlyPending: true }, "rejected")}
              onApproveValue={(value) =>
                sweep({ types: [group.type], value, onlyPending: true }, "approved")
              }
              onRejectValue={(value) =>
                sweep({ types: [group.type], value, onlyPending: true }, "rejected")
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function GroupCard({
  group,
  expanded,
  onToggle,
  onApproveGroup,
  onRejectGroup,
  onApproveValue,
  onRejectValue,
}: {
  group: TypeGroup;
  expanded: boolean;
  onToggle: () => void;
  onApproveGroup: () => void;
  onRejectGroup: () => void;
  onApproveValue: (value: string) => void;
  onRejectValue: (value: string) => void;
}) {
  const t = tone(group.type);
  const resolved = group.total - group.pending;
  const pct = group.total > 0 ? Math.round((resolved / group.total) * 100) : 100;

  return (
    <div className={`overflow-hidden rounded-xl border border-neutral-200 bg-white ring-1 ring-inset ${t.ring}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <button onClick={onToggle} className="flex min-w-0 items-center gap-3 text-left">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.dot}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-neutral-900">{typeLabel(group.type)}</span>
              <span className="text-xs text-neutral-400">{group.type}</span>
              <span className={`text-neutral-400 transition ${expanded ? "rotate-90" : ""}`}>›</span>
            </div>
            <div className="mt-0.5 text-xs text-neutral-500">
              {group.total} detections · {group.docIds.size}{" "}
              {group.docIds.size === 1 ? "file" : "files"} · {group.minConfidence}–{group.maxConfidence}% confidence
            </div>
          </div>
        </button>

        <div className="flex items-center gap-3">
          {group.pending > 0 ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              {group.pending} pending
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              resolved
            </span>
          )}
          <div className="flex gap-2">
            <button
              onClick={onApproveGroup}
              disabled={group.pending === 0}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Approve all
            </button>
            <button
              onClick={onRejectGroup}
              disabled={group.pending === 0}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Skip all
            </button>
          </div>
        </div>
      </div>

      <div className="h-1 bg-neutral-100">
        <div className="h-full bg-neutral-900 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {expanded ? (
        <div className="divide-y divide-neutral-200 border-t border-neutral-200">
          {group.values.map((v) => (
            <ValueRow
              key={v.value}
              value={v}
              onApprove={() => onApproveValue(v.value)}
              onReject={() => onRejectValue(v.value)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ValueRow({
  value,
  onApprove,
  onReject,
}: {
  value: ValueGroup;
  onApprove: () => void;
  onReject: () => void;
}) {
  const repeated = value.docIds.size > 1;
  const sample = value.instances[0]?.snippet;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-sm text-neutral-900">{value.value}</span>
          {repeated ? (
            <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
              {value.docIds.size} files
            </span>
          ) : null}
          <span className="shrink-0 text-[11px] text-neutral-400">
            ×{value.instances.length} · {value.maxConfidence}%
          </span>
        </div>
        {sample ? (
          <div className="mt-1 truncate text-xs italic text-neutral-400">{sample}</div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {value.pending === 0 ? (
          <span className="text-[11px] text-neutral-400">
            {value.approved > 0 ? "approved" : "skipped"}
          </span>
        ) : (
          <>
            <button
              onClick={onApprove}
              className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100"
            >
              Approve
            </button>
            <button
              onClick={onReject}
              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-100"
            >
              Skip
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md border border-neutral-200 bg-neutral-100 px-2 py-1">
      <span className="text-neutral-400">{label} </span>
      <span className="font-semibold text-neutral-700">{value}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
      <div className="text-sm font-semibold text-neutral-900">Every file is exported</div>
      <div className="mt-1 text-xs text-neutral-500">
        Upload another batch to keep going. Redacted output is in the results folder.
      </div>
    </div>
  );
}

function buildGroups(docs: UploadedDocument[]) {
  const typeMap = new Map<string, TypeGroup>();
  const totals = { total: 0, pending: 0, approved: 0, rejected: 0, repeatedValues: 0 };

  for (const doc of docs) {
    for (const redaction of doc.redactions) {
      totals.total += 1;
      if (redaction.status === "pending") totals.pending += 1;
      else if (redaction.status === "approved") totals.approved += 1;
      else totals.rejected += 1;

      let group = typeMap.get(redaction.type);
      if (!group) {
        group = {
          type: redaction.type,
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          docIds: new Set(),
          minConfidence: 100,
          maxConfidence: 0,
          values: [],
        };
        typeMap.set(redaction.type, group);
      }

      group.total += 1;
      group.docIds.add(doc.id);
      group.minConfidence = Math.min(group.minConfidence, redaction.confidence);
      group.maxConfidence = Math.max(group.maxConfidence, redaction.confidence);

      let valueGroup = group.values.find((v) => v.value === redaction.value);
      if (!valueGroup) {
        valueGroup = {
          value: redaction.value,
          type: redaction.type,
          instances: [],
          docIds: new Set(),
          pending: 0,
          approved: 0,
          rejected: 0,
          minConfidence: 100,
          maxConfidence: 0,
        };
        group.values.push(valueGroup);
      }

      valueGroup.instances.push({
        docId: doc.id,
        filename: doc.filename,
        redaction,
        snippet: buildSnippet(doc.text, redaction),
      });
      valueGroup.docIds.add(doc.id);
      valueGroup.minConfidence = Math.min(valueGroup.minConfidence, redaction.confidence);
      valueGroup.maxConfidence = Math.max(valueGroup.maxConfidence, redaction.confidence);
    }
  }

  // roll up status counts and ordering
  const groups = Array.from(typeMap.values());
  for (const group of groups) {
    const groupStats = summarize(group.values.flatMap((v) => v.instances.map((i) => i.redaction)));
    group.pending = groupStats.pending;
    group.approved = groupStats.approved;
    group.rejected = groupStats.rejected;

    for (const v of group.values) {
      const s = summarize(v.instances.map((i) => i.redaction));
      v.pending = s.pending;
      v.approved = s.approved;
      v.rejected = s.rejected;
      if (v.docIds.size > 1) totals.repeatedValues += 1;
    }

    // most occurrences first, pending-heavy near the top
    group.values.sort((a, b) => b.pending - a.pending || b.instances.length - a.instances.length);
  }

  // groups with pending work first, then by volume
  groups.sort((a, b) => (b.pending > 0 ? 1 : 0) - (a.pending > 0 ? 1 : 0) || b.total - a.total);

  return { groups, totals };
}
