/**
 * Zendesk Disconnect Endpoint
 *
 * POST /api/zendesk/disconnect
 *
 * Disconnects Zendesk from an organization by removing stored credentials.
 *
 * Request body: { organizationId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { disconnectZendesk, isZendeskConnected } from "@/lib/zendesk";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
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

    // Disconnect
    await disconnectZendesk(organizationId);

    console.log(`[Zendesk] Disconnected for org ${organizationId}`);

    return NextResponse.json({
      success: true,
      message: "Zendesk disconnected successfully",
    });
  } catch (error) {
    console.error("[Disconnect] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
