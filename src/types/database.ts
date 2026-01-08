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
          id?: string;
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
      tickets: {
        Row: {
          id: string;
          zendesk_id: string;
          organization_id: string;
          subject: string;
          status: string;
          priority: string | null;
          requester_email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          zendesk_id: string;
          organization_id: string;
          subject: string;
          status: string;
          priority?: string | null;
          requester_email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          zendesk_id?: string;
          organization_id?: string;
          subject?: string;
          status?: string;
          priority?: string | null;
          requester_email?: string;
          created_at?: string;
          updated_at?: string;
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
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          content: string;
          confidence_score: number;
          sources?: Json;
          status?: "pending" | "approved" | "rejected";
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          content?: string;
          confidence_score?: number;
          sources?: Json;
          status?: "pending" | "approved" | "rejected";
          created_by?: string;
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
          match_threshold: number;
          match_count: number;
          org_id: string;
        };
        Returns: {
          id: string;
          title: string;
          content: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      user_role: "admin" | "agent";
      draft_status: "pending" | "approved" | "rejected";
      knowledge_source: "zendesk" | "upload";
    };
  };
}
