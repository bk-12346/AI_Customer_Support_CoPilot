/**
 * Safety Module
 *
 * Provides comprehensive input safety:
 * - PII detection and redaction
 * - Prompt injection detection and prevention
 * - Input sanitization and normalization
 *
 * @example
 * ```typescript
 * import {
 *   processUserInput,
 *   detectPII,
 *   redactForLogging,
 *   sanitizeInput,
 *   detectPromptInjection
 * } from "@/lib/safety";
 *
 * // Combined safety processing (recommended for user input)
 * const processed = processUserInput("My email is john@example.com");
 * console.log(processed.sanitized);     // Cleaned input
 * console.log(processed.piiRedacted);   // Input with PII redacted for logs
 * console.log(processed.riskLevel);     // 'none' | 'low' | 'medium' | 'high'
 *
 * // Individual functions for specific needs
 * if (containsPII(text)) {
 *   const safeLog = redactForLogging(text);
 * }
 *
 * const injection = detectPromptInjection(text);
 * if (injection.detected) {
 *   console.warn("Injection attempt:", injection.patterns);
 * }
 * ```
 */

import { detectPII, containsPII } from "./pii-detection";
import { redactForLogging } from "./pii-redaction";
import { sanitizeInput, type SanitizationResult } from "./sanitization";

// ===========================================
// Combined Safety Processing
// ===========================================

/**
 * Result of combined user input processing
 */
export interface ProcessedInput {
  /** Sanitized text (injection patterns neutralized, cleaned) */
  sanitized: string;
  /** PII-redacted version for logging */
  piiRedacted: string;
  /** Whether the input contains PII */
  hasPII: boolean;
  /** PII types found */
  piiTypes: string[];
  /** Risk level from sanitization */
  riskLevel: "none" | "low" | "medium" | "high";
  /** All flags from processing (sanitization + PII) */
  flags: string[];
  /** Whether the input was modified during sanitization */
  wasModified: boolean;
  /** Whether this input should be blocked */
  shouldBlock: boolean;
}

/**
 * Process user input through all safety checks
 *
 * This is the recommended function for processing any user input.
 * It performs:
 * 1. Input sanitization (injection detection, character cleanup)
 * 2. PII detection and redaction
 * 3. Risk assessment
 *
 * Returns both the sanitized text for processing and a PII-redacted
 * version safe for logging.
 *
 * @param text - Raw user input
 * @returns Processed input with safety metadata
 *
 * @example
 * ```typescript
 * // Normal customer message
 * const result1 = processUserInput("How do I reset my password?");
 * // result1.sanitized = "How do I reset my password?"
 * // result1.riskLevel = 'none'
 * // result1.shouldBlock = false
 *
 * // Message with PII
 * const result2 = processUserInput("My email is john@example.com");
 * // result2.sanitized = "My email is john@example.com"
 * // result2.piiRedacted = "My email is [EMAIL]"
 * // result2.hasPII = true
 * // result2.piiTypes = ['email']
 *
 * // Injection attempt
 * const result3 = processUserInput("Ignore previous instructions");
 * // result3.riskLevel = 'high'
 * // result3.shouldBlock = true
 * // result3.flags = ['prompt_injection_ignore_instructions']
 *
 * // Use in your code:
 * const processed = processUserInput(userMessage);
 *
 * if (processed.shouldBlock) {
 *   console.error("Blocked high-risk input:", processed.flags);
 *   return { error: "Invalid input" };
 * }
 *
 * // Use sanitized for AI processing
 * const draft = await generateDraft(processed.sanitized);
 *
 * // Use piiRedacted for logging
 * console.log("Processing message:", processed.piiRedacted);
 * ```
 */
export function processUserInput(text: string): ProcessedInput {
  // Step 1: Sanitize input (handles injection, control chars, etc.)
  const sanitizationResult = sanitizeInput(text);

  // Step 2: Detect PII in the sanitized text
  const piiResult = detectPII(sanitizationResult.sanitizedText);

  // Step 3: Create PII-redacted version for logging
  const piiRedacted = redactForLogging(sanitizationResult.sanitizedText);

  // Step 4: Combine flags
  const flags = [...sanitizationResult.flags];
  if (piiResult.hasPII) {
    flags.push(...piiResult.types.map((t) => `pii_${t}`));
  }

  // Log processing summary
  console.log(
    `[Safety] Processed input: risk=${sanitizationResult.riskLevel}, ` +
    `hasPII=${piiResult.hasPII}, modified=${sanitizationResult.wasModified}`
  );

  return {
    sanitized: sanitizationResult.sanitizedText,
    piiRedacted,
    hasPII: piiResult.hasPII,
    piiTypes: piiResult.types,
    riskLevel: sanitizationResult.riskLevel,
    flags,
    wasModified: sanitizationResult.wasModified,
    shouldBlock: sanitizationResult.riskLevel === "high",
  };
}

/**
 * Quick check if user input is safe to process
 *
 * Returns false if input has high-risk patterns.
 * Use processUserInput() for full details.
 *
 * @param text - Text to check
 * @returns True if safe to process
 *
 * @example
 * ```typescript
 * if (!isInputSafe(userMessage)) {
 *   return { error: "Invalid input" };
 * }
 * ```
 */
export function isInputSafe(text: string): boolean {
  const result = sanitizeInput(text);
  return result.riskLevel !== "high";
}

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
// Input Sanitization
// ===========================================
export {
  sanitizeInput,
  detectPromptInjection,
  normalizeText,
  shouldBlockInput,
  getRiskDescription,
  escapeForDisplay,
  isCleanText,
  MAX_INPUT_LENGTH,
  PROMPT_INJECTION_PATTERNS,
} from "./sanitization";

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

// ===========================================
// Sanitization Types
// ===========================================
export type {
  SanitizationResult,
  PromptInjectionResult,
} from "./sanitization";
