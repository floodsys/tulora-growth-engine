export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_role_snapshot: string
          actor_user_id: string | null
          channel: string
          created_at: string
          error_code: string | null
          id: string
          ip_hash: string | null
          metadata: Json | null
          organization_id: string
          request_id: string | null
          status: string
          target_id: string | null
          target_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_role_snapshot: string
          actor_user_id?: string | null
          channel?: string
          created_at?: string
          error_code?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          organization_id: string
          request_id?: string | null
          status?: string
          target_id?: string | null
          target_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_role_snapshot?: string
          actor_user_id?: string | null
          channel?: string
          created_at?: string
          error_code?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          organization_id?: string
          request_id?: string | null
          status?: string
          target_id?: string | null
          target_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_profiles: {
        Row: {
          call_recording_enabled: boolean
          created_at: string
          first_message: string | null
          first_message_mode: string
          id: string
          is_default: boolean
          language: string
          max_tokens: number | null
          name: string
          organization_id: string
          retell_agent_id: string
          settings: Json | null
          status: string
          system_prompt: string | null
          temperature: number | null
          transfer_number: string | null
          updated_at: string
          voice: string | null
          warm_transfer_enabled: boolean
        }
        Insert: {
          call_recording_enabled?: boolean
          created_at?: string
          first_message?: string | null
          first_message_mode?: string
          id?: string
          is_default?: boolean
          language?: string
          max_tokens?: number | null
          name: string
          organization_id: string
          retell_agent_id: string
          settings?: Json | null
          status?: string
          system_prompt?: string | null
          temperature?: number | null
          transfer_number?: string | null
          updated_at?: string
          voice?: string | null
          warm_transfer_enabled?: boolean
        }
        Update: {
          call_recording_enabled?: boolean
          created_at?: string
          first_message?: string | null
          first_message_mode?: string
          id?: string
          is_default?: boolean
          language?: string
          max_tokens?: number | null
          name?: string
          organization_id?: string
          retell_agent_id?: string
          settings?: Json | null
          status?: string
          system_prompt?: string | null
          temperature?: number | null
          transfer_number?: string | null
          updated_at?: string
          voice?: string | null
          warm_transfer_enabled?: boolean
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          lead_id: string | null
          meeting_link: string | null
          metadata: Json | null
          organization_id: string
          scheduled_at: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          lead_id?: string | null
          meeting_link?: string | null
          metadata?: Json | null
          organization_id: string
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          lead_id?: string | null
          meeting_link?: string | null
          metadata?: Json | null
          organization_id?: string
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_role_snapshot: string
          actor_user_id: string | null
          channel: string
          created_at: string
          error_code: string | null
          id: string
          ip_hash: string | null
          metadata: Json | null
          organization_id: string
          request_id: string | null
          status: string
          target_id: string | null
          target_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_role_snapshot: string
          actor_user_id?: string | null
          channel?: string
          created_at?: string
          error_code?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          organization_id: string
          request_id?: string | null
          status?: string
          target_id?: string | null
          target_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_role_snapshot?: string
          actor_user_id?: string | null
          channel?: string
          created_at?: string
          error_code?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          organization_id?: string
          request_id?: string | null
          status?: string
          target_id?: string | null
          target_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          agent_name: string | null
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          organization_id: string
          phone_number: string | null
          recording_url: string | null
          sentiment: string | null
          started_at: string | null
          status: string
          summary: string | null
          transcript: string | null
          updated_at: string | null
        }
        Insert: {
          agent_name?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          organization_id: string
          phone_number?: string | null
          recording_url?: string | null
          sentiment?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          transcript?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_name?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          organization_id?: string
          phone_number?: string | null
          recording_url?: string | null
          sentiment?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          transcript?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sessions: {
        Row: {
          actions_performed: Json | null
          created_at: string
          id: string
          ip_address: unknown | null
          last_activity: string
          metadata: Json | null
          session_id: string
          user_agent: string | null
        }
        Insert: {
          actions_performed?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown | null
          last_activity?: string
          metadata?: Json | null
          session_id: string
          user_agent?: string | null
        }
        Update: {
          actions_performed?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown | null
          last_activity?: string
          metadata?: Json | null
          session_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      embeddings: {
        Row: {
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          kb_file_id: string | null
          metadata: Json | null
          organization_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          kb_file_id?: string | null
          metadata?: Json | null
          organization_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          kb_file_id?: string | null
          metadata?: Json | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_kb_file_id_fkey"
            columns: ["kb_file_id"]
            isOneToOne: false
            referencedRelation: "kb_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embeddings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_files: {
        Row: {
          content_preview: string | null
          created_at: string | null
          file_size: number | null
          file_type: string | null
          id: string
          metadata: Json | null
          name: string
          organization_id: string
          processing_status: string | null
          storage_path: string | null
          updated_at: string | null
        }
        Insert: {
          content_preview?: string | null
          created_at?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          metadata?: Json | null
          name: string
          organization_id: string
          processing_status?: string | null
          storage_path?: string | null
          updated_at?: string | null
        }
        Update: {
          content_preview?: string | null
          created_at?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          organization_id?: string
          processing_status?: string | null
          storage_path?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          metadata: Json | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          source: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string | null
          role: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          role: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          role?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          message_type: string | null
          metadata: Json | null
          organization_id: string
          sender_name: string | null
          sender_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          message_type?: string | null
          metadata?: Json | null
          organization_id: string
          sender_name?: string | null
          sender_type: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          message_type?: string | null
          metadata?: Json | null
          organization_id?: string
          sender_name?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_stripe_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          organization_id: string
          plan_key: string | null
          quantity: number | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id: string
          plan_key?: string | null
          quantity?: number | null
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string
          plan_key?: string | null
          quantity?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      org_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          org_id: string
          price_id: string | null
          product_id: string | null
          quantity: number | null
          status: string
          stripe_subscription_id: string | null
          subscription_item_id: string | null
          trial_end: string | null
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id: string
          price_id?: string | null
          product_id?: string | null
          quantity?: number | null
          status: string
          stripe_subscription_id?: string | null
          subscription_item_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id?: string
          price_id?: string | null
          product_id?: string | null
          quantity?: number | null
          status?: string
          stripe_subscription_id?: string | null
          subscription_item_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invite_token: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: Database["public"]["Enums"]["invitation_status"]
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invite_token: string
          invited_by?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          seat_active: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          seat_active?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          seat_active?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_status: string | null
          created_at: string | null
          entitlements: Json | null
          id: string
          name: string
          owner_user_id: string | null
          plan_key: string | null
          stripe_customer_id: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
        }
        Insert: {
          billing_status?: string | null
          created_at?: string | null
          entitlements?: Json | null
          id?: string
          name: string
          owner_user_id?: string | null
          plan_key?: string | null
          stripe_customer_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
        }
        Update: {
          billing_status?: string | null
          created_at?: string | null
          entitlements?: Json | null
          id?: string
          name?: string
          owner_user_id?: string | null
          plan_key?: string | null
          stripe_customer_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
        }
        Relationships: []
      }
      plan_configs: {
        Row: {
          created_at: string
          display_name: string
          features: string[] | null
          id: string
          is_active: boolean
          limits: Json
          plan_key: string
          price_monthly: number | null
          price_yearly: number | null
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          features?: string[] | null
          id?: string
          is_active?: boolean
          limits?: Json
          plan_key: string
          price_monthly?: number | null
          price_yearly?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          features?: string[] | null
          id?: string
          is_active?: boolean
          limits?: Json
          plan_key?: string
          price_monthly?: number | null
          price_yearly?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_org_id: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_org_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_org_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      test_logs: {
        Row: {
          created_at: string
          details: Json | null
          duration_ms: number | null
          environment: string | null
          git_commit: string | null
          id: string
          message: string | null
          organization_id: string | null
          status: string
          test_name: string
          test_runner: string | null
          test_session_id: string
          test_suite: string
          test_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          environment?: string | null
          git_commit?: string | null
          id?: string
          message?: string | null
          organization_id?: string | null
          status: string
          test_name: string
          test_runner?: string | null
          test_session_id?: string
          test_suite: string
          test_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          environment?: string | null
          git_commit?: string | null
          id?: string
          message?: string | null
          organization_id?: string | null
          status?: string
          test_name?: string
          test_runner?: string | null
          test_session_id?: string
          test_suite?: string
          test_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          cost_cents: number | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          organization_id: string
          quantity: number | null
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          cost_cents?: number | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
          quantity?: number | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          cost_cents?: number | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          quantity?: number | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: {
        Args: { p_token: string }
        Returns: Json
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      can_perform_action: {
        Args: { p_action: string; p_org_id: string; p_resource_type?: string }
        Returns: boolean
      }
      create_invite: {
        Args:
          | {
              invite_email: string
              invite_role: Database["public"]["Enums"]["org_role"]
              org_id: string
            }
          | { p_email: string; p_org: string; p_role: string }
        Returns: Json
      }
      create_organization: {
        Args: { name: string; slug: string }
        Returns: string
      }
      create_organization_with_owner: {
        Args: { p_name: string; p_slug: string }
        Returns: string
      }
      get_user_org_role: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: string
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      has_feature: {
        Args: { p_feature: string; p_org_id: string }
        Returns: boolean
      }
      has_org_role: {
        Args: { org_id: string; required_role: string }
        Returns: boolean
      }
      hash_ip: {
        Args: { ip_address: string }
        Returns: string
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      insert_audit_log: {
        Args: {
          p_action: string
          p_actor_role_snapshot?: string
          p_actor_user_id?: string
          p_channel?: string
          p_error_code?: string
          p_ip_hash?: string
          p_metadata?: Json
          p_org_id: string
          p_request_id?: string
          p_status?: string
          p_target_id?: string
          p_target_type: string
          p_user_agent?: string
        }
        Returns: string
      }
      is_org_admin: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_org_owner: {
        Args: { org_id: string }
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      list_audit_log: {
        Args: {
          p_cursor?: string
          p_filters?: Json
          p_limit?: number
          p_org_id: string
        }
        Returns: {
          action: string
          actor_role_snapshot: string
          actor_user_id: string
          channel: string
          created_at: string
          error_code: string
          has_more: boolean
          id: string
          metadata: Json
          organization_id: string
          status: string
          target_id: string
          target_type: string
        }[]
      }
      log_activity: {
        Args: {
          p_action: string
          p_details?: Json
          p_org_id: string
          p_resource_id?: string
          p_resource_type?: string
          p_user_id: string
        }
        Returns: string
      }
      log_activity_event: {
        Args: {
          p_action: string
          p_actor_role_snapshot?: string
          p_actor_user_id?: string
          p_channel?: string
          p_error_code?: string
          p_ip_hash?: string
          p_metadata?: Json
          p_org_id: string
          p_request_id?: string
          p_status?: string
          p_target_id?: string
          p_target_type: string
          p_user_agent?: string
        }
        Returns: string
      }
      log_event: {
        Args: {
          p_action: string
          p_actor_role_snapshot?: string
          p_actor_user_id?: string
          p_channel?: string
          p_error_code?: string
          p_metadata?: Json
          p_org_id: string
          p_status?: string
          p_target_id?: string
          p_target_type: string
        }
        Returns: string
      }
      log_test_outcome: {
        Args: {
          p_details?: Json
          p_duration_ms?: number
          p_environment?: string
          p_git_commit?: string
          p_message?: string
          p_org_id: string
          p_session_id: string
          p_status: string
          p_test_name: string
          p_test_runner?: string
          p_test_suite: string
          p_test_type: string
        }
        Returns: string
      }
      normalize_role_value: {
        Args: { input_role: string }
        Returns: string
      }
      setup_user_account: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      trim_user_agent: {
        Args: { user_agent_string: string }
        Returns: string
      }
      validate_role_constraint: {
        Args: { role_value: string }
        Returns: boolean
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      billing_tier: "free" | "pro"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      org_role: "admin" | "editor" | "viewer" | "user"
      role: "admin" | "editor" | "viewer" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      billing_tier: ["free", "pro"],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      org_role: ["admin", "editor", "viewer", "user"],
      role: ["admin", "editor", "viewer", "user"],
    },
  },
} as const
