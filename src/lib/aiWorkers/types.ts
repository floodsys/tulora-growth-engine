/**
 * AI Workers Types
 * 
 * Defines the data model for the unified AI Workers dashboard view,
 * which combines agent, number, and usage data into a single row representation.
 */

import { AgentStatusType, AgentStatus } from '@/lib/agents/types';

export { AgentStatus };
export type { AgentStatusType };

/**
 * A single AI Worker row for the dashboard view.
 * Combines agent information with linked numbers and usage metrics.
 */
export interface AiWorkerRow {
  /** Agent ID (primary key from retell_agents) */
  id: string;

  /** Retell agent_id (external ID) */
  agent_id: string;

  /** Display name of the agent */
  name: string;

  /** Optional description of the agent's purpose */
  description?: string;

  /** Organization ID this agent belongs to */
  organization_id: string;

  /** Current lifecycle status from the state machine */
  status: AgentStatusType;

  /** Array of linked phone numbers in E.164 format or short descriptors */
  linked_numbers: LinkedNumber[];

  /** ISO timestamp of the last call made/received by this agent */
  last_call_at?: string;

  /** Simple label for the last call result (e.g., "completed", "failed", "no_answer") */
  last_call_result?: string;

  /** Last call duration in seconds */
  last_call_duration?: number;

  /** Number of calls this month */
  month_calls?: number;

  /** Total minutes of calls this month */
  month_minutes?: number;

  /** Agent creation timestamp */
  created_at: string;

  /** Agent last updated timestamp */
  updated_at: string;

  /** Voice ID used by this agent */
  voice_id?: string;

  /** Language code (e.g., "en") */
  language?: string;
}

/**
 * Linked phone number information for an AI Worker.
 */
export interface LinkedNumber {
  /** E.164 formatted phone number */
  e164: string;

  /** Type of linkage: inbound, outbound, or both */
  type: 'inbound' | 'outbound' | 'both';

  /** Country code */
  country?: string;
}

/**
 * Filter options for the AI Workers list.
 */
export interface AiWorkersFilter {
  /** Filter by status */
  status?: AgentStatusType | AgentStatusType[];

  /** Filter by agents with/without linked numbers */
  hasNumbers?: boolean;

  /** Search query for name */
  search?: string;

  /** Exclude ARCHIVED agents from the list (default behavior in UI) */
  excludeArchived?: boolean;

  /** Pagination limit */
  limit?: number;

  /** Pagination offset */
  offset?: number;
}

/**
 * Response from the AI Workers list fetch.
 */
export interface AiWorkersResponse {
  workers: AiWorkerRow[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Summary statistics for the AI Workers dashboard header.
 */
export interface AiWorkersSummary {
  /** Total number of workers */
  totalWorkers: number;

  /** Number of active workers */
  activeWorkers: number;

  /** Number of workers in testing */
  testingWorkers: number;

  /** Number of paused workers */
  pausedWorkers: number;

  /** Total linked numbers across all workers */
  totalLinkedNumbers: number;

  /** Total calls this month across all workers */
  totalMonthCalls: number;

  /** Total minutes this month across all workers */
  totalMonthMinutes: number;
}

/**
 * CRM sync status for the organization.
 * Aggregated from crm_outbox table.
 */
export interface CrmSyncStatus {
  /** Whether CRM is configured for this organization */
  configured: boolean;

  /** Number of leads successfully synced to CRM */
  syncedCount: number;

  /** Number of leads pending CRM sync */
  pendingCount: number;

  /** Number of leads that failed CRM sync */
  failedCount: number;

  /** Most recent sync error message (if any) */
  lastError?: string;

  /** Timestamp of last successful sync */
  lastSyncedAt?: string;
}
