/**
 * Agent Lifecycle Status Helpers for Edge Functions
 * 
 * This module provides server-side enforcement of the agent lifecycle state machine.
 * Use these helpers to ensure calls are only allowed for agents in appropriate states.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

/**
 * Valid agent status values.
 * MUST be kept in sync with:
 * - src/lib/agents/types.ts (frontend)
 * - supabase/migrations/20251209180000_agent_lifecycle_status_enum.sql (database)
 */
export const AgentStatus = {
  DRAFT: 'DRAFT',
  TESTING: 'TESTING',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED',
} as const

export type AgentStatusType = (typeof AgentStatus)[keyof typeof AgentStatus]

/**
 * Legacy status map for backward compatibility during migration.
 */
const LEGACY_STATUS_MAP: Record<string, AgentStatusType> = {
  'draft': AgentStatus.DRAFT,
  'published': AgentStatus.ACTIVE,
}

/**
 * Normalize a status value to the new format.
 */
export function normalizeStatus(status: string | null | undefined): AgentStatusType {
  if (!status) return AgentStatus.DRAFT

  const upper = status.toUpperCase()
  if (Object.values(AgentStatus).includes(upper as AgentStatusType)) {
    return upper as AgentStatusType
  }

  const legacy = LEGACY_STATUS_MAP[status.toLowerCase()]
  if (legacy) return legacy

  return AgentStatus.DRAFT
}

/**
 * Allowed state transitions.
 */
export const ALLOWED_TRANSITIONS: Record<AgentStatusType, AgentStatusType[]> = {
  [AgentStatus.DRAFT]: [AgentStatus.TESTING, AgentStatus.ARCHIVED],
  [AgentStatus.TESTING]: [AgentStatus.DRAFT, AgentStatus.ACTIVE, AgentStatus.ARCHIVED],
  [AgentStatus.ACTIVE]: [AgentStatus.PAUSED, AgentStatus.ARCHIVED],
  [AgentStatus.PAUSED]: [AgentStatus.ACTIVE, AgentStatus.ARCHIVED],
  [AgentStatus.ARCHIVED]: [],
}

/**
 * Check if a transition is valid.
 */
export function isValidTransition(from: AgentStatusType, to: AgentStatusType): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Result of checking if an agent can be used for calls.
 */
export interface AgentCallCheckResult {
  allowed: boolean
  agent?: {
    id: string
    agent_id: string
    organization_id: string
    name: string
    status: AgentStatusType
  }
  error?: {
    code: 'AGENT_NOT_FOUND' | 'AGENT_INACTIVE' | 'AGENT_STATUS_BLOCKED'
    message: string
    status: AgentStatusType | null
    httpStatus: number
  }
}

/**
 * Check if an agent is allowed to receive production calls (widgets, dial, etc.).
 * Only ACTIVE agents can receive production calls.
 * 
 * @param supabase - Supabase client (service role recommended)
 * @param agentId - The Retell agent_id (not the UUID)
 * @param traceId - Optional trace ID for logging
 */
export async function checkAgentForCalls(
  supabase: SupabaseClient,
  agentId: string,
  traceId?: string
): Promise<AgentCallCheckResult> {
  const log = (msg: string) => console.log(`[${traceId || 'unknown'}] ${msg}`)

  const { data: agent, error } = await supabase
    .from('retell_agents')
    .select('id, agent_id, organization_id, name, status, is_active')
    .eq('agent_id', agentId)
    .single()

  if (error || !agent) {
    log(`Agent not found: ${agentId}`)
    return {
      allowed: false,
      error: {
        code: 'AGENT_NOT_FOUND',
        message: `Agent not found: ${agentId}`,
        status: null,
        httpStatus: 404,
      }
    }
  }

  // Check soft-delete flag
  if (!agent.is_active) {
    log(`Agent is inactive (soft-deleted): ${agentId}`)
    return {
      allowed: false,
      error: {
        code: 'AGENT_INACTIVE',
        message: `Agent is not active: ${agentId}`,
        status: normalizeStatus(agent.status),
        httpStatus: 410, // Gone
      }
    }
  }

  const status = normalizeStatus(agent.status)

  // Only ACTIVE agents can receive production calls
  if (status !== AgentStatus.ACTIVE) {
    log(`Agent status '${status}' does not allow calls: ${agentId}`)
    return {
      allowed: false,
      agent: {
        id: agent.id,
        agent_id: agent.agent_id,
        organization_id: agent.organization_id,
        name: agent.name,
        status,
      },
      error: {
        code: 'AGENT_STATUS_BLOCKED',
        message: `Agent is in ${status} status. Only ACTIVE agents can receive production calls.`,
        status,
        httpStatus: 403,
      }
    }
  }

  log(`Agent ${agentId} is ACTIVE, calls allowed`)
  return {
    allowed: true,
    agent: {
      id: agent.id,
      agent_id: agent.agent_id,
      organization_id: agent.organization_id,
      name: agent.name,
      status,
    }
  }
}

/**
 * Check if an agent is allowed to receive TEST calls.
 * TESTING and ACTIVE agents can receive test calls.
 * 
 * @param supabase - Supabase client (service role recommended)
 * @param agentId - The Retell agent_id (not the UUID)
 * @param traceId - Optional trace ID for logging
 */
export async function checkAgentForTestCalls(
  supabase: SupabaseClient,
  agentId: string,
  traceId?: string
): Promise<AgentCallCheckResult> {
  const log = (msg: string) => console.log(`[${traceId || 'unknown'}] ${msg}`)

  const { data: agent, error } = await supabase
    .from('retell_agents')
    .select('id, agent_id, organization_id, name, status, is_active')
    .eq('agent_id', agentId)
    .single()

  if (error || !agent) {
    log(`Agent not found: ${agentId}`)
    return {
      allowed: false,
      error: {
        code: 'AGENT_NOT_FOUND',
        message: `Agent not found: ${agentId}`,
        status: null,
        httpStatus: 404,
      }
    }
  }

  if (!agent.is_active) {
    log(`Agent is inactive (soft-deleted): ${agentId}`)
    return {
      allowed: false,
      error: {
        code: 'AGENT_INACTIVE',
        message: `Agent is not active: ${agentId}`,
        status: normalizeStatus(agent.status),
        httpStatus: 410,
      }
    }
  }

  const status = normalizeStatus(agent.status)

  // TESTING and ACTIVE agents can receive test calls
  if (status !== AgentStatus.TESTING && status !== AgentStatus.ACTIVE) {
    log(`Agent status '${status}' does not allow test calls: ${agentId}`)
    return {
      allowed: false,
      agent: {
        id: agent.id,
        agent_id: agent.agent_id,
        organization_id: agent.organization_id,
        name: agent.name,
        status,
      },
      error: {
        code: 'AGENT_STATUS_BLOCKED',
        message: `Agent is in ${status} status. Only TESTING or ACTIVE agents can receive test calls.`,
        status,
        httpStatus: 403,
      }
    }
  }

  log(`Agent ${agentId} allows test calls (status: ${status})`)
  return {
    allowed: true,
    agent: {
      id: agent.id,
      agent_id: agent.agent_id,
      organization_id: agent.organization_id,
      name: agent.name,
      status,
    }
  }
}

/**
 * Create a standardized error response for agent status issues.
 */
export function createAgentStatusErrorResponse(
  result: AgentCallCheckResult,
  corsHeaders: Record<string, string>,
  traceId?: string
): Response {
  if (result.allowed || !result.error) {
    throw new Error('Cannot create error response for allowed result')
  }

  return new Response(
    JSON.stringify({
      error: result.error.code,
      message: result.error.message,
      agent_status: result.error.status,
      agent_id: result.agent?.agent_id,
      traceId,
    }),
    {
      status: result.error.httpStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Log agent status change event.
 * This provides consistent telemetry for all status transitions.
 * 
 * @param params - Status change parameters
 */
export function logAgentStatusChange(params: {
  agentId: string
  agentUuid: string
  organizationId: string
  oldStatus: AgentStatusType | null
  newStatus: AgentStatusType
  triggeredBy?: string
  traceId?: string
}): void {
  const { agentId, agentUuid, organizationId, oldStatus, newStatus, triggeredBy, traceId } = params

  // Structured log event for telemetry/monitoring
  const logEvent = {
    action: 'agent.status_change',
    timestamp: new Date().toISOString(),
    agent_id: agentId,
    agent_uuid: agentUuid,
    org_id: organizationId,
    old_status: oldStatus,
    new_status: newStatus,
    triggered_by: triggeredBy || 'unknown',
    trace_id: traceId || 'unknown'
  }

  // Log as structured JSON for easy parsing by log aggregators
  console.log(`[agent.status_change] ${JSON.stringify(logEvent)}`)

  // Also log human-readable version
  const oldStatusStr = oldStatus || 'null'
  console.log(
    `[${traceId || 'unknown'}] Agent status change: ` +
    `agent_id=${agentId} org_id=${organizationId} ` +
    `${oldStatusStr} → ${newStatus}`
  )
}

/**
 * Transition an agent to a new status.
 * Validates the transition is allowed before updating.
 * 
 * @param supabase - Supabase client (service role required)
 * @param agentUuid - The agent's UUID (not agent_id)
 * @param toStatus - The target status
 * @param triggeredBy - Optional user/system identifier that triggered the change
 * @param traceId - Optional trace ID for logging
 */
export async function transitionAgentStatus(
  supabase: SupabaseClient,
  agentUuid: string,
  toStatus: AgentStatusType,
  triggeredBy?: string,
  traceId?: string
): Promise<{
  success: boolean
  previousStatus?: AgentStatusType
  newStatus?: AgentStatusType
  error?: string
}> {
  const log = (msg: string) => console.log(`[${traceId || 'unknown'}] ${msg}`)

  // Get current agent status
  const { data: agent, error: fetchError } = await supabase
    .from('retell_agents')
    .select('id, agent_id, organization_id, status')
    .eq('id', agentUuid)
    .single()

  if (fetchError || !agent) {
    log(`Agent not found: ${agentUuid}`)
    return { success: false, error: `Agent not found: ${agentUuid}` }
  }

  const fromStatus = normalizeStatus(agent.status)

  // Check if transition is valid
  if (!isValidTransition(fromStatus, toStatus)) {
    const allowed = ALLOWED_TRANSITIONS[fromStatus].join(', ') || 'none'
    log(`Invalid transition ${fromStatus} → ${toStatus}. Allowed: [${allowed}]`)
    return {
      success: false,
      previousStatus: fromStatus,
      error: `Invalid transition from ${fromStatus} to ${toStatus}. Allowed: [${allowed}]`,
    }
  }

  // Build update object with timestamp
  const updateData: Record<string, any> = {
    status: toStatus,
    updated_at: new Date().toISOString(),
  }

  // Set appropriate timestamp based on target status
  switch (toStatus) {
    case AgentStatus.TESTING:
      updateData.testing_started_at = new Date().toISOString()
      break
    case AgentStatus.ACTIVE:
      updateData.activated_at = new Date().toISOString()
      break
    case AgentStatus.PAUSED:
      updateData.paused_at = new Date().toISOString()
      break
    case AgentStatus.ARCHIVED:
      updateData.archived_at = new Date().toISOString()
      break
  }

  // Perform the update
  const { error: updateError } = await supabase
    .from('retell_agents')
    .update(updateData)
    .eq('id', agentUuid)

  if (updateError) {
    log(`Failed to transition agent: ${updateError.message}`)
    return {
      success: false,
      previousStatus: fromStatus,
      error: `Database error: ${updateError.message}`,
    }
  }

  // LOG STATUS CHANGE EVENT for telemetry
  logAgentStatusChange({
    agentId: agent.agent_id,
    agentUuid: agent.id,
    organizationId: agent.organization_id,
    oldStatus: fromStatus,
    newStatus: toStatus,
    triggeredBy,
    traceId
  })

  return {
    success: true,
    previousStatus: fromStatus,
    newStatus: toStatus,
  }
}
