/**
 * Fallback Handling for Low-Confidence Scenarios
 *
 * Provides graceful degradation when AI draft generation
 * cannot produce a reliable response. Fallback responses
 * are professional templates that guide agents on next steps.
 *
 * @example
 * ```typescript
 * import {
 *   shouldUseFallback,
 *   getFallbackReason,
 *   generateFallbackResponse
 * } from "@/lib/ai/fallback";
 *
 * if (shouldUseFallback(confidenceScore, sourcesCount)) {
 *   const reason = getFallbackReason(confidenceScore, sourcesCount, queryLength);
 *   const fallback = generateFallbackResponse(reason, customerMessage);
 *   // Use fallback.content instead of AI-generated draft
 * }
 * ```
 */

// ===========================================
// Types
// ===========================================

/**
 * Reasons why a fallback response is used instead of AI generation
 */
export type FallbackReason =
  | "no_sources"       // No relevant KB articles or tickets found
  | "low_similarity"   // Sources found but similarity too low
  | "unclear_query"    // Customer query too short or too long
  | "generation_error"; // AI generation failed

/**
 * A fallback response with suggested agent actions
 */
export interface FallbackResponse {
  /** The fallback response content */
  content: string;
  /** Always true for fallback responses */
  isFallback: true;
  /** Why fallback was triggered */
  reason: FallbackReason;
  /** Suggested actions for the agent */
  suggestedActions: string[];
}

// ===========================================
// Configuration
// ===========================================

/**
 * Thresholds for fallback triggering
 */
export const FALLBACK_THRESHOLDS = {
  /** Minimum confidence required when sources exist */
  MIN_CONFIDENCE_WITH_SOURCES: 0.4,
  /** Minimum confidence required regardless of sources */
  MIN_CONFIDENCE_ABSOLUTE: 0.3,
  /** Minimum query length for clarity */
  MIN_QUERY_LENGTH: 10,
  /** Maximum query length before considered unfocused */
  MAX_QUERY_LENGTH: 1000,
} as const;

// ===========================================
// Fallback Templates
// ===========================================

/**
 * Response templates by fallback reason
 */
const FALLBACK_TEMPLATES: Record<
  FallbackReason,
  { content: string; actions: string[] }
> = {
  no_sources: {
    content:
      "Thank you for reaching out. I want to make sure I give you accurate information. " +
      "Let me look into this further and get back to you shortly, or I'll connect you " +
      "with a team member who can help with your specific question.",
    actions: [
      "Escalate to senior agent",
      "Search for more context",
      "Request clarification from customer",
    ],
  },

  low_similarity: {
    content:
      "Thank you for contacting us. I found some related information, but I want to " +
      "make sure I address your specific situation correctly. Could you provide a bit " +
      "more detail about your question, or I can connect you with a specialist?",
    actions: [
      "Request more details",
      "Escalate to specialist",
      "Review similar cases manually",
    ],
  },

  unclear_query: {
    content:
      "Thank you for reaching out. To help you better, could you provide more details " +
      "about your question or issue? Specifically, it would help to know what product " +
      "or service you're asking about, what you were trying to do, and any error " +
      "messages you may have received.",
    actions: [
      "Request clarification",
      "Send FAQ links",
      "Offer callback",
    ],
  },

  generation_error: {
    content:
      "Thank you for your patience. I'm having trouble processing your request right now. " +
      "A team member will review your inquiry and respond shortly.",
    actions: [
      "Manual review required",
      "Escalate immediately",
    ],
  },
};

// ===========================================
// Main Functions
// ===========================================

/**
 * Determine if a fallback response should be used
 *
 * Fallback is triggered when confidence is too low to trust
 * the AI-generated response.
 *
 * @param confidenceScore - The calculated confidence score (0-1)
 * @param sourcesCount - Number of sources retrieved
 * @returns True if fallback should be used
 *
 * @example
 * ```typescript
 * if (shouldUseFallback(0.25, 0)) {
 *   // Use fallback - no sources and very low confidence
 * }
 * ```
 */
export function shouldUseFallback(
  confidenceScore: number,
  sourcesCount: number
): boolean {
  const { MIN_CONFIDENCE_WITH_SOURCES, MIN_CONFIDENCE_ABSOLUTE } = FALLBACK_THRESHOLDS;

  // Always use fallback if confidence is extremely low
  if (confidenceScore < MIN_CONFIDENCE_ABSOLUTE) {
    console.log(
      `[Fallback] Triggered: confidence ${confidenceScore.toFixed(2)} < absolute minimum ${MIN_CONFIDENCE_ABSOLUTE}`
    );
    return true;
  }

  // Use fallback if no sources AND confidence below threshold
  if (confidenceScore < MIN_CONFIDENCE_WITH_SOURCES && sourcesCount === 0) {
    console.log(
      `[Fallback] Triggered: confidence ${confidenceScore.toFixed(2)} < ${MIN_CONFIDENCE_WITH_SOURCES} with 0 sources`
    );
    return true;
  }

  return false;
}

/**
 * Determine the reason for using a fallback response
 *
 * Analyzes the confidence factors to identify the primary
 * cause of low confidence.
 *
 * @param confidenceScore - The calculated confidence score (0-1)
 * @param sourcesCount - Number of sources retrieved
 * @param queryLength - Length of the customer query
 * @returns The primary reason for fallback
 *
 * @example
 * ```typescript
 * const reason = getFallbackReason(0.35, 2, 5);
 * // Returns 'unclear_query' because query is too short
 * ```
 */
export function getFallbackReason(
  confidenceScore: number,
  sourcesCount: number,
  queryLength: number
): FallbackReason {
  const { MIN_QUERY_LENGTH, MAX_QUERY_LENGTH } = FALLBACK_THRESHOLDS;

  // Check query clarity first (quick wins for user)
  if (queryLength < MIN_QUERY_LENGTH || queryLength > MAX_QUERY_LENGTH) {
    console.log(
      `[Fallback] Reason: unclear_query (length: ${queryLength}, acceptable: ${MIN_QUERY_LENGTH}-${MAX_QUERY_LENGTH})`
    );
    return "unclear_query";
  }

  // Check for no sources
  if (sourcesCount === 0) {
    console.log("[Fallback] Reason: no_sources");
    return "no_sources";
  }

  // Check for low similarity with existing sources
  if (sourcesCount > 0 && confidenceScore < 0.4) {
    console.log(
      `[Fallback] Reason: low_similarity (score: ${confidenceScore.toFixed(2)}, sources: ${sourcesCount})`
    );
    return "low_similarity";
  }

  // Default to generation error
  console.log("[Fallback] Reason: generation_error (default)");
  return "generation_error";
}

/**
 * Generate a fallback response for a given reason
 *
 * Returns a professional, helpful response template with
 * suggested actions for the agent.
 *
 * @param reason - The reason for fallback
 * @param customerMessage - The original customer message (for potential customization)
 * @returns A fallback response with content and suggested actions
 *
 * @example
 * ```typescript
 * const fallback = generateFallbackResponse('no_sources', 'How do I do X?');
 * console.log(fallback.content);
 * console.log(fallback.suggestedActions);
 * ```
 */
export function generateFallbackResponse(
  reason: FallbackReason,
  customerMessage: string
): FallbackResponse {
  const template = FALLBACK_TEMPLATES[reason];

  console.log(`[Fallback] Generating response for reason: ${reason}`);
  console.log(`[Fallback] Customer message preview: "${customerMessage.substring(0, 50)}..."`);

  return {
    content: template.content,
    isFallback: true,
    reason,
    suggestedActions: [...template.actions], // Copy to prevent mutation
  };
}

/**
 * Generate a fallback response for generation errors
 *
 * Convenience function for error handling scenarios.
 *
 * @param error - The error that occurred
 * @param customerMessage - The original customer message
 * @returns A fallback response for the error
 */
export function generateErrorFallback(
  error: Error,
  customerMessage: string
): FallbackResponse {
  console.error(`[Fallback] Generation error: ${error.message}`);

  return generateFallbackResponse("generation_error", customerMessage);
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Get a human-readable description of the fallback reason
 *
 * @param reason - The fallback reason
 * @returns Human-readable description
 */
export function getFallbackReasonDescription(reason: FallbackReason): string {
  const descriptions: Record<FallbackReason, string> = {
    no_sources: "No relevant knowledge base articles or similar tickets found",
    low_similarity: "Retrieved sources have low relevance to the query",
    unclear_query: "Customer query is too brief or too long to process effectively",
    generation_error: "An error occurred during response generation",
  };

  return descriptions[reason];
}

/**
 * Check if a response is a fallback response
 *
 * Type guard for distinguishing fallback from generated responses.
 *
 * @param response - Any response object
 * @returns True if this is a fallback response
 */
export function isFallbackResponse(
  response: { isFallback?: boolean }
): response is FallbackResponse {
  return response.isFallback === true;
}
