/**
 * Zendesk API types
 */

export interface ZendeskCredentials {
  accessToken: string;
  refreshToken: string;
  subdomain: string;
  expiresAt: Date;
}

export interface ZendeskTicket {
  id: number;
  url: string;
  subject: string;
  description: string;
  status: string;
  priority: string | null;
  requester_id: number;
  submitter_id: number;
  assignee_id: number | null;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface ZendeskComment {
  id: number;
  type: string;
  body: string;
  html_body: string;
  author_id: number;
  public: boolean;
  created_at: string;
}

export interface ZendeskUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface ZendeskArticle {
  id: number;
  url: string;
  html_url: string;
  title: string;
  body: string;
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface ZendeskWebhookPayload {
  type: string;
  ticket_id?: number;
  article_id?: number;
  event: string;
  timestamp: string;
}

/**
 * OAuth types
 */
export interface ZendeskOAuthResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  scope: string;
  expires_in: number;
}
