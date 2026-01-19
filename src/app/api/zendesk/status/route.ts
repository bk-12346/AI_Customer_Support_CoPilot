/**
 * Zendesk Connection Status Endpoint
 *
 * GET /api/zendesk/status?organizationId=xxx
 *
 * Returns the Zendesk connection status and sync state for an organization.
 */

import { NextRequest, NextResponse } from "next/server";
import { isZendeskConnected, getSyncStatus } from "@/lib/zendesk";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    // Get Supabase client for org info
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

    // Get organization info
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("zendesk_subdomain")
      .eq("id", organizationId)
      .single();

    if (orgError) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check connection status
    const connected = await isZendeskConnected(organizationId);

    // Get sync status
    const syncStatus = await getSyncStatus(organizationId);

    return NextResponse.json({
      connected,
      subdomain: org.zendesk_subdomain || null,
      sync: {
        tickets: syncStatus.tickets
          ? {
              status: syncStatus.tickets.status,
              lastSyncAt: syncStatus.tickets.last_sync_at,
              error: syncStatus.tickets.error_message,
            }
          : null,
        articles: syncStatus.kb_articles
          ? {
              status: syncStatus.kb_articles.status,
              lastSyncAt: syncStatus.kb_articles.last_sync_at,
              error: syncStatus.kb_articles.error_message,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[Status] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
