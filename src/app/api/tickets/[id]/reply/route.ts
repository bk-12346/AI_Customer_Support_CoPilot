/**
 * POST /api/tickets/[id]/reply
 *
 * Send an approved draft as a reply to the customer via Zendesk.
 * Updates the draft status and syncs the new message back to the database.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ZendeskClient } from "@/lib/zendesk/client";
import { getZendeskCredentials } from "@/lib/zendesk/oauth";

// ===========================================
// POST - Send Reply to Zendesk
// ===========================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ticketId } = await params;

  try {
    const body = await request.json();
    const { content, draftId, organizationId } = body;

    if (!content || !organizationId) {
      return NextResponse.json(
        { error: "Missing required fields: content, organizationId" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get ticket details to find zendesk_id
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("zendesk_id, organization_id")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Verify organization matches
    if (ticket.organization_id !== organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Get Zendesk credentials
    const credentials = await getZendeskCredentials(supabase, organizationId);
    if (!credentials) {
      return NextResponse.json(
        { error: "Zendesk not connected" },
        { status: 400 }
      );
    }

    // Send reply to Zendesk
    const zendeskClient = new ZendeskClient(credentials);
    const zendeskTicketId = parseInt(ticket.zendesk_id, 10);

    console.log(`[Reply] Sending reply to Zendesk ticket ${zendeskTicketId}`);

    const updatedTicket = await zendeskClient.addTicketComment(
      zendeskTicketId,
      content,
      { public: true }
    );

    console.log(`[Reply] Reply sent successfully to ticket ${zendeskTicketId}`);

    // Update draft status if draftId provided
    if (draftId) {
      await supabase
        .from("ai_drafts")
        .update({
          status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", draftId);
    }

    // Add the message to our database
    const { error: messageError } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId,
        zendesk_comment_id: `reply-${Date.now()}`, // Temporary ID until next sync
        author_type: "agent",
        author_email: "agent@support.local", // TODO: Get from user session
        body: content,
        is_public: true,
        created_at: new Date().toISOString(),
      });

    if (messageError) {
      console.error("[Reply] Failed to save message locally:", messageError);
      // Don't fail the request - the reply was sent to Zendesk
    }

    // Update ticket status to pending (awaiting customer response)
    await supabase
      .from("tickets")
      .update({
        status: updatedTicket.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    return NextResponse.json({
      success: true,
      message: "Reply sent successfully",
      zendeskTicketId: zendeskTicketId,
      newStatus: updatedTicket.status,
    });
  } catch (error) {
    console.error("[Reply] Error sending reply:", error);
    return NextResponse.json(
      {
        error: "Failed to send reply",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
