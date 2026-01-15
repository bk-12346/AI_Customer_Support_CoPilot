/**
 * Safety Module
 *
 * Provides PII detection and redaction for input sanitization.
 * Use these functions to protect user privacy and ensure safe logging.
 *
 * @example
 * ```typescript
 * import {
 *   detectPII,
 *   redactPII,
 *   redactForLogging,
 *   containsPII
 * } from "@/lib/safety";
 *
 * // Check if text contains PII
 * const userInput = "My email is john@example.com";
 * if (containsPII(userInput)) {
 *   // Redact for safe logging
 *   const safeText = redactForLogging(userInput);
 *   console.log(safeText); // "My email is [EMAIL]"
 * }
 *
 * // Get detailed detection info
 * const detection = detectPII(userInput);
 * console.log(detection.types); // ['email']
 *
 * // Redact with custom options
 * const masked = redactPII(userInput, { replacement: 'mask' });
 * console.log(masked.redactedText); // "My email is ****@*******.***"
 * ```
 */

// ===========================================
// PII Detection
// ===========================================
export {
  detectPII,
  detectEmails,
  detectPhones,
  detectSSNs,
  detectCreditCards,
  detectIPAddresses,
  detectAddresses,
  containsPII,
  getPIISummary,
} from "./pii-detection";

// ===========================================
// PII Redaction
// ===========================================
export {
  redactPII,
  redactForLogging,
  redactWithMask,
  removePII,
  redactPIIBatch,
  getRedactionStats,
} from "./pii-redaction";

// ===========================================
// Detection Types
// ===========================================
export type {
  PIIType,
  PIIMatch,
  PIIDetectionResult,
} from "./pii-detection";

// ===========================================
// Redaction Types
// ===========================================
export type {
  RedactionOptions,
  RedactionResult,
} from "./pii-redaction";
