/**
 * Single Ticket API Endpoint
 *
 * GET /api/tickets/[id]
 *
 * Returns a ticket with all its messages.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;

    if (!ticketId) {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError) {
      if (ticketError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Ticket not found" },
          { status: 404 }
        );
      }
      throw ticketError;
    }

    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    // Fetch existing drafts for this ticket
    const { data: drafts, error: draftsError } = await supabase
      .from("ai_drafts")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false });

    if (draftsError) {
      console.error("Failed to fetch drafts:", draftsError);
      // Non-fatal, continue without drafts
    }

    return NextResponse.json({
      ticket: {
        ...ticket,
        messages: messages || [],
        drafts: drafts || [],
      },
    });
  } catch (error) {
    console.error("Ticket API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
