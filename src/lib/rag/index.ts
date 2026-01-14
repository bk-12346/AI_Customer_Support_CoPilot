/**
 * RAG (Retrieval-Augmented Generation) Module
 *
 * Provides semantic search, retrieval, and context assembly for:
 * - Knowledge base articles
 * - Similar resolved tickets
 * - Ticket conversation history
 * - LLM prompt context building
 *
 * @example
 * ```typescript
 * import {
 *   buildFullContext,
 *   calculateConfidence
 * } from "@/lib/rag";
 *
 * // Build full context for a customer query
 * const context = await buildFullContext(
 *   "How do I reset my password?",
 *   organizationId
 * );
 *
 * // Use in your LLM prompt
 * console.log(context.systemContext);
 * console.log(`Sources: ${context.sources.length}`);
 * console.log(`Confidence: ${calculateConfidence(context)}`);
 * ```
 */

// ===========================================
// Retrieval Functions
// ===========================================
export {
  searchKnowledgeBase,
  searchSimilarTickets,
  getTicketWithMessages,
  formatKnowledgeContext,
  formatConversation,
} from "./retrieval";

// ===========================================
// Context Assembly Functions
// ===========================================
export {
  assembleContext,
  buildFullContext,
  calculateConfidence,
  formatSourcesForDisplay,
} from "./context";

// ===========================================
// Retrieval Types
// ===========================================
export type {
  KnowledgeSearchOptions,
  TicketSearchOptions,
  KnowledgeSearchResult,
  TicketSearchResult,
  TicketWithMessages,
  TicketMessage,
} from "./retrieval";

// ===========================================
// Context Types
// ===========================================
export type {
  SourceReference,
  SimilarTicketContext,
  RetrievedContext,
  AssembledContext,
  ContextAssemblyOptions,
  BuildContextOptions,
} from "./context";
