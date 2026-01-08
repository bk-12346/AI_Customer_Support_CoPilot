/**
 * Supabase Database Types
 * Auto-generated types will replace this file when running:
 * npx supabase gen types typescript --local > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          zendesk_subdomain: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          zendesk_subdomain?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          zendesk_subdomain?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          organization_id: string;
          role: "admin" | "agent";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string; // Required - links to auth.users
          email: string;
          name?: string | null;
          organization_id: string;
          role?: "admin" | "agent";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          organization_id?: string;
          role?: "admin" | "agent";
          created_at?: string;
          updated_at?: string;
        };
      };
      zendesk_credentials: {
        Row: {
          id: string;
          organization_id: string;
          access_token_encrypted: string;
          refresh_token_encrypted: string;
          subdomain: string;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          access_token_encrypted: string;
          refresh_token_encrypted: string;
          subdomain: string;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          access_token_encrypted?: string;
          refresh_token_encrypted?: string;
          subdomain?: string;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      tickets: {
        Row: {
          id: string;
          zendesk_id: string;
          organization_id: string;
          subject: string;
          status: string;
          priority: string | null;
          requester_email: string;
          assignee_id: string | null;
          tags: string[];
          embedding: number[] | null;
          created_at: string;
          updated_at: string;
          zendesk_created_at: string | null;
          zendesk_updated_at: string | null;
        };
        Insert: {
          id?: string;
          zendesk_id: string;
          organization_id: string;
          subject: string;
          status?: string;
          priority?: string | null;
          requester_email: string;
          assignee_id?: string | null;
          tags?: string[];
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
          zendesk_created_at?: string | null;
          zendesk_updated_at?: string | null;
        };
        Update: {
          id?: string;
          zendesk_id?: string;
          organization_id?: string;
          subject?: string;
          status?: string;
          priority?: string | null;
          requester_email?: string;
          assignee_id?: string | null;
          tags?: string[];
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
          zendesk_created_at?: string | null;
          zendesk_updated_at?: string | null;
        };
      };
      ticket_messages: {
        Row: {
          id: string;
          ticket_id: string;
          zendesk_id: string | null;
          author_type: "customer" | "agent" | "system";
          author_email: string;
          body: string;
          html_body: string | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          zendesk_id?: string | null;
          author_type: "customer" | "agent" | "system";
          author_email: string;
          body: string;
          html_body?: string | null;
          is_public?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          zendesk_id?: string | null;
          author_type?: "customer" | "agent" | "system";
          author_email?: string;
          body?: string;
          html_body?: string | null;
          is_public?: boolean;
          created_at?: string;
        };
      };
      knowledge_articles: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          content: string;
          source: "zendesk" | "upload";
          zendesk_id: string | null;
          file_name: string | null;
          file_type: string | null;
          embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          content: string;
          source: "zendesk" | "upload";
          zendesk_id?: string | null;
          file_name?: string | null;
          file_type?: string | null;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          title?: string;
          content?: string;
          source?: "zendesk" | "upload";
          zendesk_id?: string | null;
          file_name?: string | null;
          file_type?: string | null;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_drafts: {
        Row: {
          id: string;
          ticket_id: string;
          content: string;
          confidence_score: number;
          sources: Json;
          status: "pending" | "approved" | "rejected";
          edited_content: string | null;
          created_by: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          content: string;
          confidence_score: number;
          sources?: Json;
          status?: "pending" | "approved" | "rejected";
          edited_content?: string | null;
          created_by: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          content?: string;
          confidence_score?: number;
          sources?: Json;
          status?: "pending" | "approved" | "rejected";
          edited_content?: string | null;
          created_by?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_knowledge: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
          org_id?: string;
        };
        Returns: {
          id: string;
          title: string;
          content: string;
          source: "zendesk" | "upload";
          similarity: number;
        }[];
      };
      match_similar_tickets: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
          org_id?: string;
          exclude_ticket_id?: string;
        };
        Returns: {
          id: string;
          subject: string;
          status: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      user_role: "admin" | "agent";
      draft_status: "pending" | "approved" | "rejected";
      knowledge_source: "zendesk" | "upload";
      message_author_type: "customer" | "agent" | "system";
    };
  };
}

// Convenience type aliases
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
