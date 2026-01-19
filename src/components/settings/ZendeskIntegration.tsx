"use client";

import { useState, useEffect, useCallback } from "react";

interface SyncState {
  status: "idle" | "running" | "failed";
  lastSyncAt: string | null;
  error: string | null;
}

interface ZendeskStatus {
  connected: boolean;
  subdomain: string | null;
  sync: {
    tickets: SyncState | null;
    articles: SyncState | null;
  };
}

interface ZendeskIntegrationProps {
  organizationId: string;
}

export default function ZendeskIntegration({ organizationId }: ZendeskIntegrationProps) {
  const [status, setStatus] = useState<ZendeskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [subdomain, setSubdomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch status on mount
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/zendesk/status?organizationId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch Zendesk status:", err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchStatus();

    // Check for OAuth callback result in URL
    const params = new URLSearchParams(window.location.search);
    const zendeskResult = params.get("zendesk");
    const message = params.get("message");

    if (zendeskResult === "success") {
      setSuccessMessage("Zendesk connected successfully!");
      // Clear URL params
      window.history.replaceState({}, "", window.location.pathname);
      // Refresh status
      fetchStatus();
    } else if (zendeskResult === "error") {
      setError(message || "Failed to connect Zendesk");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fetchStatus]);

  const handleConnect = async () => {
    if (!subdomain.trim()) {
      setError("Please enter your Zendesk subdomain");
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const response = await fetch("/api/zendesk/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subdomain: subdomain.trim(), organizationId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate OAuth");
      }

      // Redirect to Zendesk OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Zendesk?")) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/zendesk/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disconnect");
      }

      setSuccessMessage("Zendesk disconnected");
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (type: "tickets" | "articles" | "all") => {
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/zendesk/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, type }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Sync failed");
      }

      // Build success message
      const parts = [];
      if (data.results.tickets) {
        parts.push(`${data.results.tickets.synced} tickets`);
      }
      if (data.results.articles) {
        parts.push(`${data.results.articles.synced} articles`);
      }
      setSuccessMessage(`Synced ${parts.join(" and ")}`);

      // Refresh status
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h2 className="font-semibold mb-4">Zendesk Integration</h2>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="font-semibold mb-4">Zendesk Integration</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          {successMessage}
        </div>
      )}

      {status?.connected ? (
        <div className="space-y-4">
          {/* Connected Status */}
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-green-700">Connected to</span>
            <span className="font-medium">{status.subdomain}.zendesk.com</span>
          </div>

          {/* Sync Status */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium mb-3">Sync Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Tickets</span>
                <span>
                  {status.sync.tickets?.status === "running" ? (
                    <span className="text-blue-600">Syncing...</span>
                  ) : (
                    formatDate(status.sync.tickets?.lastSyncAt || null)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Help Center Articles</span>
                <span>
                  {status.sync.articles?.status === "running" ? (
                    <span className="text-blue-600">Syncing...</span>
                  ) : (
                    formatDate(status.sync.articles?.lastSyncAt || null)
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={() => handleSync("all")}
              disabled={syncing}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-500 text-sm">
            Connect your Zendesk account to sync tickets and help center articles.
          </p>

          <div>
            <label className="block text-sm font-medium mb-1">
              Zendesk Subdomain
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder="your-company"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
              <span className="text-gray-500">.zendesk.com</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Your Zendesk URL is https://your-company.zendesk.com
            </p>
          </div>

          <button
            onClick={handleConnect}
            disabled={connecting || !subdomain.trim()}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connecting ? "Connecting..." : "Connect Zendesk"}
          </button>
        </div>
      )}
    </div>
  );
}
