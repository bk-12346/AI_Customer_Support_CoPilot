/**
 * Zendesk Webhook Handler
 *
 * POST /api/zendesk/webhook
 *
 * Receives real-time updates from Zendesk when tickets or articles change.
 * Validates webhook signature and triggers appropriate sync actions.
 *
 * Zendesk Webhook Events:
 * - ticket.created
 * - ticket.updated
 * - article.created
 * - article.updated
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { getZendeskClient } from "@/lib/zendesk/oauth";
import { generateEmbedding } from "@/lib/openai/embeddings";
import type { ZendeskTicket, ZendeskUser } from "@/types/zendesk";

// ===========================================
// Types
// ===========================================

interface WebhookPayload {
  type: "ticket" | "article";
  event: "created" | "updated" | "deleted";
  ticket_id?: number;
  article_id?: number;
  subdomain: string;
  timestamp: string;
}

// ===========================================
// Environment & Supabase
// ===========================================

function getSupabaseAdmin() {
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
// Webhook Signature Verification
// ===========================================

/**
 * Verify Zendesk webhook signature
 *
 * Zendesk signs webhooks with HMAC-SHA256 using the webhook signing secret.
 * The signature is sent in the X-Zendesk-Webhook-Signature header.
 */
function verifyWebhookSignature(
  body: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  const signingSecret = process.env.ZENDESK_WEBHOOK_SECRET;

  // If no signing secret is configured, skip verification (development mode)
  if (!signingSecret) {
    console.warn("[Webhook] No ZENDESK_WEBHOOK_SECRET configured, skipping signature verification");
    return true;
  }

  if (!signature || !timestamp) {
    console.error("[Webhook] Missing signature or timestamp header");
    return false;
  }

  // Zendesk uses timestamp.body format for signing
  const signedPayload = `${timestamp}.${body}`;
  const expectedSignature = createHmac("sha256", signingSecret)
    .update(signedPayload)
    .digest("base64");

  // Constant-time comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < signatureBuffer.length; i++) {
    result |= signatureBuffer[i] ^ expectedBuffer[i];
  }

  return result === 0;
}

// ===========================================
// Ticket Processing
// ===========================================

async function processTicketEvent(
  payload: WebhookPayload
): Promise<{ success: boolean; message: string }> {
  if (!payload.ticket_id) {
    return { success: false, message: "Missing ticket_id" };
  }

  const supabase = getSupabaseAdmin();

  // Find organization by subdomain
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("zendesk_subdomain", payload.subdomain)
    .single();

  if (orgError || !org) {
    return { success: false, message: `Organization not found for subdomain: ${payload.subdomain}` };
  }

  const organizationId = org.id;

  // Handle deletion
  if (payload.event === "deleted") {
    const { error: deleteError } = await supabase
      .from("tickets")
      .delete()
      .eq("organization_id", organizationId)
      .eq("zendesk_id", payload.ticket_id.toString());

    if (deleteError) {
      return { success: false, message: `Failed to delete ticket: ${deleteError.message}` };
    }

    return { success: true, message: `Deleted ticket ${payload.ticket_id}` };
  }

  // Get Zendesk client for fetching ticket details
  const client = await getZendeskClient(organizationId);
  if (!client) {
    return { success: false, message: "Zendesk not connected" };
  }

  // Fetch ticket from Zendesk
  const ticket = await client.getTicket(payload.ticket_id);

  // Fetch requester
  const requester = await client.getUser(ticket.requester_id);

  // Generate embedding
  const embeddingText = `${ticket.subject}\n\n${ticket.description || ""}`.trim();
  const { embedding } = await generateEmbedding(embeddingText);

  // Upsert ticket
  const { error: upsertError } = await supabase
    .from("tickets")
    .upsert(
      {
        zendesk_id: ticket.id.toString(),
        organization_id: organizationId,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        requester_email: requester.email,
        tags: ticket.tags,
        zendesk_created_at: ticket.created_at,
        zendesk_updated_at: ticket.updated_at,
        embedding,
      },
      { onConflict: "organization_id,zendesk_id" }
    );

  if (upsertError) {
    return { success: false, message: `Failed to upsert ticket: ${upsertError.message}` };
  }

  // Sync comments for the ticket
  const { data: ticketData } = await supabase
    .from("tickets")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("zendesk_id", ticket.id.toString())
    .single();

  if (ticketData) {
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
        continue;
      }

      const author = await client.getUser(comment.author_id);
      const authorType = comment.author_id === ticket.requester_id
        ? "customer"
        : author.role === "end-user"
          ? "customer"
          : "agent";

      await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: ticketData.id,
          zendesk_id: comment.id.toString(),
          author_type: authorType,
          author_email: author.email,
          body: comment.body,
          is_public: comment.public,
          created_at: comment.created_at,
        });
    }
  }

  return { success: true, message: `Synced ticket ${payload.ticket_id}` };
}

// ===========================================
// Article Processing
// ===========================================

async function processArticleEvent(
  payload: WebhookPayload
): Promise<{ success: boolean; message: string }> {
  if (!payload.article_id) {
    return { success: false, message: "Missing article_id" };
  }

  const supabase = getSupabaseAdmin();

  // Find organization by subdomain
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("zendesk_subdomain", payload.subdomain)
    .single();

  if (orgError || !org) {
    return { success: false, message: `Organization not found for subdomain: ${payload.subdomain}` };
  }

  const organizationId = org.id;

  // Handle deletion
  if (payload.event === "deleted") {
    const { error: deleteError } = await supabase
      .from("knowledge_articles")
      .delete()
      .eq("organization_id", organizationId)
      .eq("zendesk_id", payload.article_id.toString());

    if (deleteError) {
      return { success: false, message: `Failed to delete article: ${deleteError.message}` };
    }

    return { success: true, message: `Deleted article ${payload.article_id}` };
  }

  // Get Zendesk client
  const client = await getZendeskClient(organizationId);
  if (!client) {
    return { success: false, message: "Zendesk not connected" };
  }

  // Fetch article from Zendesk
  const article = await client.getArticle(payload.article_id);

  // Generate embedding (title boosted)
  const plainContent = article.body.replace(/<[^>]*>/g, " ").trim();
  const embeddingText = `${article.title}\n\n${article.title}\n\n${plainContent}`;
  const { embedding } = await generateEmbedding(embeddingText);

  // Upsert article
  const { error: upsertError } = await supabase
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

  if (upsertError) {
    return { success: false, message: `Failed to upsert article: ${upsertError.message}` };
  }

  return { success: true, message: `Synced article ${payload.article_id}` };
}

// ===========================================
// Request Handler
// ===========================================

export async function POST(request: NextRequest) {
  try {
    // Read body as text for signature verification
    const body = await request.text();
    const signature = request.headers.get("x-zendesk-webhook-signature");
    const timestamp = request.headers.get("x-zendesk-webhook-signature-timestamp");

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature, timestamp)) {
      console.error("[Webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // Parse payload
    const payload: WebhookPayload = JSON.parse(body);

    console.log(`[Webhook] Received ${payload.type}.${payload.event} event`);

    // Process based on event type
    let result: { success: boolean; message: string };

    if (payload.type === "ticket") {
      result = await processTicketEvent(payload);
    } else if (payload.type === "article") {
      result = await processArticleEvent(payload);
    } else {
      result = { success: false, message: `Unknown event type: ${payload.type}` };
    }

    if (!result.success) {
      console.error(`[Webhook] Processing failed: ${result.message}`);
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    console.log(`[Webhook] ${result.message}`);
    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// Zendesk may send HEAD requests to verify the endpoint
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
