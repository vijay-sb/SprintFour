// Ollama AI-powered PII detection engine
// Uses qwen2.5:3b for deep PII extraction with structured JSON output
// Latency: 2-8 seconds per document (runs after regex for progressive enhancement)

import type { RegexMatch } from "./regexEngine.js";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "qwen2.5:3b";
const TIMEOUT_MS = 30000;

interface OllamaResponse {
  response: string;
  done: boolean;
}

interface AIPIIResult {
  entities: Array<{
    type: string;
    value: string;
    context: string;
  }>;
}

const SYSTEM_PROMPT = `You are a PII (Personally Identifiable Information) extraction specialist. Your task is to identify ALL personally identifiable information in the given text.

Find every instance of:
- Full names of people
- Social Security Numbers (SSN)
- Phone numbers
- Email addresses
- Physical/mailing addresses
- Dates of birth
- Credit card numbers
- Bank account numbers
- Passport numbers
- Driver's license numbers
- Medical record numbers (MRN)
- IP addresses
- Vehicle identification numbers (VIN)
- Any other identifying information

For each entity found, provide the type, exact value as it appears in the text, and surrounding context.
Be thorough — missing PII is a compliance violation.`;

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    entities: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          type: { type: "string" as const },
          value: { type: "string" as const },
          context: { type: "string" as const },
        },
        required: ["type", "value", "context"],
      },
    },
  },
  required: ["entities"],
};

export async function runOllamaEngine(text: string): Promise<RegexMatch[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt: `Extract ALL PII from the following document text:\n\n---\n${text}\n---\n\nReturn a JSON object with an "entities" array.`,
        system: SYSTEM_PROMPT,
        format: OUTPUT_SCHEMA,
        stream: false,
        options: {
          temperature: 0,
          num_predict: 2048,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Ollama API error: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as OllamaResponse;
    const parsed: AIPIIResult = JSON.parse(data.response);

    if (!parsed.entities || !Array.isArray(parsed.entities)) {
      console.warn("Ollama returned unexpected format:", data.response);
      return [];
    }

    // Convert AI results to RegexMatch format by finding positions in text
    return parsed.entities
      .map((entity) => {
        const startIndex = text.indexOf(entity.value);
        if (startIndex === -1) return null;

        return {
          type: normalizeType(entity.type),
          value: entity.value,
          startIndex,
          endIndex: startIndex + entity.value.length,
          confidence: 92, // AI base confidence
        };
      })
      .filter((m): m is RegexMatch => m !== null);
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.error("Ollama request timed out after", TIMEOUT_MS, "ms");
    } else {
      console.error("Ollama engine error:", err);
    }
    return [];
  }
}

// Normalize AI type strings to our standard type labels
function normalizeType(aiType: string): string {
  const normalized = aiType.toUpperCase().replace(/[\s_-]+/g, "_");

  const typeMap: Record<string, string> = {
    FULL_NAME: "PERSON",
    NAME: "PERSON",
    PERSON_NAME: "PERSON",
    PERSON: "PERSON",
    SOCIAL_SECURITY_NUMBER: "SSN",
    SSN: "SSN",
    PHONE_NUMBER: "PHONE",
    PHONE: "PHONE",
    TELEPHONE: "PHONE",
    EMAIL_ADDRESS: "EMAIL",
    EMAIL: "EMAIL",
    CREDIT_CARD_NUMBER: "CREDIT_CARD",
    CREDIT_CARD: "CREDIT_CARD",
    IP_ADDRESS: "IP_ADDRESS",
    ADDRESS: "ADDRESS",
    PHYSICAL_ADDRESS: "ADDRESS",
    MAILING_ADDRESS: "ADDRESS",
    DATE_OF_BIRTH: "DOB",
    DOB: "DOB",
    DATE: "DATE",
    PASSPORT_NUMBER: "PASSPORT",
    PASSPORT: "PASSPORT",
    DRIVERS_LICENSE: "DRIVERS_LICENSE",
    DRIVER_LICENSE: "DRIVERS_LICENSE",
    BANK_ACCOUNT: "BANK_ACCOUNT",
    BANK_ACCOUNT_NUMBER: "BANK_ACCOUNT",
    MEDICAL_RECORD: "MEDICAL_ID",
    MRN: "MEDICAL_ID",
    MEDICAL_RECORD_NUMBER: "MEDICAL_ID",
    VEHICLE_IDENTIFICATION_NUMBER: "VEHICLE_ID",
    VIN: "VEHICLE_ID",
    FINANCIAL: "FINANCIAL",
    MONETARY_AMOUNT: "FINANCIAL",
  };

  return typeMap[normalized] || normalized;
}

// Merge AI results with existing regex results, keeping higher confidence
export function mergeResults(
  regexResults: RegexMatch[],
  aiResults: RegexMatch[]
): RegexMatch[] {
  const merged = [...regexResults];

  for (const aiMatch of aiResults) {
    // Check for overlap with existing regex matches
    const existingIdx = merged.findIndex(
      (existing) =>
        aiMatch.startIndex < existing.endIndex &&
        aiMatch.endIndex > existing.startIndex
    );

    if (existingIdx === -1) {
      // New PII found by AI that regex missed — boost confidence
      merged.push({ ...aiMatch, confidence: Math.min(aiMatch.confidence + 3, 99) });
    } else {
      // Both engines found it — boost confidence of existing match
      const existing = merged[existingIdx]!;
      merged[existingIdx] = {
        ...existing,
        confidence: Math.min(Math.max(existing.confidence, aiMatch.confidence) + 5, 99),
      };
    }
  }

  return merged.sort((a, b) => a.startIndex - b.startIndex);
}

// Check if Ollama is available
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
