/**
 * Zendesk OAuth Utilities
 *
 * Provides token refresh and credential management functions.
 */

import { createClient } from "@supabase/supabase-js";
import { encryptCredentials, decryptCredentials } from "./encryption";
import { ZendeskClient } from "./client";
import type { ZendeskCredentials, ZendeskOAuthResponse } from "@/types/zendesk";

// ===========================================
// Types
// ===========================================

interface StoredCredentials {
  organization_id: string;
  subdomain: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string;
}

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
// Token Refresh
// ===========================================

/**
 * Refresh Zendesk access token using refresh token
 */
async function refreshAccessToken(
  subdomain: string,
  refreshToken: string
): Promise<ZendeskOAuthResponse> {
  const clientId = process.env.ZENDESK_CLIENT_ID;
  const clientSecret = process.env.ZENDESK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Zendesk OAuth credentials not configured");
  }

  const tokenUrl = `https://${subdomain}.zendesk.com/oauth/tokens`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      scope: "read write",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorBody}`);
  }

  return response.json();
}

// ===========================================
// Credential Management
// ===========================================

/**
 * Get Zendesk credentials for an organization
 *
 * Automatically refreshes tokens if they are expired or about to expire.
 *
 * @param organizationId - The organization UUID
 * @returns Decrypted credentials or null if not connected
 */
export async function getZendeskCredentials(
  organizationId: string
): Promise<ZendeskCredentials | null> {
  const supabase = getSupabaseAdmin();

  // Fetch stored credentials
  const { data, error } = await supabase
    .from("zendesk_credentials")
    .select("*")
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) {
    return null;
  }

  const stored = data as StoredCredentials;

  // Check if credentials are empty (pending OAuth)
  if (!stored.access_token_encrypted || !stored.refresh_token_encrypted) {
    return null;
  }

  // Decrypt credentials
  const { accessToken, refreshToken } = decryptCredentials(
    stored.access_token_encrypted,
    stored.refresh_token_encrypted
  );

  const expiresAt = new Date(stored.expires_at);

  // Check if token needs refresh (expires within 5 minutes)
  const needsRefresh = expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  if (needsRefresh) {
    try {
      // Refresh the token
      const newTokens = await refreshAccessToken(stored.subdomain, refreshToken);
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

      // Encrypt new tokens
      const encrypted = encryptCredentials(
        newTokens.access_token,
        newTokens.refresh_token
      );

      // Update database
      await supabase
        .from("zendesk_credentials")
        .update({
          access_token_encrypted: encrypted.accessTokenEncrypted,
          refresh_token_encrypted: encrypted.refreshTokenEncrypted,
          expires_at: newExpiresAt.toISOString(),
        })
        .eq("organization_id", organizationId);

      return {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token,
        subdomain: stored.subdomain,
        expiresAt: newExpiresAt,
      };
    } catch (error) {
      console.error("Failed to refresh Zendesk token:", error);
      // Return existing credentials if refresh fails - they might still work
      return {
        accessToken,
        refreshToken,
        subdomain: stored.subdomain,
        expiresAt,
      };
    }
  }

  return {
    accessToken,
    refreshToken,
    subdomain: stored.subdomain,
    expiresAt,
  };
}

/**
 * Get an authenticated Zendesk client for an organization
 *
 * @param organizationId - The organization UUID
 * @returns ZendeskClient instance or null if not connected
 */
export async function getZendeskClient(
  organizationId: string
): Promise<ZendeskClient | null> {
  const credentials = await getZendeskCredentials(organizationId);

  if (!credentials) {
    return null;
  }

  return new ZendeskClient(credentials);
}

/**
 * Check if an organization has Zendesk connected
 */
export async function isZendeskConnected(organizationId: string): Promise<boolean> {
  const credentials = await getZendeskCredentials(organizationId);
  return credentials !== null;
}

/**
 * Disconnect Zendesk from an organization
 */
export async function disconnectZendesk(organizationId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Delete credentials
  await supabase
    .from("zendesk_credentials")
    .delete()
    .eq("organization_id", organizationId);

  // Clear subdomain from organization
  await supabase
    .from("organizations")
    .update({ zendesk_subdomain: null })
    .eq("id", organizationId);
}
