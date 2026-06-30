// Detection provider abstraction.
//
// Every detection engine (regex, local NER, LLM) implements the same
// interface so the pipeline can compose them into a fallback chain and
// degrade gracefully when any single tier is unavailable. This is what
// removes Ollama as a single point of failure: it becomes one optional
// provider, not the critical path.

import type { RegexMatch } from "../regexEngine.js";

export type Detection = RegexMatch & {
  /** Which engine produced this detection. */
  provider?: string;
};

export type ProviderTier = 0 | 1 | 2;

export interface DetectionProvider {
  /** Stable identifier, e.g. "regex", "gliner", "ollama". */
  readonly name: string;
  /**
   * 0 = deterministic / instant (regex, checksums)
   * 1 = fast local NER (always-on AI tier)
   * 2 = heavy LLM deep-verify (optional)
   */
  readonly tier: ProviderTier;
  /** Cheap health probe; the pipeline skips unavailable providers. */
  isAvailable(): Promise<boolean>;
  /** Run detection over a single document's text. */
  detect(text: string): Promise<Detection[]>;
}
