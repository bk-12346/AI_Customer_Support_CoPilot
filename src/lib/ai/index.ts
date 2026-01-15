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
 *   getConfidenceLevel
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
 * // Get confidence level
 * console.log(`Confidence: ${getConfidenceLevel(draft.confidenceScore)}`);
 * ```
 */

// ===========================================
// Main Functions
// ===========================================
export {
  generateDraft,
  needsHumanReview,
  getConfidenceLevel,
} from "./generate-draft";

// ===========================================
// Types
// ===========================================
export type {
  DraftInput,
  DraftOutput,
  DraftSource,
  DraftMetadata,
} from "./generate-draft";
