// Tier 1 — fast local NER via GLiNER (ONNX, in-process).
//
// GLiNER is a small bidirectional encoder (~80ms/doc on CPU) that does
// zero-shot NER: you pass the PII labels at runtime. It runs entirely
// in-process through onnxruntime — no Python sidecar, no GPU, nothing
// leaves the machine. This is the default "AI tier" that replaces the
// Ollama dependency.
//
// Model: onnx-community/gliner_multi_pii-v1 (Transformers.js compatible).
// If the package/model isn't installed, isAvailable() returns false and
// the pipeline falls back to the heuristic NER provider — the system
// still works, it just loses the strongest model.

import type { Detection, DetectionProvider } from "./types.js";

// HF repo for the tokenizer (Transformers.js downloads it on first use).
const TOKENIZER_ID = process.env.GLINER_TOKENIZER ?? "onnx-community/gliner_multi_pii-v1";
// Path to the ONNX weights on disk. GLiNER.js loads weights from a file
// (or buffer), not a repo id — so activation is opt-in via this env var:
//   GLINER_MODEL_PATH=./models/gliner_multi_pii.onnx bun start
// One-time fetch: download model.onnx from the HF repo above into ./models.
const MODEL_PATH = process.env.GLINER_MODEL_PATH;

// PII labels GLiNER should look for (zero-shot).
const PII_LABELS = [
  "person",
  "organization",
  "address",
  "email",
  "phone number",
  "date of birth",
  "social security number",
  "credit card number",
  "bank account number",
  "medical record number",
  "passport number",
  "driver license number",
];

// GLiNER label → our canonical redaction type.
const LABEL_MAP: Record<string, string> = {
  person: "PERSON",
  organization: "ORGANIZATION",
  address: "ADDRESS",
  email: "EMAIL",
  "phone number": "PHONE",
  "date of birth": "DOB",
  "social security number": "SSN",
  "credit card number": "CREDIT_CARD",
  "bank account number": "BANK_ACCOUNT",
  "medical record number": "MEDICAL_ID",
  "passport number": "PASSPORT",
  "driver license number": "DRIVERS_LICENSE",
};

type GlinerSpan = {
  spanText?: string;
  text?: string;
  start?: number;
  end?: number;
  startIndex?: number;
  endIndex?: number;
  label?: string;
  entity?: string;
  score?: number;
};

let model: { inference: (args: Record<string, unknown>) => Promise<unknown> } | null = null;
let initTried = false;
let available = false;

async function ensureModel() {
  if (initTried) return available;
  initTried = true;

  // Weights are opt-in: without a model file we stay on the heuristic tier
  // rather than failing. The system is fully functional either way.
  if (!MODEL_PATH) {
    console.log("ℹ️  GLINER_MODEL_PATH not set — AI tier on heuristic NER (set it to enable GLiNER).");
    return false;
  }

  try {
    // Dynamic import so a missing dependency degrades gracefully.
    // @ts-ignore — optional dependency
    const mod: any = await import("gliner");
    const Gliner = mod.Gliner ?? mod.default?.Gliner ?? mod.default;

    const instance = new Gliner({
      tokenizerPath: TOKENIZER_ID,
      onnxSettings: { modelPath: MODEL_PATH, executionProvider: "cpu", multiThread: true },
      maxWidth: 12,
    });
    await instance.initialize();

    model = instance;
    available = true;
    console.log(`🧠 GLiNER ready (${TOKENIZER_ID}) — local NER tier online`);
  } catch (err) {
    available = false;
    console.log(
      `ℹ️  GLiNER not active (${(err as Error).message}). Falling back to heuristic NER tier.`
    );
  }

  return available;
}

function normalizeSpan(span: GlinerSpan, text: string): Detection | null {
  const label = (span.label ?? span.entity ?? "").toLowerCase();
  const type = LABEL_MAP[label];
  if (!type) return null;

  let start = span.start ?? span.startIndex;
  let end = span.end ?? span.endIndex;
  const value = span.spanText ?? span.text ?? (start != null && end != null ? text.slice(start, end) : "");
  if (!value) return null;

  if (start == null || end == null) {
    start = text.indexOf(value);
    if (start === -1) return null;
    end = start + value.length;
  }

  const score = typeof span.score === "number" ? span.score : 0.9;
  return {
    type,
    value,
    startIndex: start,
    endIndex: end,
    confidence: Math.round(Math.min(99, Math.max(60, score * 100))),
    provider: "gliner",
  };
}

export const glinerProvider: DetectionProvider = {
  name: "gliner",
  tier: 1,
  async isAvailable() {
    return ensureModel();
  },
  async detect(text: string): Promise<Detection[]> {
    if (!(await ensureModel()) || !model) return [];
    try {
      const out: any = await model.inference({ texts: [text], entities: PII_LABELS, threshold: 0.4 });
      // Single-text inference may return a flat array or an array-of-arrays.
      const spans: GlinerSpan[] = Array.isArray(out?.[0]) ? out[0] : Array.isArray(out) ? out : [];
      return spans
        .map((span) => normalizeSpan(span, text))
        .filter((d): d is Detection => d !== null);
    } catch (err) {
      console.error("GLiNER inference error:", (err as Error).message);
      return [];
    }
  },
};
