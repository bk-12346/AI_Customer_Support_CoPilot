/**
 * AI Draft Generation Pipeline
 *
 * Orchestrates the complete draft generation flow:
 * 1. RAG context retrieval (KB articles + similar tickets)
 * 2. Prompt building with context
 * 3. LLM completion
 * 4. Confidence scoring and response formatting
 *
 * @example
 * ```typescript
 * import { generateDraft } from "@/lib/ai";
 *
 * const draft = await generateDraft({
 *   ticketId: "ticket-123",
 *   customerMessage: "How do I reset my password?",
 *   organizationId: "org-456",
 *   userId: "user-789"
 * });
 *
 * console.log(draft.content);
 * console.log(`Confidence: ${draft.confidenceScore}`);
 * ```
 */

import { buildFullContext, buildMessages } from "@/lib/rag";
import type { AssembledContext, PromptOptions } from "@/lib/rag";
import { generateCompletion } from "@/lib/openai";
import type { ChatCompletionOptions } from "@/lib/openai/chat";
import {
  calculateConfidence as calculateConfidenceScore,
  getConfidenceLevel,
  shouldFlagForReview,
  type ConfidenceResult,
  type ConfidenceFactors,
} from "./confidence";

// ===========================================
// Types
// ===========================================

/**
 * Input for draft generation
 */
export interface DraftInput {
  /** ID of the ticket being responded to */
  ticketId: string;
  /** The customer's message/inquiry */
  customerMessage: string;
  /** Organization ID for scoping RAG search */
  organizationId: string;
  /** ID of the user/agent requesting the draft */
  userId: string;
  /** Optional prompt customization */
  promptOptions?: PromptOptions;
  /** Optional completion options */
  completionOptions?: ChatCompletionOptions;
}

/**
 * Source reference in draft output
 */
export interface DraftSource {
  /** Type of source */
  type: "kb" | "ticket";
  /** Source ID */
  id: string;
  /** Source title */
  title: string;
  /** Similarity score (0-1) */
  similarity: number;
}

/**
 * Metadata about the generation process
 */
export interface DraftMetadata {
  /** Model used for generation */
  model: string;
  /** Number of KB articles retrieved */
  retrievedKbCount: number;
  /** Number of similar tickets retrieved */
  retrievedTicketCount: number;
  /** Total generation time in milliseconds */
  generationTimeMs: number;
  /** Token usage from the completion */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Detailed confidence factors */
  confidenceFactors?: ConfidenceFactors;
}

/**
 * Output from draft generation
 */
export interface DraftOutput {
  /** The generated draft response content */
  content: string;
  /** Confidence score (0-1) based on retrieved context */
  confidenceScore: number;
  /** Human-readable confidence level */
  confidenceLevel: "high" | "medium" | "low";
  /** Human-readable confidence explanation */
  confidenceExplanation: string;
  /** Whether this draft needs human review */
  needsReview: boolean;
  /** Sources used to generate the response */
  sources: DraftSource[];
  /** Metadata about the generation process */
  metadata: DraftMetadata;
}

// ===========================================
// Draft Generation
// ===========================================

/**
 * Generate a draft response for a customer inquiry
 *
 * This is the main entry point for AI-assisted draft generation.
 * It orchestrates:
 * 1. Context retrieval from knowledge base and similar tickets
 * 2. Prompt construction with RAG context
 * 3. LLM completion generation
 * 4. Confidence scoring and response formatting
 *
 * @param input - Draft generation input parameters
 * @returns Promise resolving to the generated draft with metadata
 * @throws Error if context retrieval or generation fails
 *
 * @example
 * ```typescript
 * const draft = await generateDraft({
 *   ticketId: "ticket-123",
 *   customerMessage: "My order hasn't arrived yet",
 *   organizationId: "org-456",
 *   userId: "agent-789"
 * });
 *
 * if (draft.confidenceScore > 0.7) {
 *   // High confidence - ready for review
 * } else {
 *   // Low confidence - may need manual input
 * }
 * ```
 */
export async function generateDraft(input: DraftInput): Promise<DraftOutput> {
  const startTime = Date.now();

  const {
    ticketId,
    customerMessage,
    organizationId,
    userId,
    promptOptions = {},
    completionOptions = {},
  } = input;

  console.log(`[AI] Starting draft generation for ticket ${ticketId}`);
  console.log(`[AI] User: ${userId}, Org: ${organizationId}`);

  // Step 1: Build context using RAG retrieval
  console.log("[AI] Step 1: Retrieving context...");
  let context: AssembledContext;

  try {
    context = await buildFullContext(customerMessage, organizationId, {
      excludeTicketId: ticketId, // Don't include the current ticket in similar results
    });
    console.log(`[AI] Context retrieved: ${context.sources.length} sources, hasContext: ${context.hasContext}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[AI] Context retrieval failed:", errorMessage);
    throw new Error(`Failed to retrieve context: ${errorMessage}`);
  }

  // Step 2: Build messages for LLM
  console.log("[AI] Step 2: Building prompt messages...");
  const messages = buildMessages(customerMessage, context, promptOptions);
  console.log(`[AI] Built ${messages.length} messages for completion`);

  // Step 3: Generate completion
  console.log("[AI] Step 3: Generating completion...");
  let completionResult;

  try {
    completionResult = await generateCompletion(messages, completionOptions);
    console.log(`[AI] Completion generated: ${completionResult.content.length} chars, model: ${completionResult.model}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[AI] Generation failed:", errorMessage);
    throw new Error(`Failed to generate draft: ${errorMessage}`);
  }

  // Step 4: Calculate confidence score using comprehensive scoring
  console.log("[AI] Step 4: Calculating confidence score...");

  // Count sources by type
  const kbSources = context.sources.filter((s) => s.type === "kb");
  const ticketSources = context.sources.filter((s) => s.type === "ticket");

  // Calculate confidence with all factors
  const confidenceResult = calculateConfidenceScore({
    sources: context.sources.map((s) => ({ similarity: s.similarity })),
    queryLength: customerMessage.length,
    kbMatchCount: kbSources.length,
    ticketMatchCount: ticketSources.length,
  });

  console.log(`[AI] Confidence: ${confidenceResult.score.toFixed(2)} (${confidenceResult.level})`);
  console.log(`[AI] Factors: relevance=${confidenceResult.factors.sourceRelevance.toFixed(2)}, coverage=${confidenceResult.factors.sourceCoverage.toFixed(2)}, clarity=${confidenceResult.factors.queryClarity.toFixed(2)}, match=${confidenceResult.factors.contextMatch.toFixed(2)}`);

  // Step 5: Build output
  const endTime = Date.now();
  const generationTimeMs = endTime - startTime;

  // Determine if review is needed
  const needsReview = shouldFlagForReview(confidenceResult) || completionResult.content.length < 50;

  const output: DraftOutput = {
    content: completionResult.content,
    confidenceScore: confidenceResult.score,
    confidenceLevel: confidenceResult.level,
    confidenceExplanation: confidenceResult.explanation,
    needsReview,
    sources: context.sources.map((s) => ({
      type: s.type,
      id: s.id,
      title: s.title,
      similarity: s.similarity,
    })),
    metadata: {
      model: completionResult.model,
      retrievedKbCount: kbSources.length,
      retrievedTicketCount: ticketSources.length,
      generationTimeMs,
      tokenUsage: {
        prompt: completionResult.promptTokens,
        completion: completionResult.completionTokens,
        total: completionResult.totalTokens,
      },
      confidenceFactors: confidenceResult.factors,
    },
  };

  console.log(`[AI] Draft generation complete in ${generationTimeMs}ms`);
  console.log(`[AI] Sources: ${kbSources.length} KB articles, ${ticketSources.length} tickets`);
  console.log(`[AI] Needs review: ${needsReview}`);

  return output;
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Check if a draft should be flagged for human review
 *
 * Uses the draft's needsReview property which is calculated during generation,
 * but also checks for additional conditions.
 *
 * @param draft - The generated draft output
 * @returns True if draft needs review
 */
export function needsHumanReview(draft: DraftOutput): boolean {
  // Use pre-calculated needsReview flag
  if (draft.needsReview) {
    return true;
  }

  // Additional check: very short response might indicate an issue
  if (draft.content.length < 50) {
    return true;
  }

  return false;
}

// Re-export getConfidenceLevel from confidence module for convenience
export { getConfidenceLevel } from "./confidence";
