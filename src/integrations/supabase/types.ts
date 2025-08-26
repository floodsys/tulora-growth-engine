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
      alert_rules: {
        Row: {
          conditions: Json
          created_at: string
          description: string
          id: string
          is_enabled: boolean
          organization_id: string
          rule_name: string
          severity: string
          threshold_count: number
          time_window_minutes: number
          updated_at: string
        }
        Insert: {
          conditions: Json
          created_at?: string
          description: string
          id?: string
          is_enabled?: boolean
          organization_id: string
          rule_name: string
          severity?: string
          threshold_count: number
          time_window_minutes: number
          updated_at?: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          description?: string
          id?: string
          is_enabled?: boolean
          organization_id?: string
          rule_name?: string
          severity?: string
          threshold_count?: number
          time_window_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string
          description: string
          id: string
          organization_id: string
          resolved_at: string | null
          resolved_by: string | null
          rule_name: string
          severity: string
          source_events: Json
          status: string
          threshold_data: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          organization_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          rule_name: string
          severity?: string
          source_events?: Json
          status?: string
          threshold_data?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          organization_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          rule_name?: string
          severity?: string
          source_events?: Json
          status?: string
          threshold_data?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      blocked_operations_tracking: {
        Row: {
          blocked_count: number
          created_at: string
          first_blocked_at: string
          id: string
          ip_address: unknown | null
          last_blocked_at: string
          organization_id: string
          updated_at: string
          window_start: string
        }
        Insert: {
          blocked_count?: number
          created_at?: string
          first_blocked_at?: string
          id?: string
          ip_address?: unknown | null
          last_blocked_at?: string
          organization_id: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          blocked_count?: number
          created_at?: string
          first_blocked_at?: string
          id?: string
          ip_address?: unknown | null
          last_blocked_at?: string
          organization_id?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_operations_tracking_organization_id_fkey"
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
      memberships_deprecated_legacy: {
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
        Relationships: [
          {
            foreignKeyName: "fk_org_stripe_subscriptions_organization_id"
            columns: ["organization_id"]
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
          analytics_config: Json | null
          billing_status: string | null
          canceled_at: string | null
          created_at: string | null
          entitlements: Json | null
          export_before_purge: Json | null
          id: string
          industry: string | null
          legal_hold_enabled: boolean | null
          name: string
          owner_user_id: string | null
          plan_key: string | null
          retention_config: Json | null
          size_band: string | null
          status: string | null
          stripe_customer_id: string | null
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          webhook_config: Json | null
          website: string | null
        }
        Insert: {
          analytics_config?: Json | null
          billing_status?: string | null
          canceled_at?: string | null
          created_at?: string | null
          entitlements?: Json | null
          export_before_purge?: Json | null
          id?: string
          industry?: string | null
          legal_hold_enabled?: boolean | null
          name: string
          owner_user_id?: string | null
          plan_key?: string | null
          retention_config?: Json | null
          size_band?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          webhook_config?: Json | null
          website?: string | null
        }
        Update: {
          analytics_config?: Json | null
          billing_status?: string | null
          canceled_at?: string | null
          created_at?: string | null
          entitlements?: Json | null
          export_before_purge?: Json | null
          id?: string
          industry?: string | null
          legal_hold_enabled?: boolean | null
          name?: string
          owner_user_id?: string | null
          plan_key?: string | null
          retention_config?: Json | null
          size_band?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          webhook_config?: Json | null
          website?: string | null
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
      rate_limit_configs: {
        Row: {
          created_at: string
          endpoint: string
          exponential_backoff_base_seconds: number | null
          id: string
          is_active: boolean
          max_backoff_seconds: number | null
          max_requests_per_hour: number | null
          max_requests_per_minute: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          exponential_backoff_base_seconds?: number | null
          id?: string
          is_active?: boolean
          max_backoff_seconds?: number | null
          max_requests_per_hour?: number | null
          max_requests_per_minute: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          exponential_backoff_base_seconds?: number | null
          id?: string
          is_active?: boolean
          max_backoff_seconds?: number | null
          max_requests_per_hour?: number | null
          max_requests_per_minute?: number
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action_type: string
          blocked_until: string | null
          created_at: string
          endpoint: string
          exponential_backoff_level: number | null
          id: string
          ip_address: unknown | null
          last_request_at: string
          request_count: number
          updated_at: string
          user_id: string | null
          window_start: string
        }
        Insert: {
          action_type: string
          blocked_until?: string | null
          created_at?: string
          endpoint: string
          exponential_backoff_level?: number | null
          id?: string
          ip_address?: unknown | null
          last_request_at?: string
          request_count?: number
          updated_at?: string
          user_id?: string | null
          window_start?: string
        }
        Update: {
          action_type?: string
          blocked_until?: string | null
          created_at?: string
          endpoint?: string
          exponential_backoff_level?: number | null
          id?: string
          ip_address?: unknown | null
          last_request_at?: string
          request_count?: number
          updated_at?: string
          user_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      step_up_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          session_token: string
          used_for_actions: string[] | null
          user_id: string
          verification_method: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          session_token?: string
          used_for_actions?: string[] | null
          user_id: string
          verification_method: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          session_token?: string
          used_for_actions?: string[] | null
          user_id?: string
          verification_method?: string
        }
        Relationships: []
      }
      superadmins: {
        Row: {
          added_by: string | null
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string
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
      org_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string | null
          org_id: string | null
          price_id: string | null
          product_id: string | null
          quantity: number | null
          status: string | null
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
          id?: string | null
          org_id?: string | null
          price_id?: never
          product_id?: never
          quantity?: number | null
          status?: string | null
          stripe_subscription_id?: string | null
          subscription_item_id?: never
          trial_end?: string | null
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string | null
          org_id?: string | null
          price_id?: never
          product_id?: never
          quantity?: number | null
          status?: string | null
          stripe_subscription_id?: string | null
          subscription_item_id?: never
          trial_end?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_stripe_subscriptions_organization_id"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invite: {
        Args: { p_token: string }
        Returns: Json
      }
      activate_seat_and_get_status: {
        Args: { p_org_id: string }
        Returns: Json
      }
      add_superadmin: {
        Args: { p_user_email: string }
        Returns: Json
      }
      admin_change_member_role: {
        Args: {
          p_admin_user_id?: string
          p_new_role: Database["public"]["Enums"]["org_role"]
          p_organization_id: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_destructive_action: {
        Args: {
          p_action: string
          p_confirmation: string
          p_expected_confirmation: string
          p_metadata?: Json
          p_org_id?: string
          p_reason: string
          p_target_id: string
          p_target_type: string
        }
        Returns: Json
      }
      admin_get_all_members: {
        Args: { p_limit?: number; p_search_email?: string }
        Returns: {
          email: string
          joined_at: string
          last_activity: string
          organization_id: string
          organization_name: string
          role: string
          seat_active: boolean
          user_id: string
        }[]
      }
      admin_remove_member: {
        Args: {
          p_admin_user_id?: string
          p_organization_id: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_toggle_member_seat: {
        Args: {
          p_admin_user_id?: string
          p_organization_id: string
          p_seat_active: boolean
          p_user_id: string
        }
        Returns: Json
      }
      backfill_audit_logs: {
        Args: {
          p_batch_size?: number
          p_dry_run?: boolean
          p_org_id?: string
          p_org_ids?: string[]
        }
        Returns: Json
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      bootstrap_superadmin: {
        Args: { p_bootstrap_token: string }
        Returns: Json
      }
      can_perform_action: {
        Args: { p_action: string; p_org_id: string; p_resource_type?: string }
        Returns: boolean
      }
      cancel_organization: {
        Args: { p_canceled_by?: string; p_org_id: string; p_reason: string }
        Returns: Json
      }
      check_admin_access: {
        Args: { p_org_id: string; p_user_id?: string }
        Returns: boolean
      }
      check_alert_rules: {
        Args: { p_org_id: string }
        Returns: Json
      }
      check_org_member_access: {
        Args: { target_org_id: string; target_user_id?: string }
        Returns: boolean
      }
      check_org_membership: {
        Args: { p_org_id: string; p_user_id?: string }
        Returns: boolean
      }
      check_org_ownership: {
        Args: { p_org_id: string; p_user_id?: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_ip_address?: unknown
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: Json
      }
      check_step_up_auth: {
        Args: { p_action?: string }
        Returns: boolean
      }
      check_superadmin_mfa_recent: {
        Args: { user_id?: string }
        Returns: boolean
      }
      cleanup_expired_logs: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cleanup_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
      create_token_fingerprint: {
        Args: { issuer?: string; token_value: string }
        Returns: string
      }
      export_logs_before_purge: {
        Args: { p_channel?: string; p_org_id: string }
        Returns: {
          action: string
          actor_role_snapshot: string
          actor_user_id: string
          channel: string
          created_at: string
          error_code: string
          id: string
          metadata: Json
          status: string
          target_id: string
          target_type: string
        }[]
      }
      get_effective_retention_config: {
        Args: { org_id: string }
        Returns: Json
      }
      get_schema_health: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_security_snapshot: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_user_org_role: {
        Args: { p_org_id: string; p_user_id?: string }
        Returns: Json
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
      is_org_active: {
        Args: { p_org_id: string }
        Returns: boolean
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
      is_org_suspended: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_org_suspended_or_canceled: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_organization_owner: {
        Args: { p_org_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_superadmin: {
        Args: { user_id?: string }
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
        Args:
          | {
              p_action: string
              p_actor_role_snapshot?: string
              p_actor_user_id?: string
              p_channel?: string
              p_error_code?: string
              p_metadata?: Json
              p_org_id: string
              p_request_id?: string
              p_status?: string
              p_target_id?: string
              p_target_type: string
            }
          | {
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
      log_mfa_required: {
        Args: { p_action: string; p_resource: string }
        Returns: undefined
      }
      log_org_update_attempt: {
        Args: {
          p_action: string
          p_additional_metadata?: Json
          p_function_path?: string
          p_org_id: string
          p_user_id?: string
        }
        Returns: string
      }
      log_rate_limit_violation: {
        Args: {
          p_backoff_level: number
          p_current_count: number
          p_endpoint: string
          p_ip_address: unknown
          p_limit: number
          p_user_agent?: string
          p_user_id: string
          p_violation_type: string
        }
        Returns: undefined
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
      log_unauthorized_access: {
        Args: {
          p_attempted_action: string
          p_attempted_resource: string
          p_org_id?: string
          p_user_id?: string
        }
        Returns: undefined
      }
      make_user_org_admin: {
        Args: { p_org_id: string; p_user_id?: string }
        Returns: Json
      }
      normalize_role_value: {
        Args: { input_role: string }
        Returns: string
      }
      reinstate_organization: {
        Args: { p_org_id: string; p_reason: string; p_reinstated_by?: string }
        Returns: Json
      }
      remove_superadmin: {
        Args: { p_user_email: string }
        Returns: Json
      }
      require_step_up_auth: {
        Args: { p_action: string }
        Returns: Json
      }
      run_rls_acceptance_tests: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      seed_default_alert_rules: {
        Args: { p_org_id: string }
        Returns: undefined
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
      suspend_organization: {
        Args: { p_org_id: string; p_reason: string; p_suspended_by?: string }
        Returns: Json
      }
      test_rls_functions: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      test_rls_regression_tripwire: {
        Args: { p_random_org_id?: string; p_random_user_id?: string }
        Returns: Json
      }
      track_blocked_operation: {
        Args: { p_ip_address?: unknown; p_org_id: string }
        Returns: Json
      }
      transfer_organization_ownership: {
        Args: {
          p_keep_old_owner_as_admin?: boolean
          p_new_owner_user_id: string
          p_org_id: string
        }
        Returns: Json
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
      verify_step_up_auth: {
        Args: { p_mfa_code?: string; p_password?: string }
        Returns: Json
      }
      would_leave_org_without_admins: {
        Args: { p_org_id: string; p_user_id_to_remove: string }
        Returns: boolean
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
