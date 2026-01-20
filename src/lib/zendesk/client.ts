/**
 * Zendesk API Client
 *
 * Provides methods to interact with Zendesk REST API for:
 * - Fetching tickets and comments
 * - Fetching Help Center articles
 * - Fetching user information
 *
 * All methods require valid OAuth credentials.
 */

import type {
  ZendeskTicket,
  ZendeskComment,
  ZendeskUser,
  ZendeskArticle,
  ZendeskCredentials,
} from "@/types/zendesk";

// ===========================================
// Types
// ===========================================

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  nextPage: string | null;
  hasMore: boolean;
}

/** Ticket list API response */
interface TicketsResponse {
  tickets: ZendeskTicket[];
  next_page: string | null;
  count: number;
}

/** Comments API response */
interface CommentsResponse {
  comments: ZendeskComment[];
  next_page: string | null;
  count: number;
}

/** Articles API response */
interface ArticlesResponse {
  articles: ZendeskArticle[];
  next_page: string | null;
  page_count: number;
}

/** Users API response */
interface UsersResponse {
  users: ZendeskUser[];
  next_page: string | null;
}

/** Single user API response */
interface UserResponse {
  user: ZendeskUser;
}

// ===========================================
// Configuration
// ===========================================

const API_VERSION = "v2";
const HELP_CENTER_API_VERSION = "v2";
const DEFAULT_PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 30000;

// ===========================================
// Zendesk Client Class
// ===========================================

export class ZendeskClient {
  private subdomain: string;
  private accessToken: string;
  private baseUrl: string;
  private helpCenterUrl: string;

  constructor(credentials: ZendeskCredentials) {
    this.subdomain = credentials.subdomain;
    this.accessToken = credentials.accessToken;
    this.baseUrl = `https://${this.subdomain}.zendesk.com/api/${API_VERSION}`;
    this.helpCenterUrl = `https://${this.subdomain}.zendesk.com/api/${HELP_CENTER_API_VERSION}/help_center`;
  }

  // ===========================================
  // HTTP Request Helper
  // ===========================================

  /**
   * Make an authenticated request to Zendesk API
   */
  private async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new ZendeskAPIError(
          `Zendesk API error: ${response.status} ${response.statusText}`,
          response.status,
          errorBody
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof ZendeskAPIError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new ZendeskAPIError("Request timeout", 408, "Request timed out");
      }
      throw new ZendeskAPIError(
        `Network error: ${error instanceof Error ? error.message : "Unknown"}`,
        0,
        ""
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ===========================================
  // Tickets
  // ===========================================

  /**
   * Fetch tickets with pagination support
   *
   * @param options.status - Filter by status (open, pending, solved, closed)
   * @param options.updatedSince - Only fetch tickets updated after this date
   * @param options.pageUrl - URL for next page (for pagination)
   */
  async getTickets(options: {
    status?: string;
    updatedSince?: Date;
    pageUrl?: string;
  } = {}): Promise<PaginatedResponse<ZendeskTicket>> {
    let url = options.pageUrl;

    if (!url) {
      const params = new URLSearchParams();
      params.set("per_page", DEFAULT_PAGE_SIZE.toString());
      params.set("sort_by", "updated_at");
      params.set("sort_order", "desc");

      // Build search query
      const queryParts: string[] = [];
      if (options.status) {
        queryParts.push(`status:${options.status}`);
      }
      if (options.updatedSince) {
        queryParts.push(`updated>${options.updatedSince.toISOString().split("T")[0]}`);
      }

      if (queryParts.length > 0) {
        url = `${this.baseUrl}/search.json?query=type:ticket ${queryParts.join(" ")}&${params.toString()}`;
      } else {
        url = `${this.baseUrl}/tickets.json?${params.toString()}`;
      }
    }

    const response = await this.request<TicketsResponse>(url);

    return {
      data: response.tickets,
      nextPage: response.next_page,
      hasMore: response.next_page !== null,
    };
  }

  /**
   * Fetch a single ticket by ID
   */
  async getTicket(ticketId: number): Promise<ZendeskTicket> {
    const response = await this.request<{ ticket: ZendeskTicket }>(
      `${this.baseUrl}/tickets/${ticketId}.json`
    );
    return response.ticket;
  }

  /**
   * Fetch all comments for a ticket
   */
  async getTicketComments(
    ticketId: number,
    pageUrl?: string
  ): Promise<PaginatedResponse<ZendeskComment>> {
    const url =
      pageUrl ||
      `${this.baseUrl}/tickets/${ticketId}/comments.json?per_page=${DEFAULT_PAGE_SIZE}`;

    const response = await this.request<CommentsResponse>(url);

    return {
      data: response.comments,
      nextPage: response.next_page,
      hasMore: response.next_page !== null,
    };
  }

  /**
   * Fetch all comments for a ticket (handles pagination automatically)
   */
  async getAllTicketComments(ticketId: number): Promise<ZendeskComment[]> {
    const allComments: ZendeskComment[] = [];
    let pageUrl: string | undefined;

    do {
      const response = await this.getTicketComments(ticketId, pageUrl);
      allComments.push(...response.data);
      pageUrl = response.nextPage || undefined;
    } while (pageUrl);

    return allComments;
  }

  /**
   * Add a comment to a ticket (reply to customer)
   *
   * @param ticketId - Zendesk ticket ID
   * @param body - Comment text (supports HTML)
   * @param options.public - Whether comment is visible to customer (default: true)
   * @param options.authorId - Author user ID (optional)
   */
  async addTicketComment(
    ticketId: number,
    body: string,
    options: { public?: boolean; authorId?: number } = {}
  ): Promise<ZendeskTicket> {
    const isPublic = options.public !== false; // Default to public

    const payload = {
      ticket: {
        comment: {
          body,
          public: isPublic,
          ...(options.authorId && { author_id: options.authorId }),
        },
      },
    };

    const response = await this.request<{ ticket: ZendeskTicket }>(
      `${this.baseUrl}/tickets/${ticketId}.json`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );

    return response.ticket;
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(
    ticketId: number,
    status: "open" | "pending" | "solved" | "closed"
  ): Promise<ZendeskTicket> {
    const response = await this.request<{ ticket: ZendeskTicket }>(
      `${this.baseUrl}/tickets/${ticketId}.json`,
      {
        method: "PUT",
        body: JSON.stringify({ ticket: { status } }),
      }
    );

    return response.ticket;
  }

  // ===========================================
  // Users
  // ===========================================

  /**
   * Fetch a single user by ID
   */
  async getUser(userId: number): Promise<ZendeskUser> {
    const response = await this.request<UserResponse>(
      `${this.baseUrl}/users/${userId}.json`
    );
    return response.user;
  }

  /**
   * Fetch multiple users by IDs (batch)
   */
  async getUsers(userIds: number[]): Promise<ZendeskUser[]> {
    if (userIds.length === 0) return [];

    // Zendesk allows up to 100 IDs per request
    const uniqueIds = [...new Set(userIds)];
    const batches: number[][] = [];
    for (let i = 0; i < uniqueIds.length; i += 100) {
      batches.push(uniqueIds.slice(i, i + 100));
    }

    const allUsers: ZendeskUser[] = [];
    for (const batch of batches) {
      const response = await this.request<UsersResponse>(
        `${this.baseUrl}/users/show_many.json?ids=${batch.join(",")}`
      );
      allUsers.push(...response.users);
    }

    return allUsers;
  }

  // ===========================================
  // Help Center Articles
  // ===========================================

  /**
   * Fetch Help Center articles with pagination support
   *
   * @param options.locale - Article locale (default: en-us)
   * @param options.updatedSince - Only fetch articles updated after this date
   * @param options.pageUrl - URL for next page (for pagination)
   */
  async getArticles(options: {
    locale?: string;
    updatedSince?: Date;
    pageUrl?: string;
  } = {}): Promise<PaginatedResponse<ZendeskArticle>> {
    const locale = options.locale || "en-us";
    let url = options.pageUrl;

    if (!url) {
      const params = new URLSearchParams();
      params.set("per_page", DEFAULT_PAGE_SIZE.toString());
      params.set("sort_by", "updated_at");
      params.set("sort_order", "desc");

      if (options.updatedSince) {
        params.set("start_time", Math.floor(options.updatedSince.getTime() / 1000).toString());
      }

      url = `${this.helpCenterUrl}/${locale}/articles.json?${params.toString()}`;
    }

    const response = await this.request<ArticlesResponse>(url);

    return {
      data: response.articles,
      nextPage: response.next_page,
      hasMore: response.next_page !== null,
    };
  }

  /**
   * Fetch a single Help Center article by ID
   */
  async getArticle(articleId: number, locale: string = "en-us"): Promise<ZendeskArticle> {
    const response = await this.request<{ article: ZendeskArticle }>(
      `${this.helpCenterUrl}/${locale}/articles/${articleId}.json`
    );
    return response.article;
  }

  /**
   * Fetch all articles (handles pagination automatically)
   */
  async getAllArticles(options: {
    locale?: string;
    updatedSince?: Date;
  } = {}): Promise<ZendeskArticle[]> {
    const allArticles: ZendeskArticle[] = [];
    let pageUrl: string | undefined;

    do {
      const response = await this.getArticles({
        ...options,
        pageUrl,
      });
      allArticles.push(...response.data);
      pageUrl = response.nextPage || undefined;
    } while (pageUrl);

    return allArticles;
  }

  // ===========================================
  // Connection Test
  // ===========================================

  /**
   * Test if the credentials are valid
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request<{ users: ZendeskUser[] }>(
        `${this.baseUrl}/users/me.json`
      );
      return true;
    } catch {
      return false;
    }
  }
}

// ===========================================
// Error Classes
// ===========================================

export class ZendeskAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody: string
  ) {
    super(message);
    this.name = "ZendeskAPIError";
  }

  /** Check if error is due to invalid/expired token */
  isAuthError(): boolean {
    return this.statusCode === 401;
  }

  /** Check if error is due to rate limiting */
  isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  /** Check if resource was not found */
  isNotFound(): boolean {
    return this.statusCode === 404;
  }
}
