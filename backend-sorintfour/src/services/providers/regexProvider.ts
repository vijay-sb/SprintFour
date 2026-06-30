// Tier 0 — deterministic detection. Always available, sub-millisecond.
// Handles structured PII (SSN, email, phone, credit card, MRN, IP, …).

import { runRegexEngine } from "../regexEngine.js";
import type { Detection, DetectionProvider } from "./types.js";

export const regexProvider: DetectionProvider = {
  name: "regex",
  tier: 0,
  async isAvailable() {
    return true;
  },
  async detect(text: string): Promise<Detection[]> {
    return runRegexEngine(text).map((match) => ({ ...match, provider: "regex" }));
  },
};
