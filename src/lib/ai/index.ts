/**
 * AI Module
 *
 * Provides AI-powered draft generation for customer support responses.
 * Combines RAG retrieval with LLM completion for context-aware responses.
 *
 * @example
 * ```typescript
 * import {
 *   generateDraft,
 *   needsHumanReview,
 *   getConfidenceLevel,
 *   calculateConfidence
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
 * // Check if it needs review
 * if (needsHumanReview(draft)) {
 *   console.log("Draft needs human review");
 * }
 *
 * // Access confidence details
 * console.log(`Confidence: ${draft.confidenceLevel}`);
 * console.log(`Explanation: ${draft.confidenceExplanation}`);
 * console.log(`Factors: ${JSON.stringify(draft.metadata.confidenceFactors)}`);
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
