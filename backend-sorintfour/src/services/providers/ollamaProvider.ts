// Tier 2 — heavy LLM deep-verify (optional).
//
// Ollama is no longer on the critical path: it's an optional enhancer
// that runs only when present. If it's down, the pipeline simply skips
// this tier and serves Tier 0 + Tier 1 results.

import { runOllamaEngine, isOllamaAvailable } from "../ollamaEngine.js";
import type { Detection, DetectionProvider } from "./types.js";

export const ollamaProvider: DetectionProvider = {
  name: "ollama",
  tier: 2,
  async isAvailable() {
    return isOllamaAvailable();
  },
  async detect(text: string): Promise<Detection[]> {
    const results = await runOllamaEngine(text);
    return results.map((match) => ({ ...match, provider: "ollama" }));
  },
};
