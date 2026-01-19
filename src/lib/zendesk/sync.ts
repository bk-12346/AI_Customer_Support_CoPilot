/**
 * Zendesk Sync Service
 *
 * Provides functions to sync tickets and KB articles from Zendesk
 * to the local database with embeddings for RAG.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getZendeskClient } from "./oauth";
import { ZendeskClient } from "./client";
import { generateEmbedding } from "../openai/embeddings";
import type { ZendeskTicket, ZendeskComment, ZendeskUser, ZendeskArticle } from "@/types/zendesk";

// ===========================================
// Types
// ===========================================

export interface SyncResult {
  success: boolean;
  ticketsSynced: number;
  messagesSynced: number;
  errors: string[];
  duration: number;
}

export interface ArticleSyncResult {
  success: boolean;
  articlesSynced: number;
  errors: string[];
  duration: number;
}

type SyncType = "tickets" | "kb_articles";
type SyncStatus = "idle" | "running" | "failed";

interface SyncState {
  id: string;
  organization_id: string;
  sync_type: SyncType;
  last_sync_at: string | null;
  last_synced_cursor: string | null;
  status: SyncStatus;
  error_message: string | null;
}

// ===========================================
// Configuration
// ===========================================

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;

// ===========================================
// Supabase Client
// ===========================================

function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables not configured");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ===========================================
// Sync State Management
// ===========================================

async function getSyncState(
  supabase: SupabaseClient,
  organizationId: string,
  syncType: SyncType
): Promise<SyncState | null> {
  const { data, error } = await supabase
    .from("sync_state")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("sync_type", syncType)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get sync state: ${error.message}`);
  }

  return data as SyncState | null;
}

async function updateSyncState(
  supabase: SupabaseClient,
  organizationId: string,
  syncType: SyncType,
  updates: Partial<Pick<SyncState, "status" | "last_sync_at" | "last_synced_cursor" | "error_message">>
): Promise<void> {
  const { error } = await supabase
    .from("sync_state")
    .upsert(
      {
        organization_id: organizationId,
        sync_type: syncType,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,sync_type" }
    );

  if (error) {
    console.error("Failed to update sync state:", error);
  }
}

// ===========================================
// Helper Functions
// ===========================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate embedding text for a ticket (subject + description)
 */
function getTicketEmbeddingText(ticket: ZendeskTicket): string {
  return `${ticket.subject}\n\n${ticket.description || ""}`.trim();
}

/**
 * Generate embedding text for a KB article (title repeated + body)
 */
function getArticleEmbeddingText(article: ZendeskArticle): string {
  // Repeat title to boost its weight (same as seed-kb)
  const plainBody = article.body.replace(/<[^>]*>/g, " ").trim();
  return `${article.title}\n\n${article.title}\n\n${plainBody}`;
}

/**
 * Determine author type from Zendesk comment
 */
function getAuthorType(
  comment: ZendeskComment,
  usersMap: Map<number, ZendeskUser>,
  requesterId: number
): "customer" | "agent" | "system" {
  if (comment.author_id === requesterId) {
    return "customer";
  }

  const user = usersMap.get(comment.author_id);
  if (user) {
    if (user.role === "end-user") {
      return "customer";
    }
    if (user.role === "agent" || user.role === "admin") {
      return "agent";
    }
  }

  return "system";
}

// ===========================================
// Ticket Sync
// ===========================================

/**
 * Sync tickets from Zendesk for an organization
 *
 * @param organizationId - The organization UUID
 * @param options.fullSync - If true, sync all tickets; otherwise incremental
 * @returns SyncResult with counts and any errors
 */
export async function syncTickets(
  organizationId: string,
  options: { fullSync?: boolean } = {}
): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    success: false,
    ticketsSynced: 0,
    messagesSynced: 0,
    errors: [],
    duration: 0,
  };

  const supabase = getSupabaseAdmin();

  try {
    // Get Zendesk client
    const client = await getZendeskClient(organizationId);
    if (!client) {
      result.errors.push("Zendesk not connected for this organization");
      return result;
    }

    // Get current sync state
    const syncState = await getSyncState(supabase, organizationId, "tickets");

    // Check if sync is already running
    if (syncState?.status === "running") {
      result.errors.push("Sync already in progress");
      return result;
    }

    // Mark sync as running
    await updateSyncState(supabase, organizationId, "tickets", {
      status: "running",
      error_message: null,
    });

    // Determine sync parameters
    const updatedSince = !options.fullSync && syncState?.last_sync_at
      ? new Date(syncState.last_sync_at)
      : undefined;

    // Fetch tickets
    let pageUrl: string | undefined;
    let allTickets: ZendeskTicket[] = [];

    do {
      const response = await client.getTickets({
        updatedSince,
        pageUrl,
      });
      allTickets.push(...response.data);
      pageUrl = response.nextPage || undefined;

      // Rate limiting
      if (pageUrl) {
        await sleep(BATCH_DELAY_MS);
      }
    } while (pageUrl && allTickets.length < 1000); // Limit for safety

    console.log(`[Sync] Fetched ${allTickets.length} tickets from Zendesk`);

    // Collect all user IDs for batch fetch
    const userIds = new Set<number>();
    for (const ticket of allTickets) {
      userIds.add(ticket.requester_id);
      if (ticket.assignee_id) userIds.add(ticket.assignee_id);
    }

    // Fetch users
    const users = await client.getUsers([...userIds]);
    const usersMap = new Map(users.map((u) => [u.id, u]));

    // Process tickets in batches
    for (let i = 0; i < allTickets.length; i += BATCH_SIZE) {
      const batch = allTickets.slice(i, i + BATCH_SIZE);

      for (const ticket of batch) {
        try {
          // Get requester email
          const requester = usersMap.get(ticket.requester_id);
          const requesterEmail = requester?.email || "unknown@example.com";

          // Generate embedding
          const embeddingText = getTicketEmbeddingText(ticket);
          const { embedding } = await generateEmbedding(embeddingText);

          // Upsert ticket
          const { data: ticketData, error: ticketError } = await supabase
            .from("tickets")
            .upsert(
              {
                zendesk_id: ticket.id.toString(),
                organization_id: organizationId,
                subject: ticket.subject,
                status: ticket.status,
                priority: ticket.priority,
                requester_email: requesterEmail,
                tags: ticket.tags,
                zendesk_created_at: ticket.created_at,
                zendesk_updated_at: ticket.updated_at,
                embedding,
              },
              { onConflict: "organization_id,zendesk_id" }
            )
            .select("id")
            .single();

          if (ticketError) {
            result.errors.push(`Ticket ${ticket.id}: ${ticketError.message}`);
            continue;
          }

          result.ticketsSynced++;

          // Fetch and sync comments
          const comments = await client.getAllTicketComments(ticket.id);

          for (const comment of comments) {
            // Check if message already exists
            const { data: existingMessage } = await supabase
              .from("ticket_messages")
              .select("id")
              .eq("ticket_id", ticketData.id)
              .eq("zendesk_id", comment.id.toString())
              .single();

            if (existingMessage) {
              continue; // Skip existing messages
            }

            const authorType = getAuthorType(comment, usersMap, ticket.requester_id);
            const author = usersMap.get(comment.author_id);

            const { error: messageError } = await supabase
              .from("ticket_messages")
              .insert({
                ticket_id: ticketData.id,
                zendesk_id: comment.id.toString(),
                author_type: authorType,
                author_email: author?.email || "unknown@example.com",
                body: comment.body,
                is_public: comment.public,
                created_at: comment.created_at,
              });

            if (!messageError) {
              result.messagesSynced++;
            }
          }
        } catch (error) {
          result.errors.push(
            `Ticket ${ticket.id}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      // Rate limiting between batches
      if (i + BATCH_SIZE < allTickets.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    // Update sync state
    await updateSyncState(supabase, organizationId, "tickets", {
      status: "idle",
      last_sync_at: new Date().toISOString(),
      error_message: result.errors.length > 0 ? result.errors.join("; ") : null,
    });

    result.success = result.errors.length === 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(errorMessage);

    await updateSyncState(supabase, organizationId, "tickets", {
      status: "failed",
      error_message: errorMessage,
    });
  }

  result.duration = Date.now() - startTime;
  return result;
}

// ===========================================
// KB Article Sync
// ===========================================

/**
 * Sync Help Center articles from Zendesk for an organization
 *
 * @param organizationId - The organization UUID
 * @param options.fullSync - If true, sync all articles; otherwise incremental
 * @returns ArticleSyncResult with counts and any errors
 */
export async function syncKBArticles(
  organizationId: string,
  options: { fullSync?: boolean; locale?: string } = {}
): Promise<ArticleSyncResult> {
  const startTime = Date.now();
  const result: ArticleSyncResult = {
    success: false,
    articlesSynced: 0,
    errors: [],
    duration: 0,
  };

  const supabase = getSupabaseAdmin();

  try {
    // Get Zendesk client
    const client = await getZendeskClient(organizationId);
    if (!client) {
      result.errors.push("Zendesk not connected for this organization");
      return result;
    }

    // Get current sync state
    const syncState = await getSyncState(supabase, organizationId, "kb_articles");

    // Check if sync is already running
    if (syncState?.status === "running") {
      result.errors.push("Sync already in progress");
      return result;
    }

    // Mark sync as running
    await updateSyncState(supabase, organizationId, "kb_articles", {
      status: "running",
      error_message: null,
    });

    // Determine sync parameters
    const updatedSince = !options.fullSync && syncState?.last_sync_at
      ? new Date(syncState.last_sync_at)
      : undefined;

    // Fetch all articles
    const articles = await client.getAllArticles({
      locale: options.locale,
      updatedSince,
    });

    console.log(`[Sync] Fetched ${articles.length} articles from Zendesk Help Center`);

    // Process articles in batches
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);

      for (const article of batch) {
        try {
          // Generate embedding
          const embeddingText = getArticleEmbeddingText(article);
          const { embedding } = await generateEmbedding(embeddingText);

          // Strip HTML from body for storage
          const plainContent = article.body.replace(/<[^>]*>/g, " ").trim();

          // Upsert article
          const { error: articleError } = await supabase
            .from("knowledge_articles")
            .upsert(
              {
                organization_id: organizationId,
                zendesk_id: article.id.toString(),
                title: article.title,
                content: plainContent,
                source: "zendesk",
                embedding,
              },
              { onConflict: "organization_id,zendesk_id" }
            );

          if (articleError) {
            result.errors.push(`Article ${article.id}: ${articleError.message}`);
          } else {
            result.articlesSynced++;
          }
        } catch (error) {
          result.errors.push(
            `Article ${article.id}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      // Rate limiting between batches
      if (i + BATCH_SIZE < articles.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    // Update sync state
    await updateSyncState(supabase, organizationId, "kb_articles", {
      status: "idle",
      last_sync_at: new Date().toISOString(),
      error_message: result.errors.length > 0 ? result.errors.join("; ") : null,
    });

    result.success = result.errors.length === 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(errorMessage);

    await updateSyncState(supabase, organizationId, "kb_articles", {
      status: "failed",
      error_message: errorMessage,
    });
  }

  result.duration = Date.now() - startTime;
  return result;
}

// ===========================================
// Sync Status
// ===========================================

/**
 * Get sync status for an organization
 */
export async function getSyncStatus(organizationId: string): Promise<{
  tickets: SyncState | null;
  kb_articles: SyncState | null;
}> {
  const supabase = getSupabaseAdmin();

  const [tickets, kb_articles] = await Promise.all([
    getSyncState(supabase, organizationId, "tickets"),
    getSyncState(supabase, organizationId, "kb_articles"),
  ]);

  return { tickets, kb_articles };
}
