/**
 * RAG Context Assembly
 *
 * Assembles retrieved knowledge and ticket context into
 * structured prompts for LLM-based response generation.
 */

import {
  searchKnowledgeBase,
  searchSimilarTickets,
  getTicketWithMessages,
  type KnowledgeSearchResult,
  type TicketSearchResult,
  type TicketMessage,
} from "./retrieval";

// ===========================================
// Types
// ===========================================

/** Source reference for attribution */
export interface SourceReference {
  /** Type of source */
  type: "kb" | "ticket";
  /** Source ID (article or ticket UUID) */
  id: string;
  /** Title or subject */
  title: string;
  /** Similarity score (0-1) */
  similarity: number;
}

/** Similar ticket with resolution details */
export interface SimilarTicketContext {
  /** Ticket ID */
  id: string;
  /** Ticket subject */
  subject: string;
  /** Relevant messages from the ticket */
  messages: TicketMessage[];
  /** The resolution message (agent's final response) */
  resolution: string | null;
  /** Similarity score */
  similarity: number;
}

/** Retrieved context from RAG search */
export interface RetrievedContext {
  /** Matching knowledge base articles */
  kbArticles: Array<{
    id: string;
    title: string;
    content: string;
    similarity: number;
  }>;
  /** Similar resolved tickets with their resolutions */
  similarTickets: Array<SimilarTicketContext>;
  /** Total number of sources retrieved */
  totalSources: number;
}

/** Assembled context ready for LLM prompt */
export interface AssembledContext {
  /** Formatted context string for the system prompt */
  systemContext: string;
  /** Source references for attribution */
  sources: SourceReference[];
  /** Whether any relevant context was found */
  hasContext: boolean;
}

/** Options for context assembly */
export interface ContextAssemblyOptions {
  /** Maximum KB articles to include (default: 3) */
  maxKbArticles?: number;
  /** Maximum similar tickets to include (default: 2) */
  maxTickets?: number;
  /** Maximum total context length in characters (default: 4000) */
  maxContextLength?: number;
}

/** Options for building full context */
export interface BuildContextOptions extends ContextAssemblyOptions {
  /** Similarity threshold for KB search (default: 0.4) */
  kbThreshold?: number;
  /** Similarity threshold for ticket search (default: 0.4) */
  ticketThreshold?: number;
  /** Ticket ID to exclude from similar tickets search */
  excludeTicketId?: string;
}

// ===========================================
// Default Configuration
// ===========================================

const DEFAULT_MAX_KB_ARTICLES = 3;
const DEFAULT_MAX_TICKETS = 2;
const DEFAULT_MAX_CONTEXT_LENGTH = 4000;
const DEFAULT_KB_THRESHOLD = 0.4;
const DEFAULT_TICKET_THRESHOLD = 0.4;

// ===========================================
// Context Assembly
// ===========================================

/**
 * Assemble retrieved context into a structured prompt string
 *
 * Takes retrieved KB articles and similar tickets and formats them
 * into a structured string suitable for LLM prompts, with source tracking.
 *
 * @param retrieved - Retrieved context from RAG search
 * @param options - Assembly options
 * @returns Assembled context with formatted string and sources
 *
 * @example
 * ```typescript
 * const assembled = assembleContext(retrieved, {
 *   maxKbArticles: 3,
 *   maxTickets: 2,
 *   maxContextLength: 4000
 * });
 * console.log(assembled.systemContext);
 * ```
 */
export function assembleContext(
  retrieved: RetrievedContext,
  options: ContextAssemblyOptions = {}
): AssembledContext {
  const {
    maxKbArticles = DEFAULT_MAX_KB_ARTICLES,
    maxTickets = DEFAULT_MAX_TICKETS,
    maxContextLength = DEFAULT_MAX_CONTEXT_LENGTH,
  } = options;

  const sources: SourceReference[] = [];
  const contextParts: string[] = [];
  let currentLength = 0;

  // Sort by similarity (highest first)
  const sortedArticles = [...retrieved.kbArticles]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxKbArticles);

  const sortedTickets = [...retrieved.similarTickets]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxTickets);

  // Format KB articles
  if (sortedArticles.length > 0) {
    const kbSection = formatKBSection(sortedArticles, maxContextLength - currentLength);
    if (kbSection.content) {
      contextParts.push(kbSection.content);
      currentLength += kbSection.content.length;
      sources.push(...kbSection.sources);
    }
  }

  // Format similar tickets
  if (sortedTickets.length > 0 && currentLength < maxContextLength) {
    const ticketSection = formatTicketSection(
      sortedTickets,
      maxContextLength - currentLength
    );
    if (ticketSection.content) {
      contextParts.push(ticketSection.content);
      currentLength += ticketSection.content.length;
      sources.push(...ticketSection.sources);
    }
  }

  // Handle no context case
  if (contextParts.length === 0) {
    return {
      systemContext: "No relevant knowledge base articles or similar tickets found. Please provide a helpful response based on general customer service best practices.",
      sources: [],
      hasContext: false,
    };
  }

  return {
    systemContext: contextParts.join("\n\n"),
    sources,
    hasContext: true,
  };
}

/**
 * Format knowledge base articles section
 */
function formatKBSection(
  articles: Array<{ id: string; title: string; content: string; similarity: number }>,
  maxLength: number
): { content: string; sources: SourceReference[] } {
  const sources: SourceReference[] = [];
  const lines: string[] = ["KNOWLEDGE BASE:"];
  let currentLength = lines[0].length;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const header = `\n\n[Article ${i + 1}: ${article.title}]`;
    const content = `\n${truncateContent(article.content, 800)}`; // Limit each article

    const sectionLength = header.length + content.length;

    // Check if adding this article would exceed limit
    if (currentLength + sectionLength > maxLength && i > 0) {
      break; // Keep at least one article if possible
    }

    lines.push(header);
    lines.push(content);
    currentLength += sectionLength;

    sources.push({
      type: "kb",
      id: article.id,
      title: article.title,
      similarity: article.similarity,
    });
  }

  return {
    content: sources.length > 0 ? lines.join("") : "",
    sources,
  };
}

/**
 * Format similar tickets section
 */
function formatTicketSection(
  tickets: SimilarTicketContext[],
  maxLength: number
): { content: string; sources: SourceReference[] } {
  const sources: SourceReference[] = [];
  const lines: string[] = ["SIMILAR RESOLVED TICKETS:"];
  let currentLength = lines[0].length;

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];

    // Get customer message (first customer message or last one)
    const customerMessages = ticket.messages.filter((m) => m.author_type === "customer");
    const customerMessage = customerMessages[0]?.body || "No customer message available";

    // Build ticket section
    const header = `\n\n[Ticket ${i + 1}: ${ticket.subject}]`;
    const customerPart = `\nCustomer: ${truncateContent(customerMessage, 300)}`;
    const resolutionPart = ticket.resolution
      ? `\nResolution: ${truncateContent(ticket.resolution, 500)}`
      : "\nResolution: No resolution recorded";

    const sectionLength = header.length + customerPart.length + resolutionPart.length;

    // Check if adding this ticket would exceed limit
    if (currentLength + sectionLength > maxLength && i > 0) {
      break;
    }

    lines.push(header);
    lines.push(customerPart);
    lines.push(resolutionPart);
    currentLength += sectionLength;

    sources.push({
      type: "ticket",
      id: ticket.id,
      title: ticket.subject,
      similarity: ticket.similarity,
    });
  }

  return {
    content: sources.length > 0 ? lines.join("") : "",
    sources,
  };
}

/**
 * Truncate content to a maximum length, adding ellipsis if truncated
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength - 3) + "...";
}

// ===========================================
// Full Context Builder
// ===========================================

/**
 * Build full context for a query in a single call
 *
 * Performs knowledge base search, similar ticket search,
 * fetches ticket details, and assembles everything into
 * a ready-to-use context for LLM generation.
 *
 * @param query - The search query (customer's question/message)
 * @param organizationId - Organization ID to scope the search
 * @param options - Build options
 * @returns Assembled context ready for prompt
 *
 * @example
 * ```typescript
 * const context = await buildFullContext(
 *   "How do I reset my password?",
 *   organizationId,
 *   { maxKbArticles: 3, maxTickets: 2 }
 * );
 *
 * // Use in prompt
 * const prompt = `
 *   ${context.systemContext}
 *
 *   Customer question: ${customerMessage}
 * `;
 * ```
 */
export async function buildFullContext(
  query: string,
  organizationId: string,
  options: BuildContextOptions = {}
): Promise<AssembledContext> {
  const {
    maxKbArticles = DEFAULT_MAX_KB_ARTICLES,
    maxTickets = DEFAULT_MAX_TICKETS,
    maxContextLength = DEFAULT_MAX_CONTEXT_LENGTH,
    kbThreshold = DEFAULT_KB_THRESHOLD,
    ticketThreshold = DEFAULT_TICKET_THRESHOLD,
    excludeTicketId,
  } = options;

  console.log(`[RAG] Building context for query: "${query.substring(0, 50)}..."`);

  try {
    // Perform searches in parallel
    const [kbResults, ticketResults] = await Promise.all([
      searchKnowledgeBase(query, organizationId, {
        matchCount: maxKbArticles + 2, // Fetch extra in case some get filtered
        matchThreshold: kbThreshold,
      }),
      searchSimilarTickets(query, organizationId, {
        matchCount: maxTickets + 1,
        matchThreshold: ticketThreshold,
        excludeTicketId,
      }),
    ]);

    console.log(`[RAG] Found ${kbResults.length} KB articles, ${ticketResults.length} similar tickets`);

    // Fetch full ticket details for similar tickets
    const similarTickets = await fetchTicketDetails(ticketResults);

    // Build retrieved context
    const retrieved: RetrievedContext = {
      kbArticles: kbResults.map((r) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        similarity: r.similarity,
      })),
      similarTickets,
      totalSources: kbResults.length + similarTickets.length,
    };

    // Assemble context
    const assembled = assembleContext(retrieved, {
      maxKbArticles,
      maxTickets,
      maxContextLength,
    });

    console.log(`[RAG] Assembled context with ${assembled.sources.length} sources, hasContext: ${assembled.hasContext}`);

    return assembled;
  } catch (error) {
    console.error("[RAG] Error building context:", error);

    // Return empty context on error
    return {
      systemContext: "Unable to retrieve context. Please provide a helpful response based on general customer service best practices.",
      sources: [],
      hasContext: false,
    };
  }
}

/**
 * Fetch full ticket details for similar ticket results
 */
async function fetchTicketDetails(
  ticketResults: TicketSearchResult[]
): Promise<SimilarTicketContext[]> {
  const ticketsWithDetails: SimilarTicketContext[] = [];

  for (const result of ticketResults) {
    try {
      const ticket = await getTicketWithMessages(result.id);

      if (ticket) {
        // Find the resolution (last agent message)
        const agentMessages = ticket.messages.filter(
          (m) => m.author_type === "agent" && m.is_public
        );
        const resolution = agentMessages[agentMessages.length - 1]?.body || null;

        ticketsWithDetails.push({
          id: ticket.id,
          subject: ticket.subject,
          messages: ticket.messages,
          resolution,
          similarity: result.similarity,
        });
      }
    } catch (error) {
      console.warn(`[RAG] Failed to fetch ticket ${result.id}:`, error);
      // Continue with other tickets
    }
  }

  return ticketsWithDetails;
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Calculate confidence score based on retrieved context
 *
 * Returns a confidence score (0-1) based on the quality
 * and quantity of retrieved sources.
 *
 * @param context - Assembled context
 * @returns Confidence score (0-1)
 */
export function calculateConfidence(context: AssembledContext): number {
  if (!context.hasContext || context.sources.length === 0) {
    return 0.3; // Low confidence with no context
  }

  // Base score from number of sources
  const sourceScore = Math.min(context.sources.length / 5, 1) * 0.4;

  // Similarity score (average of top sources)
  const topSources = context.sources.slice(0, 3);
  const avgSimilarity =
    topSources.reduce((sum, s) => sum + s.similarity, 0) / topSources.length;
  const similarityScore = avgSimilarity * 0.6;

  return Math.min(sourceScore + similarityScore, 1);
}

/**
 * Format sources for display in the response
 *
 * @param sources - Array of source references
 * @returns Formatted string listing sources
 */
export function formatSourcesForDisplay(sources: SourceReference[]): string {
  if (sources.length === 0) {
    return "";
  }

  const kbSources = sources.filter((s) => s.type === "kb");
  const ticketSources = sources.filter((s) => s.type === "ticket");

  const parts: string[] = [];

  if (kbSources.length > 0) {
    parts.push(
      "**Knowledge Base:**\n" +
        kbSources.map((s) => `- ${s.title}`).join("\n")
    );
  }

  if (ticketSources.length > 0) {
    parts.push(
      "**Similar Tickets:**\n" +
        ticketSources.map((s) => `- ${s.title}`).join("\n")
    );
  }

  return parts.join("\n\n");
}
