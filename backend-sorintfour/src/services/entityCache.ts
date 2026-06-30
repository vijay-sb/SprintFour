// Content-addressed entity cache + cross-corpus propagation.
//
// Core efficiency thesis: detection cost should scale with the number of
// UNIQUE PII entities, not the number of occurrences. Legal batches are
// highly redundant — the same client name appears in dozens of files and
// boilerplate paragraphs repeat across documents. We run the expensive
// model once per unique entity, then propagate every confirmed entity
// across the whole corpus with a single Aho-Corasick pass.

import { AhoCorasick } from "./ahoCorasick.js";
import type { Detection } from "./providers/types.js";

interface CachedEntity {
  value: string;
  type: string;
  confidence: number;
  occurrences: number;
}

export interface CacheStats {
  uniqueEntities: number;
  totalOccurrences: number;
  propagatedOccurrences: number; // resolved without a fresh inference
  inferencesRun: number; // unique entities actually sent to a model
  inferencesSaved: number;
  cacheHitRate: number; // 0..1
}

function normalizeKey(value: string, type: string): string {
  // content-addressed key: type + normalized value
  return `${type}::${value.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

export class EntityCache {
  private entities = new Map<string, CachedEntity>();
  private inferencesRun = 0;

  /** Record an entity discovered by a model/regex tier (counts as one inference). */
  remember(value: string, type: string, confidence: number, fromInference = true): void {
    const key = normalizeKey(value, type);
    const existing = this.entities.get(key);
    if (existing) {
      existing.occurrences += 1;
      existing.confidence = Math.max(existing.confidence, confidence);
      return;
    }
    this.entities.set(key, { value, type, confidence, occurrences: 1 });
    if (fromInference) this.inferencesRun += 1;
  }

  has(value: string, type: string): boolean {
    return this.entities.has(normalizeKey(value, type));
  }

  get gazetteerSize(): number {
    return this.entities.size;
  }

  /** Build an Aho-Corasick automaton over the current gazetteer. */
  buildMatcher(): { matcher: AhoCorasick; meta: CachedEntity[] } {
    const matcher = new AhoCorasick();
    const meta: CachedEntity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.value.trim().length < 2) continue;
      matcher.add(entity.value);
      meta.push(entity);
    }
    matcher.build();
    return { matcher, meta };
  }

  /**
   * Propagate every known entity into `text` in one linear scan.
   * Returns detections for all occurrences — none of which cost an inference.
   */
  propagate(text: string): Detection[] {
    const { matcher, meta } = this.buildMatcher();
    if (matcher.size === 0) return [];

    const hits = matcher.search(text, true);
    const detections: Detection[] = [];
    for (const hit of hits) {
      const entity = meta[hit.patternIndex];
      if (!entity) continue;
      detections.push({
        type: entity.type,
        value: text.slice(hit.start, hit.end),
        startIndex: hit.start,
        endIndex: hit.end,
        confidence: entity.confidence,
        provider: "cache-propagated",
      });
    }
    return detections;
  }

  stats(totalOccurrences: number, propagatedOccurrences: number): CacheStats {
    const inferencesSaved = Math.max(0, totalOccurrences - this.inferencesRun);
    return {
      uniqueEntities: this.entities.size,
      totalOccurrences,
      propagatedOccurrences,
      inferencesRun: this.inferencesRun,
      inferencesSaved,
      cacheHitRate: totalOccurrences > 0 ? inferencesSaved / totalOccurrences : 0,
    };
  }

  reset(): void {
    this.entities.clear();
    this.inferencesRun = 0;
  }
}

// Shared cache for the live pipeline (one per server process / batch session).
export const entityCache = new EntityCache();
