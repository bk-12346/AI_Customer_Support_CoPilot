/**
 * RAG (Retrieval-Augmented Generation) Module
 *
 * Provides semantic search and retrieval capabilities for:
 * - Knowledge base articles
 * - Similar resolved tickets
 * - Ticket conversation history
 *
 * @example
 * ```typescript
 * import {
 *   searchKnowledgeBase,
 *   searchSimilarTickets,
 *   getTicketWithMessages,
 *   formatKnowledgeContext
 * } from "@/lib/rag";
 *
 * // Search knowledge base
 * const kbResults = await searchKnowledgeBase(
 *   "How do I reset my password?",
 *   organizationId
 * );
 *
 * // Format for LLM prompt
 * const context = formatKnowledgeContext(kbResults);
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
// Types
// ===========================================
export type {
  KnowledgeSearchOptions,
  TicketSearchOptions,
  KnowledgeSearchResult,
  TicketSearchResult,
  TicketWithMessages,
  TicketMessage,
} from "./retrieval";
