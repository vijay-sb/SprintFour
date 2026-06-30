// Detection pipeline — composes the provider tiers + entity cache.
//
//   Tier 0  regex          (always, instant)        ─┐
//   cache   propagate known entities (free)          ├─ merge → dedup
//   Tier 1  GLiNER | heuristic NER (always-on AI)   ─┤
//   Tier 2  Ollama deep-verify (optional)           ─┘
//
// The AI tier is never on the critical path and never a single point of
// failure: whichever providers are available are used, the rest skipped.

import { regexProvider } from "./providers/regexProvider.js";
import { glinerProvider } from "./providers/glinerProvider.js";
import { heuristicNerProvider } from "./providers/heuristicNerProvider.js";
import { ollamaProvider } from "./providers/ollamaProvider.js";
import { entityCache } from "./entityCache.js";
import type { Detection } from "./providers/types.js";

export interface PipelineResult {
  detections: Detection[];
  occurrences: number;
  propagated: number; // detections resolved from the cache (no inference)
  tier1Provider: string;
  deepVerified: boolean;
}

interface ProviderStatus {
  regex: boolean;
  gliner: boolean;
  heuristic: boolean;
  ollama: boolean;
  resolvedAt: number;
}

let status: ProviderStatus | null = null;

export async function resolveProviders(force = false): Promise<ProviderStatus> {
  if (status && !force) return status;
  const [gliner, ollama] = await Promise.all([
    glinerProvider.isAvailable(),
    ollamaProvider.isAvailable(),
  ]);
  status = { regex: true, gliner, heuristic: true, ollama, resolvedAt: Date.now() };
  return status;
}

export function activeTier1Name(): string {
  if (status?.gliner) return "gliner";
  return "heuristic-ner";
}

export function providerSummary() {
  const s = status;
  return {
    tier0: "regex",
    tier1: s?.gliner ? "gliner" : "heuristic-ner",
    tier2: s?.ollama ? "ollama" : "disabled",
    gliner: Boolean(s?.gliner),
    ollama: Boolean(s?.ollama),
    aiTierOnline: true, // tier 1 is always online (gliner or heuristic)
  };
}

// Overlap-aware merge: deduplicate, keep highest confidence, boost when
// multiple independent providers agree on the same span.
function mergeDetections(groups: Detection[][]): Detection[] {
  const all = groups.flat().sort((a, b) => a.startIndex - b.startIndex);
  const result: Detection[] = [];

  for (const det of all) {
    const overlap = result.find(
      (existing) => det.startIndex < existing.endIndex && det.endIndex > existing.startIndex
    );
    if (!overlap) {
      result.push({ ...det });
      continue;
    }
    if (det.provider && overlap.provider && det.provider !== overlap.provider) {
      // agreement from a different engine → confidence boost
      overlap.confidence = Math.min(99, Math.max(overlap.confidence, det.confidence) + 5);
    } else if (det.confidence > overlap.confidence) {
      overlap.confidence = det.confidence;
      overlap.type = det.type;
    }
  }

  return result;
}

export async function detectDocument(
  text: string,
  opts: { deepVerify?: boolean; useCache?: boolean } = {}
): Promise<PipelineResult> {
  await resolveProviders();
  const useCache = opts.useCache ?? true;

  // Tier 0 — deterministic
  const regexHits = await regexProvider.detect(text);

  // Cache propagation — resolve previously-confirmed entities for free
  const propagated = useCache ? entityCache.propagate(text) : [];

  // Tier 1 — fast local NER (gliner if available, else heuristic)
  const tier1 = status?.gliner ? glinerProvider : heuristicNerProvider;
  const tier1Hits = await tier1.detect(text);

  // Tier 2 — optional LLM deep-verify
  let ollamaHits: Detection[] = [];
  const deepVerified = Boolean(opts.deepVerify && status?.ollama);
  if (deepVerified) {
    ollamaHits = await ollamaProvider.detect(text);
  }

  const detections = mergeDetections([regexHits, propagated, tier1Hits, ollamaHits]);

  // Remember confirmed entities so later documents propagate them for free.
  if (useCache) {
    for (const det of detections) {
      if (det.provider === "cache-propagated") continue; // already known
      entityCache.remember(det.value, det.type, det.confidence, true);
    }
  }

  const propagatedCount = detections.filter((d) => d.provider === "cache-propagated").length;

  return {
    detections,
    occurrences: detections.length,
    propagated: propagatedCount,
    tier1Provider: tier1.name,
    deepVerified,
  };
}
