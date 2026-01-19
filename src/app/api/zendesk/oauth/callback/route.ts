/**
 * Zendesk OAuth Callback Endpoint
 *
 * GET /api/zendesk/oauth/callback
 *
 * Handles the OAuth callback from Zendesk after user authorization.
 * Exchanges the authorization code for tokens and stores them encrypted.
 *
 * Query params: code, state
 * Redirects to: /settings?zendesk=success or /settings?zendesk=error
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptCredentials } from "@/lib/zendesk/encryption";
import type { ZendeskOAuthResponse } from "@/types/zendesk";

// ===========================================
// Environment Validation
// ===========================================

function getEnvVars() {
  const clientId = process.env.ZENDESK_CLIENT_ID;
  const clientSecret = process.env.ZENDESK_CLIENT_SECRET;
  const redirectUri = process.env.ZENDESK_REDIRECT_URI;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId || !clientSecret) {
    throw new Error("Zendesk OAuth credentials not configured");
  }
  if (!redirectUri) {
    throw new Error("ZENDESK_REDIRECT_URI is not configured");
  }
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables not configured");
  }

  return { clientId, clientSecret, redirectUri, appUrl, supabaseUrl, supabaseKey };
}

// ===========================================
// State Validation
// ===========================================

interface OAuthState {
  organizationId: string;
  subdomain: string;
  token: string;
}

function parseState(state: string): OAuthState | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded);

    if (!parsed.organizationId || !parsed.subdomain || !parsed.token) {
      return null;
    }

    return parsed as OAuthState;
  } catch {
    return null;
  }
}

// ===========================================
// Token Exchange
// ===========================================

async function exchangeCodeForTokens(
  code: string,
  subdomain: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<ZendeskOAuthResponse> {
  const tokenUrl = `https://${subdomain}.zendesk.com/oauth/tokens`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      scope: "read write",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorBody}`);
  }

  return response.json();
}

// ===========================================
// Request Handler
// ===========================================

export async function GET(request: NextRequest) {
  const { appUrl } = getEnvVars();
  const settingsUrl = new URL("/settings", appUrl);

  try {
    const { clientId, clientSecret, redirectUri, supabaseUrl, supabaseKey } = getEnvVars();

    // Extract query parameters
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle OAuth errors from Zendesk
    if (error) {
      console.error("Zendesk OAuth error:", error, errorDescription);
      settingsUrl.searchParams.set("zendesk", "error");
      settingsUrl.searchParams.set("message", errorDescription || error);
      return NextResponse.redirect(settingsUrl);
    }

    // Validate required parameters
    if (!code || !state) {
      settingsUrl.searchParams.set("zendesk", "error");
      settingsUrl.searchParams.set("message", "Missing authorization code or state");
      return NextResponse.redirect(settingsUrl);
    }

    // Parse and validate state
    const parsedState = parseState(state);
    if (!parsedState) {
      settingsUrl.searchParams.set("zendesk", "error");
      settingsUrl.searchParams.set("message", "Invalid OAuth state");
      return NextResponse.redirect(settingsUrl);
    }

    const { organizationId, subdomain } = parsedState;

    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForTokens(
      code,
      subdomain,
      clientId,
      clientSecret,
      redirectUri
    );

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    // Encrypt tokens for storage
    const { accessTokenEncrypted, refreshTokenEncrypted } = encryptCredentials(
      tokenResponse.access_token,
      tokenResponse.refresh_token
    );

    // Store encrypted credentials in database
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: updateError } = await supabase
      .from("zendesk_credentials")
      .upsert(
        {
          organization_id: organizationId,
          subdomain,
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          expires_at: expiresAt.toISOString(),
        },
        {
          onConflict: "organization_id",
        }
      );

    if (updateError) {
      console.error("Failed to store credentials:", updateError);
      settingsUrl.searchParams.set("zendesk", "error");
      settingsUrl.searchParams.set("message", "Failed to save credentials");
      return NextResponse.redirect(settingsUrl);
    }

    // Update organization with Zendesk subdomain
    const { error: orgError } = await supabase
      .from("organizations")
      .update({ zendesk_subdomain: subdomain })
      .eq("id", organizationId);

    if (orgError) {
      console.error("Failed to update organization:", orgError);
      // Non-fatal error, continue with success
    }

    // Redirect to settings with success
    settingsUrl.searchParams.set("zendesk", "success");
    return NextResponse.redirect(settingsUrl);
  } catch (error) {
    console.error("OAuth callback error:", error);
    settingsUrl.searchParams.set("zendesk", "error");
    settingsUrl.searchParams.set(
      "message",
      error instanceof Error ? error.message : "An unexpected error occurred"
    );
    return NextResponse.redirect(settingsUrl);
  }
}
