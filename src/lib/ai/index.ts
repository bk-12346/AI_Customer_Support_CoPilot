/**
 * AI Module
 *
 * Provides AI-powered draft generation for customer support responses.
 * Combines RAG retrieval with LLM completion for context-aware responses.
 * Includes fallback handling for low-confidence scenarios.
 *
 * @example
 * ```typescript
 * import {
 *   generateDraft,
 *   needsHumanReview,
 *   getConfidenceLevel,
 *   calculateConfidence,
 *   isFallbackResponse
 * } from "@/lib/ai";
 *
 * // Generate a draft response
 * const draft = await generateDraft({
 *   ticketId: "ticket-123",
 *   customerMessage: "How do I reset my password?",
 *   organizationId: "org-456",
 *   userId: "agent-789"
 * });
 *
 * // Check if it's a fallback response
 * if (draft.isFallback) {
 *   console.log(`Fallback triggered: ${draft.fallbackReason}`);
 *   console.log(`Suggested actions: ${draft.suggestedActions}`);
 * }
 *
 * // Check if it needs review
 * if (needsHumanReview(draft)) {
 *   console.log("Draft needs human review");
 * }
 *
 * // Access confidence details
 * console.log(`Confidence: ${draft.confidenceLevel}`);
 * console.log(`Explanation: ${draft.confidenceExplanation}`);
 * ```
 */

// ===========================================
// Draft Generation
// ===========================================
export {
  generateDraft,
  needsHumanReview,
  getConfidenceLevel,
} from "./generate-draft";

// ===========================================
// Confidence Scoring
// ===========================================
export {
  calculateConfidence,
  getConfidenceExplanation,
  shouldFlagForReview,
  getConfidenceSummary,
  CONFIDENCE_WEIGHTS,
  CONFIDENCE_THRESHOLDS,
} from "./confidence";

// ===========================================
// Draft Types
// ===========================================
export type {
  DraftInput,
  DraftOutput,
  DraftSource,
  DraftMetadata,
} from "./generate-draft";

// ===========================================
// Confidence Types
// ===========================================
export type {
  ConfidenceFactors,
  ConfidenceResult,
  ConfidenceParams,
} from "./confidence";

// ===========================================
// Fallback Handling
// ===========================================
export {
  shouldUseFallback,
  getFallbackReason,
  generateFallbackResponse,
  generateErrorFallback,
  getFallbackReasonDescription,
  isFallbackResponse,
  FALLBACK_THRESHOLDS,
} from "./fallback";

// ===========================================
// Fallback Types
// ===========================================
export type { FallbackReason, FallbackResponse } from "./fallback";
