/**
 * Zendesk Sync Trigger Endpoint
 *
 * POST /api/zendesk/sync
 *
 * Triggers a manual sync of tickets and/or KB articles from Zendesk.
 *
 * Request body: {
 *   organizationId: string,
 *   type: "tickets" | "articles" | "all",
 *   fullSync?: boolean
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { syncTickets, syncKBArticles, isZendeskConnected } from "@/lib/zendesk";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, type, fullSync } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    if (!type || !["tickets", "articles", "all"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be 'tickets', 'articles', or 'all'" },
        { status: 400 }
      );
    }

    // Check if Zendesk is connected
    const connected = await isZendeskConnected(organizationId);
    if (!connected) {
      return NextResponse.json(
        { error: "Zendesk is not connected for this organization" },
        { status: 400 }
      );
    }

    const results: {
      tickets?: { success: boolean; synced: number; errors: string[] };
      articles?: { success: boolean; synced: number; errors: string[] };
    } = {};

    // Sync tickets
    if (type === "tickets" || type === "all") {
      console.log(`[Sync] Starting ticket sync for org ${organizationId}`);
      const ticketResult = await syncTickets(organizationId, { fullSync: fullSync || false });
      results.tickets = {
        success: ticketResult.success,
        synced: ticketResult.ticketsSynced,
        errors: ticketResult.errors,
      };
      console.log(`[Sync] Ticket sync complete: ${ticketResult.ticketsSynced} synced, ${ticketResult.errors.length} errors`);
    }

    // Sync articles
    if (type === "articles" || type === "all") {
      console.log(`[Sync] Starting article sync for org ${organizationId}`);
      const articleResult = await syncKBArticles(organizationId, { fullSync: fullSync || false });
      results.articles = {
        success: articleResult.success,
        synced: articleResult.articlesSynced,
        errors: articleResult.errors,
      };
      console.log(`[Sync] Article sync complete: ${articleResult.articlesSynced} synced, ${articleResult.errors.length} errors`);
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("[Sync] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
