/**
 * Zendesk OAuth Initiation Endpoint
 *
 * POST /api/zendesk/auth
 *
 * Initiates the OAuth flow by redirecting the user to Zendesk's
 * authorization page. The user must provide their Zendesk subdomain.
 *
 * Request body: { subdomain: string, organizationId: string }
 * Response: { authUrl: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// ===========================================
// Environment Validation
// ===========================================

function getEnvVars() {
  const clientId = process.env.ZENDESK_CLIENT_ID;
  const redirectUri = process.env.ZENDESK_REDIRECT_URI;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId) {
    throw new Error("ZENDESK_CLIENT_ID is not configured");
  }
  if (!redirectUri) {
    throw new Error("ZENDESK_REDIRECT_URI is not configured");
  }
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables not configured");
  }

  return { clientId, redirectUri, supabaseUrl, supabaseKey };
}

// ===========================================
// Request Handler
// ===========================================

export async function POST(request: NextRequest) {
  try {
    const { clientId, redirectUri, supabaseUrl, supabaseKey } = getEnvVars();

    // Parse request body
    const body = await request.json();
    const { subdomain, organizationId } = body;

    if (!subdomain || typeof subdomain !== "string") {
      return NextResponse.json(
        { error: "Zendesk subdomain is required" },
        { status: 400 }
      );
    }

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    // Validate subdomain format (alphanumeric and hyphens only)
    const subdomainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/i;
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json(
        { error: "Invalid Zendesk subdomain format" },
        { status: 400 }
      );
    }

    // Generate state token for CSRF protection
    // State includes organization ID and a random token
    const stateToken = randomBytes(32).toString("hex");
    const state = Buffer.from(
      JSON.stringify({
        organizationId,
        subdomain,
        token: stateToken,
      })
    ).toString("base64url");

    // Store state in database for verification during callback
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Store or update the pending OAuth state
    const { error: stateError } = await supabase
      .from("zendesk_credentials")
      .upsert(
        {
          organization_id: organizationId,
          subdomain,
          access_token_encrypted: "", // Will be filled after callback
          refresh_token_encrypted: "", // Will be filled after callback
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry for pending state
        },
        {
          onConflict: "organization_id",
        }
      );

    if (stateError) {
      console.error("Failed to store OAuth state:", stateError);
      return NextResponse.json(
        { error: "Failed to initiate OAuth flow" },
        { status: 500 }
      );
    }

    // Build Zendesk OAuth authorization URL
    const authUrl = new URL(`https://${subdomain}.zendesk.com/oauth/authorizations/new`);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", "read write");
    authUrl.searchParams.set("state", state);

    return NextResponse.json({
      authUrl: authUrl.toString(),
    });
  } catch (error) {
    console.error("OAuth initiation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
