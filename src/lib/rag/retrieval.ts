/**
 * RAG Retrieval Functions
 *
 * Provides semantic search capabilities for knowledge base articles
 * and similar tickets using vector embeddings.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "../openai/embeddings";
import type { Database } from "@/types/database";

// ===========================================
// Types
// ===========================================

/** Options for knowledge base search */
export interface KnowledgeSearchOptions {
  /** Maximum number of results to return (default: 5) */
  matchCount?: number;
  /** Minimum similarity threshold 0-1 (default: 0.7) */
  matchThreshold?: number;
}

/** Options for similar tickets search */
export interface TicketSearchOptions {
  /** Maximum number of results to return (default: 3) */
  matchCount?: number;
  /** Minimum similarity threshold 0-1 (default: 0.7) */
  matchThreshold?: number;
  /** Ticket ID to exclude from results (e.g., current ticket) */
  excludeTicketId?: string;
}

/** Knowledge article search result */
export interface KnowledgeSearchResult {
  id: string;
  title: string;
  content: string;
  source: "zendesk" | "upload" | "generated";
  similarity: number;
}

/** Similar ticket search result */
export interface TicketSearchResult {
  id: string;
  subject: string;
  status: string;
  similarity: number;
}

/** Ticket with messages */
export interface TicketWithMessages {
  id: string;
  zendesk_id: string;
  subject: string;
  status: string;
  priority: string | null;
  requester_email: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
}

/** Ticket message */
export interface TicketMessage {
  id: string;
  author_type: "customer" | "agent" | "system";
  author_email: string;
  body: string;
  is_public: boolean;
  created_at: string;
}

// ===========================================
// Default Configuration
// ===========================================

const DEFAULT_MATCH_COUNT_KB = 5;
const DEFAULT_MATCH_COUNT_TICKETS = 3;
const DEFAULT_MATCH_THRESHOLD = 0.4;

// ===========================================
// Supabase Client
// ===========================================

let _supabaseAdmin: SupabaseClient<Database> | null = null;

/**
 * Get Supabase admin client (service role)
 * Bypasses RLS for server-side operations
 */
function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Missing Supabase environment variables. " +
        "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
      );
    }

    _supabaseAdmin = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return _supabaseAdmin;
}

// ===========================================
// Knowledge Base Search
// ===========================================

/**
 * Search the knowledge base for articles similar to the query
 *
 * Uses vector similarity search via pgvector to find relevant
 * knowledge articles based on semantic meaning.
 *
 * @param query - The search query text
 * @param organizationId - The organization ID to scope the search
 * @param options - Search options (matchCount, matchThreshold)
 * @returns Array of matching articles with similarity scores
 *
 * @example
 * ```typescript
 * const results = await searchKnowledgeBase(
 *   "How do I reset my password?",
 *   "org-uuid-here",
 *   { matchCount: 5, matchThreshold: 0.7 }
 * );
 * ```
 */
export async function searchKnowledgeBase(
  query: string,
  organizationId: string,
  options: KnowledgeSearchOptions = {}
): Promise<KnowledgeSearchResult[]> {
  // Handle empty query
  if (!query || query.trim().length === 0) {
    console.log("[RAG] Empty query, returning no results");
    return [];
  }

  const {
    matchCount = DEFAULT_MATCH_COUNT_KB,
    matchThreshold = DEFAULT_MATCH_THRESHOLD,
  } = options;

  try {
    // Generate embedding for the query
    console.log(`[RAG] Generating embedding for KB search: "${query.substring(0, 50)}..."`);
    const { embedding } = await generateEmbedding(query);

    // Call Supabase RPC function
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("match_knowledge", {
      query_embedding: embedding as unknown as string, // Supabase expects string for vector
      match_threshold: matchThreshold,
      match_count: matchCount,
      org_id: organizationId,
    });

    if (error) {
      throw new Error(`Knowledge base search failed: ${error.message}`);
    }

    const results = (data || []) as KnowledgeSearchResult[];
    console.log(`[RAG] Found ${results.length} KB matches for query`);

    return results;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Knowledge base search error: ${error.message}`);
    }
    throw error;
  }
}

// ===========================================
// Similar Tickets Search
// ===========================================

/**
 * Search for similar resolved tickets
 *
 * Uses vector similarity search to find past tickets that are
 * semantically similar to the query. Only returns solved/closed tickets.
 *
 * @param query - The search query text (typically ticket subject + description)
 * @param organizationId - The organization ID to scope the search
 * @param options - Search options (matchCount, matchThreshold, excludeTicketId)
 * @returns Array of matching tickets with similarity scores
 *
 * @example
 * ```typescript
 * const results = await searchSimilarTickets(
 *   "Customer cannot login to account",
 *   "org-uuid-here",
 *   { matchCount: 3, excludeTicketId: "current-ticket-uuid" }
 * );
 * ```
 */
export async function searchSimilarTickets(
  query: string,
  organizationId: string,
  options: TicketSearchOptions = {}
): Promise<TicketSearchResult[]> {
  // Handle empty query
  if (!query || query.trim().length === 0) {
    console.log("[RAG] Empty query, returning no results");
    return [];
  }

  const {
    matchCount = DEFAULT_MATCH_COUNT_TICKETS,
    matchThreshold = DEFAULT_MATCH_THRESHOLD,
    excludeTicketId,
  } = options;

  try {
    // Generate embedding for the query
    console.log(`[RAG] Generating embedding for ticket search: "${query.substring(0, 50)}..."`);
    const { embedding } = await generateEmbedding(query);

    // Call Supabase RPC function
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("match_similar_tickets", {
      query_embedding: embedding as unknown as string, // Supabase expects string for vector
      match_threshold: matchThreshold,
      match_count: matchCount,
      org_id: organizationId,
      exclude_ticket_id: excludeTicketId || null,
    });

    if (error) {
      throw new Error(`Similar tickets search failed: ${error.message}`);
    }

    const results = (data || []) as TicketSearchResult[];
    console.log(`[RAG] Found ${results.length} similar tickets for query`);

    return results;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Similar tickets search error: ${error.message}`);
    }
    throw error;
  }
}

// ===========================================
// Ticket Retrieval
// ===========================================

/**
 * Get a ticket with all its messages
 *
 * Retrieves the full ticket details including the conversation thread.
 * Messages are ordered by creation time (oldest first).
 *
 * @param ticketId - The ticket UUID
 * @returns Ticket object with messages array, or null if not found
 *
 * @example
 * ```typescript
 * const ticket = await getTicketWithMessages("ticket-uuid-here");
 * if (ticket) {
 *   console.log(`Ticket: ${ticket.subject}`);
 *   console.log(`Messages: ${ticket.messages.length}`);
 * }
 * ```
 */
export async function getTicketWithMessages(
  ticketId: string
): Promise<TicketWithMessages | null> {
  if (!ticketId) {
    throw new Error("Ticket ID is required");
  }

  try {
    const supabase = getSupabaseAdmin();

    // Fetch ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError) {
      if (ticketError.code === "PGRST116") {
        // No rows returned
        console.log(`[RAG] Ticket not found: ${ticketId}`);
        return null;
      }
      throw new Error(`Failed to fetch ticket: ${ticketError.message}`);
    }

    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      throw new Error(`Failed to fetch ticket messages: ${messagesError.message}`);
    }

    console.log(`[RAG] Retrieved ticket ${ticketId} with ${messages?.length || 0} messages`);

    return {
      id: ticket.id,
      zendesk_id: ticket.zendesk_id,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      requester_email: ticket.requester_email,
      tags: ticket.tags || [],
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      messages: (messages || []).map((m) => ({
        id: m.id,
        author_type: m.author_type,
        author_email: m.author_email,
        body: m.body,
        is_public: m.is_public,
        created_at: m.created_at,
      })),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Ticket retrieval error: ${error.message}`);
    }
    throw error;
  }
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Format knowledge results as context string for LLM prompts
 *
 * @param results - Array of knowledge search results
 * @returns Formatted string for use in prompts
 */
export function formatKnowledgeContext(results: KnowledgeSearchResult[]): string {
  if (results.length === 0) {
    return "No relevant knowledge base articles found.";
  }

  return results
    .map((r, i) => `[Article ${i + 1}] ${r.title}\n${r.content}`)
    .join("\n\n---\n\n");
}

/**
 * Format ticket messages as conversation string for LLM prompts
 *
 * @param messages - Array of ticket messages
 * @returns Formatted conversation string
 */
export function formatConversation(messages: TicketMessage[]): string {
  if (messages.length === 0) {
    return "No previous messages.";
  }

  return messages
    .map((m) => {
      const role = m.author_type === "customer" ? "Customer" : "Agent";
      return `[${role}]: ${m.body}`;
    })
    .join("\n\n");
}
