/**
 * Ticket-related types
 */

export interface Ticket {
  id: string;
  zendeskId: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority | null;
  requesterEmail: string;
  createdAt: Date;
  updatedAt: Date;
  messages: TicketMessage[];
}

export type TicketStatus = "new" | "open" | "pending" | "hold" | "solved" | "closed";

export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorType: "customer" | "agent" | "system";
  authorEmail: string;
  body: string;
  htmlBody: string | null;
  createdAt: Date;
  isPublic: boolean;
}

export interface TicketFilter {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  search?: string;
}

export interface TicketListResponse {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
}
