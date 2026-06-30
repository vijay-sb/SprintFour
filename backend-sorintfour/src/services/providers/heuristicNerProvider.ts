// Tier 1 fallback — dependency-free heuristic NER.
//
// When neither GLiNER nor Ollama is available, this still gives an
// "AI-grade" pass over unstructured PII (multi-word proper nouns →
// people / organizations) so the always-on AI tier is never empty.
// Lower confidence than a real model, which routes it correctly into
// the human review band rather than auto-approving.

import type { Detection, DetectionProvider } from "./types.js";

// Capitalized words that commonly START a sentence or are section labels —
// not names. Keeps false positives down.
const STOPWORDS = new Set([
  "The", "This", "That", "These", "Those", "Patient", "Doctor", "Client", "Case",
  "Diagnostic", "Clinical", "Vitals", "Treatment", "Review", "Summary", "Section",
  "Medical", "Records", "Release", "Intake", "Date", "Name", "Phone", "Email",
  "Address", "Report", "Notes", "History", "Plan", "Care", "Vital", "Exam",
  "January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday", "Sunday", "Inc", "LLC", "Ltd", "Co", "And", "Of",
]);

const ORG_SUFFIX = /\b(?:Inc|LLC|Ltd|Co|Corp|Company|Associates|Group|Partners|Firm|Clinic|Hospital|Center|Centre)\b/;

const PROPER_NOUN = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;

export const heuristicNerProvider: DetectionProvider = {
  name: "heuristic-ner",
  tier: 1,
  async isAvailable() {
    return true;
  },
  async detect(text: string): Promise<Detection[]> {
    const detections: Detection[] = [];
    const seen = new Set<string>();

    let match: RegExpExecArray | null;
    PROPER_NOUN.lastIndex = 0;
    while ((match = PROPER_NOUN.exec(text)) !== null) {
      const value = match[1]!;
      const words = value.split(/\s+/);

      // Drop sequences where the first word is a known non-name.
      if (STOPWORDS.has(words[0]!)) continue;
      // Require at least one word not in the stopword set.
      if (words.every((w) => STOPWORDS.has(w))) continue;

      const isOrg = ORG_SUFFIX.test(value);
      const start = match.index;
      const end = start + value.length;
      const key = `${start}:${end}`;
      if (seen.has(key)) continue;
      seen.add(key);

      detections.push({
        type: isOrg ? "ORGANIZATION" : "PERSON",
        value,
        startIndex: start,
        endIndex: end,
        confidence: isOrg ? 80 : 84,
        provider: "heuristic-ner",
      });
    }

    return detections;
  },
};
