/**
 * PII Redaction Module
 *
 * Provides functions to redact (mask, replace, or remove) PII from text.
 * Useful for sanitizing user input, preparing logs, and protecting privacy.
 *
 * @example
 * ```typescript
 * import { redactPII, redactForLogging } from "@/lib/safety";
 *
 * // Redact with type labels (default)
 * const result = redactPII("Contact john@example.com");
 * console.log(result.redactedText); // "Contact [EMAIL]"
 *
 * // Redact with masking
 * const masked = redactPII("SSN: 123-45-6789", { replacement: 'mask' });
 * console.log(masked.redactedText); // "SSN: ***-**-****"
 *
 * // Safe for logging
 * const logSafe = redactForLogging("User john@example.com called 555-123-4567");
 * console.log(logSafe); // "User [EMAIL] called [PHONE]"
 * ```
 */

import {
  detectPII,
  type PIIMatch,
  type PIIType,
  type PIIDetectionResult,
} from "./pii-detection";

// ===========================================
// Types
// ===========================================

/**
 * Options for PII redaction
 */
export interface RedactionOptions {
  /**
   * How to replace detected PII:
   * - 'mask': Replace characters with mask character (e.g., "john@email.com" → "****@*****.***")
   * - 'type_label': Replace with type label (e.g., "john@email.com" → "[EMAIL]")
   * - 'remove': Remove the PII entirely
   *
   * Default: 'type_label'
   */
  replacement?: "mask" | "type_label" | "remove";

  /**
   * Character to use for masking (only used when replacement='mask')
   * Default: '*'
   */
  maskChar?: string;

  /**
   * Types of PII to redact. If not specified, all types are redacted.
   * Useful for selective redaction.
   */
  typesToRedact?: PIIType[];
}

/**
 * Result of PII redaction
 */
export interface RedactionResult {
  /** The text with PII redacted */
  redactedText: string;
  /** List of PII matches that were redacted */
  redactions: PIIMatch[];
  /** Whether any redactions were made */
  wasRedacted: boolean;
}

// ===========================================
// Type Labels
// ===========================================

/**
 * Labels used when replacement is 'type_label'
 */
const TYPE_LABELS: Record<PIIType, string> = {
  email: "[EMAIL]",
  phone: "[PHONE]",
  ssn: "[SSN]",
  credit_card: "[CREDIT_CARD]",
  ip_address: "[IP_ADDRESS]",
  address: "[ADDRESS]",
};

// ===========================================
// Main Redaction Functions
// ===========================================

/**
 * Redact PII from text
 *
 * Detects all PII in the provided text and replaces it according to
 * the specified options. Returns the redacted text along with information
 * about what was redacted.
 *
 * @param text - Text containing potential PII
 * @param options - Redaction options
 * @returns Redaction result with redacted text and redaction info
 *
 * @example
 * ```typescript
 * // Using type labels (default)
 * const result1 = redactPII("Email: john@test.com");
 * // result1.redactedText = "Email: [EMAIL]"
 *
 * // Using masking
 * const result2 = redactPII("Email: john@test.com", { replacement: 'mask' });
 * // result2.redactedText = "Email: ****@****.***"
 *
 * // Selective redaction
 * const result3 = redactPII(
 *   "john@test.com called 555-1234",
 *   { typesToRedact: ['email'] }
 * );
 * // result3.redactedText = "[EMAIL] called 555-1234"
 * ```
 */
export function redactPII(
  text: string,
  options: RedactionOptions = {}
): RedactionResult {
  const {
    replacement = "type_label",
    maskChar = "*",
    typesToRedact,
  } = options;

  // Handle empty or invalid input
  if (!text || typeof text !== "string") {
    return {
      redactedText: text || "",
      redactions: [],
      wasRedacted: false,
    };
  }

  // Detect all PII
  const detection = detectPII(text);

  if (!detection.hasPII) {
    return {
      redactedText: text,
      redactions: [],
      wasRedacted: false,
    };
  }

  // Filter matches by type if specified
  let matchesToRedact = detection.matches;
  if (typesToRedact && typesToRedact.length > 0) {
    matchesToRedact = matchesToRedact.filter((m) =>
      typesToRedact.includes(m.type)
    );
  }

  if (matchesToRedact.length === 0) {
    return {
      redactedText: text,
      redactions: [],
      wasRedacted: false,
    };
  }

  // Build redacted text by processing matches from end to start
  // (to preserve indices as we modify the string)
  let redactedText = text;
  const sortedMatches = [...matchesToRedact].sort(
    (a, b) => b.startIndex - a.startIndex
  );

  for (const match of sortedMatches) {
    const replacementText = getReplacementText(match, replacement, maskChar);
    redactedText =
      redactedText.substring(0, match.startIndex) +
      replacementText +
      redactedText.substring(match.endIndex);
  }

  return {
    redactedText,
    redactions: matchesToRedact,
    wasRedacted: true,
  };
}

/**
 * Redact PII for safe logging
 *
 * Convenience function that always uses type labels for redaction.
 * Suitable for creating audit logs and debug output.
 *
 * @param text - Text to sanitize for logging
 * @returns Sanitized text with all PII replaced by type labels
 *
 * @example
 * ```typescript
 * const userMessage = "Please contact me at john@email.com or 555-123-4567";
 * const safeLog = redactForLogging(userMessage);
 * console.log(safeLog);
 * // "Please contact me at [EMAIL] or [PHONE]"
 * ```
 */
export function redactForLogging(text: string): string {
  const result = redactPII(text, { replacement: "type_label" });
  return result.redactedText;
}

/**
 * Redact PII with masking
 *
 * Convenience function that masks PII with asterisks while
 * preserving the general structure of the data.
 *
 * @param text - Text to mask
 * @param maskChar - Character to use for masking (default: '*')
 * @returns Masked text
 *
 * @example
 * ```typescript
 * const masked = redactWithMask("Card: 4111-1111-1111-1111");
 * console.log(masked); // "Card: ****-****-****-****"
 * ```
 */
export function redactWithMask(text: string, maskChar: string = "*"): string {
  const result = redactPII(text, { replacement: "mask", maskChar });
  return result.redactedText;
}

/**
 * Remove all PII from text
 *
 * Completely removes detected PII from the text.
 * May result in awkward spacing.
 *
 * @param text - Text to clean
 * @returns Text with PII removed
 *
 * @example
 * ```typescript
 * const cleaned = removePII("Contact john@email.com for help");
 * console.log(cleaned); // "Contact  for help"
 * ```
 */
export function removePII(text: string): string {
  const result = redactPII(text, { replacement: "remove" });
  return result.redactedText;
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Get replacement text for a PII match
 *
 * @param match - The PII match to replace
 * @param replacement - Replacement strategy
 * @param maskChar - Character to use for masking
 * @returns Replacement text
 */
function getReplacementText(
  match: PIIMatch,
  replacement: "mask" | "type_label" | "remove",
  maskChar: string
): string {
  switch (replacement) {
    case "type_label":
      return TYPE_LABELS[match.type];

    case "remove":
      return "";

    case "mask":
      return maskValue(match.value, match.type, maskChar);

    default:
      return TYPE_LABELS[match.type];
  }
}

/**
 * Mask a PII value while preserving structure
 *
 * Different PII types are masked differently to preserve
 * the general format while hiding the actual data.
 *
 * @param value - The PII value to mask
 * @param type - The type of PII
 * @param maskChar - Character to use for masking
 * @returns Masked value
 */
function maskValue(value: string, type: PIIType, maskChar: string): string {
  switch (type) {
    case "email":
      // Preserve @ and dots, mask the rest
      // john@example.com → ****@*******.***
      return value.replace(/[^@.]/g, maskChar);

    case "phone":
      // Preserve formatting characters, mask digits
      // (555) 123-4567 → (***) ***-****
      return value.replace(/\d/g, maskChar);

    case "ssn":
      // Preserve dashes/spaces, mask digits
      // 123-45-6789 → ***-**-****
      return value.replace(/\d/g, maskChar);

    case "credit_card":
      // Preserve formatting, mask all but last 4 digits
      // 4111-1111-1111-1111 → ****-****-****-1111
      const digitsOnly = value.replace(/[-\s]/g, "");
      const lastFour = digitsOnly.slice(-4);
      const masked = digitsOnly.slice(0, -4).replace(/\d/g, maskChar) + lastFour;
      // Restore original formatting
      let result = "";
      let maskedIndex = 0;
      for (const char of value) {
        if (char === "-" || char === " ") {
          result += char;
        } else {
          result += masked[maskedIndex] || maskChar;
          maskedIndex++;
        }
      }
      return result;

    case "ip_address":
      // Mask all octets except structure
      // 192.168.1.1 → ***.***.*.*
      return value.replace(/\d/g, maskChar);

    case "address":
      // Mask the entire address
      // 123 Main Street → *** **** ******
      return value.replace(/[A-Za-z0-9]/g, maskChar);

    default:
      // Default: mask all alphanumeric characters
      return value.replace(/[A-Za-z0-9]/g, maskChar);
  }
}

// ===========================================
// Batch Processing
// ===========================================

/**
 * Redact PII from multiple texts
 *
 * @param texts - Array of texts to redact
 * @param options - Redaction options
 * @returns Array of redaction results
 *
 * @example
 * ```typescript
 * const messages = [
 *   "Email: john@test.com",
 *   "Phone: 555-1234"
 * ];
 * const results = redactPIIBatch(messages);
 * console.log(results.map(r => r.redactedText));
 * // ["Email: [EMAIL]", "Phone: [PHONE]"]
 * ```
 */
export function redactPIIBatch(
  texts: string[],
  options: RedactionOptions = {}
): RedactionResult[] {
  return texts.map((text) => redactPII(text, options));
}

/**
 * Get redaction statistics for a text
 *
 * @param text - Text to analyze
 * @returns Statistics about what would be redacted
 */
export function getRedactionStats(text: string): {
  totalPII: number;
  byType: Record<PIIType, number>;
  percentageOfText: number;
} {
  const detection = detectPII(text);

  const byType = detection.matches.reduce(
    (acc, match) => {
      acc[match.type] = (acc[match.type] || 0) + 1;
      return acc;
    },
    {} as Record<PIIType, number>
  );

  const piiCharCount = detection.matches.reduce(
    (sum, m) => sum + m.value.length,
    0
  );

  return {
    totalPII: detection.matches.length,
    byType,
    percentageOfText: text.length > 0 ? (piiCharCount / text.length) * 100 : 0,
  };
}
