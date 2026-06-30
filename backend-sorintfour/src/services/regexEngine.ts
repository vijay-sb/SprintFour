// Comprehensive regex-based PII detection engine
// Runs instantly (< 1ms) — first pass before Ollama AI

export interface RegexMatch {
  type: string;
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

interface PatternDef {
  type: string;
  pattern: RegExp;
  confidence: number;
}

const PII_PATTERNS: PatternDef[] = [
  // Social Security Numbers
  {
    type: "SSN",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    confidence: 96,
  },
  // Phone Numbers (multiple formats)
  {
    type: "PHONE",
    pattern: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    confidence: 90,
  },
  // Email Addresses
  {
    type: "EMAIL",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    confidence: 98,
  },
  // Credit Card Numbers
  {
    type: "CREDIT_CARD",
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    confidence: 94,
  },
  // IP Addresses
  {
    type: "IP_ADDRESS",
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    confidence: 92,
  },
  // Dates (MM/DD/YYYY, YYYY-MM-DD, etc.)
  {
    type: "DATE",
    pattern: /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g,
    confidence: 78,
  },
  // Passport Numbers (US format)
  {
    type: "PASSPORT",
    pattern: /\b[A-Z]{2}-?[A-Z]?\d{6,9}\b/g,
    confidence: 85,
  },
  // Driver's License (various state formats)
  {
    type: "DRIVERS_LICENSE",
    pattern: /\b[A-Z]{2}-[A-Z]?\d{3}-\d{4}-\d{4}\b/g,
    confidence: 88,
  },
  // Bank Account Numbers
  {
    type: "BANK_ACCOUNT",
    pattern: /\b\d{4}-\d{4}-\d{4}\b/g,
    confidence: 86,
  },
  // Medical Record Numbers
  {
    type: "MEDICAL_ID",
    pattern: /\bMRN-\d{4,10}\b/g,
    confidence: 93,
  },
  // Vehicle Identification Numbers
  {
    type: "VEHICLE_ID",
    pattern: /\b[A-HJ-NPR-Z0-9]{17}\b/g,
    confidence: 87,
  },
  // Dollar amounts
  {
    type: "FINANCIAL",
    pattern: /\$[\d,]+(?:\.\d{2})?\b/g,
    confidence: 70,
  },
];

// Name detection: Capitalized word sequences near identity keywords
const NAME_KEYWORDS = /(?:client|witness|patient|defendant|plaintiff|tenant|holder|dr\.|mr\.|mrs\.|ms\.|filed by|from|between|name|behalf of)\s+/gi;

function detectNames(text: string): RegexMatch[] {
  const matches: RegexMatch[] = [];
  const namePattern = /(?:client|witness|patient|defendant|plaintiff|tenant|holder|dr\.|mr\.|mrs\.|ms\.|filed by|from|between tenant|behalf of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/gi;

  let match;
  while ((match = namePattern.exec(text)) !== null) {
    if (match[1]) {
      const value = match[1];
      const startIndex = match.index + match[0].indexOf(value);
      matches.push({
        type: "PERSON",
        value,
        startIndex,
        endIndex: startIndex + value.length,
        confidence: 88,
      });
    }
  }

  return matches;
}

// Address detection
function detectAddresses(text: string): RegexMatch[] {
  const matches: RegexMatch[] = [];
  const addressPattern = /\b\d{1,5}\s+[A-Z][a-zA-Z\s]+(?:Street|St|Avenue|Ave|Drive|Dr|Road|Rd|Boulevard|Blvd|Lane|Ln|Way|Terrace|Court|Ct|Place|Pl)[,.\s]+[A-Z][a-zA-Z\s]+,?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g;

  let match;
  while ((match = addressPattern.exec(text)) !== null) {
    matches.push({
      type: "ADDRESS",
      value: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      confidence: 85,
    });
  }

  return matches;
}

export function runRegexEngine(text: string): RegexMatch[] {
  const allMatches: RegexMatch[] = [];

  // Run all pattern-based detections
  for (const patternDef of PII_PATTERNS) {
    // Reset lastIndex for global regex
    patternDef.pattern.lastIndex = 0;
    let match;
    while ((match = patternDef.pattern.exec(text)) !== null) {
      allMatches.push({
        type: patternDef.type,
        value: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: patternDef.confidence,
      });
    }
  }

  // Run name detection
  allMatches.push(...detectNames(text));

  // Run address detection
  allMatches.push(...detectAddresses(text));

  // Deduplicate overlapping matches (keep higher confidence)
  return deduplicateMatches(allMatches);
}

function deduplicateMatches(matches: RegexMatch[]): RegexMatch[] {
  // Sort by startIndex
  const sorted = [...matches].sort((a, b) => a.startIndex - b.startIndex);
  const result: RegexMatch[] = [];

  for (const match of sorted) {
    const overlapping = result.find(
      (existing) =>
        match.startIndex < existing.endIndex && match.endIndex > existing.startIndex
    );

    if (!overlapping) {
      result.push(match);
    } else if (match.confidence > overlapping.confidence) {
      // Replace with higher confidence match
      const idx = result.indexOf(overlapping);
      result[idx] = match;
    }
  }

  return result;
}
