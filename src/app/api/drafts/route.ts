/**
 * AI Drafts API Endpoint
 *
 * POST /api/drafts - Generate a new AI draft for a ticket
 * GET /api/drafts?ticketId=xxx - List drafts for a ticket
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateDraft } from "@/lib/ai";

// ===========================================
// Supabase Client
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
// POST - Generate Draft
// ===========================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticketId, organizationId, userId } = body;

    if (!ticketId) {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 }
      );
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch ticket with messages
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Fetch messages to get the customer's inquiry
    const { data: messages, error: messagesError } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    // Get the customer's message(s) to use as context
    // Combine subject + customer messages for better context
    const customerMessages = (messages || [])
      .filter((m) => m.author_type === "customer")
      .map((m) => m.body)
      .join("\n\n");

    const customerMessage = customerMessages || ticket.subject;

    console.log(`[API] Generating draft for ticket ${ticketId}`);
    console.log(`[API] Customer message: ${customerMessage.substring(0, 100)}...`);

    // Generate draft using AI pipeline
    const draft = await generateDraft({
      ticketId,
      customerMessage,
      organizationId,
      userId: userId || "system",
    });

    // Save draft to database
    const { data: savedDraft, error: saveError } = await supabase
      .from("ai_drafts")
      .insert({
        ticket_id: ticketId,
        content: draft.content,
        confidence_score: draft.confidenceScore,
        sources: draft.sources,
        status: "pending",
        created_by: userId || null,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Failed to save draft:", saveError);
      // Return draft even if save fails
      return NextResponse.json({
        draft: {
          ...draft,
          id: null,
          saved: false,
        },
      });
    }

    return NextResponse.json({
      draft: {
        id: savedDraft.id,
        content: draft.content,
        confidenceScore: draft.confidenceScore,
        confidenceLevel: draft.confidenceLevel,
        confidenceExplanation: draft.confidenceExplanation,
        needsReview: draft.needsReview,
        sources: draft.sources,
        isFallback: draft.isFallback,
        fallbackReason: draft.fallbackReason,
        suggestedActions: draft.suggestedActions,
        metadata: draft.metadata,
        status: "pending",
        createdAt: savedDraft.created_at,
        saved: true,
      },
    });
  } catch (error) {
    console.error("Draft generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate draft" },
      { status: 500 }
    );
  }
}

// ===========================================
// GET - List Drafts
// ===========================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const ticketId = searchParams.get("ticketId");

    if (!ticketId) {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: drafts, error } = await supabase
      .from("ai_drafts")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ drafts: drafts || [] });
  } catch (error) {
    console.error("Drafts API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch drafts" },
      { status: 500 }
    );
  }
}
