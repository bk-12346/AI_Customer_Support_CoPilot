"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

// ===========================================
// Types
// ===========================================

interface Message {
  id: string;
  author_type: "customer" | "agent" | "system";
  author_email: string;
  body: string;
  is_public: boolean;
  created_at: string;
}

interface DraftSource {
  type: "kb" | "ticket";
  id: string;
  title: string;
  similarity: number;
}

interface Draft {
  id: string | null;
  content: string;
  confidenceScore: number;
  confidenceLevel: "high" | "medium" | "low";
  confidenceExplanation: string;
  needsReview: boolean;
  sources: DraftSource[];
  isFallback?: boolean;
  fallbackReason?: string;
  suggestedActions?: string[];
  status: string;
  createdAt?: string;
}

interface Ticket {
  id: string;
  zendesk_id: string;
  subject: string;
  status: string;
  priority: string | null;
  requester_email: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  messages: Message[];
  drafts: Draft[];
}

// ===========================================
// Component
// ===========================================

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const { profile } = useAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const organizationId = profile?.organizationId;
  const userId = profile?.id;

  const fetchTicket = useCallback(async () => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`);
      if (response.ok) {
        const data = await response.json();
        setTicket(data.ticket);
        // Set the most recent draft if exists
        if (data.ticket.drafts && data.ticket.drafts.length > 0) {
          const latestDraft = data.ticket.drafts[0];
          setCurrentDraft({
            id: latestDraft.id,
            content: latestDraft.content,
            confidenceScore: latestDraft.confidence_score,
            confidenceLevel: getConfidenceLevel(latestDraft.confidence_score),
            confidenceExplanation: "",
            needsReview: latestDraft.confidence_score < 0.7,
            sources: latestDraft.sources || [],
            status: latestDraft.status,
            createdAt: latestDraft.created_at,
          });
        }
      } else {
        setError("Failed to load ticket");
      }
    } catch (err) {
      setError("Failed to load ticket");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId, fetchTicket]);

  const handleGenerateDraft = async () => {
    if (!organizationId || !userId) return;

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          organizationId,
          userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate draft");
      }

      setCurrentDraft(data.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate draft");
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveAndSend = async () => {
    if (!currentDraft || !organizationId) return;

    setSending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: currentDraft.content,
          draftId: currentDraft.id,
          organizationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reply");
      }

      setSuccessMessage("Reply sent successfully to Zendesk!");
      setCurrentDraft(null);

      // Refresh ticket to show new message
      await fetchTicket();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const getConfidenceLevel = (score: number): "high" | "medium" | "low" => {
    if (score >= 0.7) return "high";
    if (score >= 0.4) return "medium";
    return "low";
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case "high":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-800";
      case "open":
        return "bg-yellow-100 text-yellow-800";
      case "pending":
        return "bg-orange-100 text-orange-800";
      case "solved":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24 mb-8"></div>
          <div className="grid grid-cols-3 gap-8">
            <div className="col-span-2">
              <div className="bg-white rounded-lg border p-6 h-96"></div>
            </div>
            <div className="col-span-1">
              <div className="bg-white rounded-lg border p-6 h-64"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">
          <p>Ticket not found</p>
          <Link href="/tickets" className="text-blue-600 hover:underline mt-2 block">
            Back to tickets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/tickets" className="text-sm text-gray-600 hover:text-black">
          ← Back to tickets
        </Link>
      </div>

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

      <div className="grid grid-cols-3 gap-8">
        {/* Ticket conversation */}
        <div className="col-span-2">
          <div className="bg-white rounded-lg border">
            {/* Header */}
            <div className="p-6 border-b">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold mb-2">{ticket.subject}</h1>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span>#{ticket.zendesk_id}</span>
                    <span>•</span>
                    <span>{ticket.requester_email}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(ticket.status)}`}>
                    {ticket.status}
                  </span>
                  {ticket.priority && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                      {ticket.priority}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              {ticket.messages.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No messages yet</p>
              ) : (
                ticket.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-4 rounded-lg ${
                      message.author_type === "customer"
                        ? "bg-blue-50 ml-0 mr-12"
                        : message.author_type === "agent"
                        ? "bg-green-50 ml-12 mr-0"
                        : "bg-gray-50 mx-6"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {message.author_type === "customer"
                          ? "Customer"
                          : message.author_type === "agent"
                          ? "Agent"
                          : "System"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(message.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {message.body}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* AI Draft Panel */}
        <div className="col-span-1">
          <div className="bg-white rounded-lg border p-6 sticky top-8">
            <h2 className="font-semibold mb-4">AI Draft</h2>

            {currentDraft ? (
              <div className="space-y-4">
                {/* Confidence Badge */}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getConfidenceColor(
                      currentDraft.confidenceLevel
                    )}`}
                  >
                    {currentDraft.confidenceLevel} confidence
                  </span>
                  <span className="text-xs text-gray-500">
                    {(currentDraft.confidenceScore * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Fallback Warning */}
                {currentDraft.isFallback && (
                  <div className="p-3 bg-yellow-50 rounded-lg text-sm">
                    <p className="font-medium text-yellow-800">Fallback Response</p>
                    <p className="text-yellow-700 text-xs mt-1">
                      {currentDraft.fallbackReason}
                    </p>
                  </div>
                )}

                {/* Draft Content */}
                <div className="bg-gray-50 rounded-lg p-4 min-h-[150px] max-h-[300px] overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{currentDraft.content}</p>
                </div>

                {/* Sources */}
                {currentDraft.sources && currentDraft.sources.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 mb-2">
                      Sources ({currentDraft.sources.length})
                    </h3>
                    <div className="space-y-1">
                      {currentDraft.sources.slice(0, 3).map((source, i) => (
                        <div
                          key={i}
                          className="text-xs bg-gray-100 rounded px-2 py-1 truncate"
                          title={source.title}
                        >
                          {source.type === "kb" ? "📄" : "🎫"} {source.title}
                          <span className="text-gray-400 ml-1">
                            ({(source.similarity * 100).toFixed(0)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Actions */}
                {currentDraft.suggestedActions && currentDraft.suggestedActions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 mb-2">
                      Suggested Actions
                    </h3>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {currentDraft.suggestedActions.map((action, i) => (
                        <li key={i}>• {action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 mb-4 min-h-[150px] flex items-center justify-center">
                <p className="text-gray-500 text-sm text-center">
                  Click "Generate Draft" to create an AI response
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleGenerateDraft}
                disabled={generating}
                className="flex-1 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? "Generating..." : currentDraft ? "Regenerate" : "Generate Draft"}
              </button>
              {currentDraft && (
                <button
                  onClick={handleApproveAndSend}
                  disabled={sending}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? "Sending..." : "Approve & Send"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
