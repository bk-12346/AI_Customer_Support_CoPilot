/**
 * AI/Draft-related types
 */

export interface AIDraft {
  id: string;
  ticketId: string;
  content: string;
  confidenceScore: number;
  sources: DraftSource[];
  status: DraftStatus;
  createdBy: string;
  createdAt: Date;
}

export type DraftStatus = "pending" | "approved" | "rejected";

export interface DraftSource {
  id: string;
  title: string;
  type: "article" | "ticket";
  similarity: number;
  snippet: string;
}

export interface GenerateDraftRequest {
  ticketId: string;
  includeHistory?: boolean;
}

export interface GenerateDraftResponse {
  draft: AIDraft;
  tokensUsed: number;
}

export interface DraftFeedback {
  draftId: string;
  action: "approve" | "reject" | "edit";
  editedContent?: string;
  reason?: string;
}

/**
 * RAG-related types
 */
export interface RetrievedContext {
  id: string;
  title: string;
  content: string;
  source: "article" | "ticket";
  similarity: number;
}

export interface RAGConfig {
  matchThreshold: number;
  matchCount: number;
  includeTicketHistory: boolean;
}

export const DEFAULT_RAG_CONFIG: RAGConfig = {
  matchThreshold: 0.7,
  matchCount: 5,
  includeTicketHistory: true,
};
