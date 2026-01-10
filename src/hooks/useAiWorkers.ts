/**
 * useAiWorkers Hook
 * 
 * Fetches and combines agent, number, and call data into unified AiWorkerRow[] format.
 * This is the primary data source for the AI Workers dashboard.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import {
  AiWorkerRow,
  AiWorkersFilter,
  AiWorkersResponse,
  AiWorkersSummary,
  LinkedNumber,
  CrmSyncStatus
} from '@/lib/aiWorkers/types'
import { normalizeAgentStatus, AgentStatus, AgentStatusType } from '@/lib/agents/types'

interface UseAiWorkersOptions {
  organizationId?: string | null
  filters?: AiWorkersFilter
  autoRefresh?: boolean
  refreshInterval?: number // ms, default 30000
}

interface UseAiWorkersReturn {
  workers: AiWorkerRow[]
  summary: AiWorkersSummary | null
  crmStatus: CrmSyncStatus | null
  pagination: AiWorkersResponse['pagination']
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  updateWorkerStatus: (workerId: string, newStatus: AgentStatusType) => Promise<boolean>
}

export function useAiWorkers(options: UseAiWorkersOptions = {}): UseAiWorkersReturn {
  const {
    organizationId,
    filters,
    autoRefresh = false,
    refreshInterval = 30000
  } = options

  const [workers, setWorkers] = useState<AiWorkerRow[]>([])
  const [summary, setSummary] = useState<AiWorkersSummary | null>(null)
  const [crmStatus, setCrmStatus] = useState<CrmSyncStatus | null>(null)
  const [pagination, setPagination] = useState<AiWorkersResponse['pagination']>({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { toast } = useToast()

  const fetchWorkers = useCallback(async () => {
    if (!organizationId) {
      setWorkers([])
      setSummary(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // 1. Fetch agents with optional filters
      let agentsQuery = supabase
        .from('retell_agents')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      // Apply status filter
      if (filters?.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
        agentsQuery = agentsQuery.in('status', statuses)
      } else if (filters?.excludeArchived) {
        // By default, exclude ARCHIVED unless explicitly viewing them
        agentsQuery = agentsQuery.neq('status', AgentStatus.ARCHIVED)
      }

      // Apply search filter
      if (filters?.search) {
        agentsQuery = agentsQuery.ilike('name', `%${filters.search}%`)
      }

      // Apply pagination
      const limit = filters?.limit ?? 50
      const offset = filters?.offset ?? 0
      agentsQuery = agentsQuery.range(offset, offset + limit - 1)

      const { data: agents, error: agentsError, count: agentsCount } = await agentsQuery

      if (agentsError) throw agentsError

      if (!agents || agents.length === 0) {
        setWorkers([])
        setSummary({
          totalWorkers: 0,
          activeWorkers: 0,
          testingWorkers: 0,
          pausedWorkers: 0,
          totalLinkedNumbers: 0,
          totalMonthCalls: 0,
          totalMonthMinutes: 0
        })
        setPagination({ total: 0, limit, offset, hasMore: false })
        setLoading(false)
        return
      }

      // 2. Fetch numbers linked to any agent in this org
      const { data: numbers, error: numbersError } = await supabase
        .from('retell_numbers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)

      if (numbersError) {
        console.warn('Error fetching numbers:', numbersError)
      }

      // 3. Build a map of agent_id -> linked numbers
      const numbersByAgent = new Map<string, LinkedNumber[]>()

      if (numbers) {
        for (const num of numbers) {
          // Check inbound linkage
          if (num.inbound_agent_id) {
            const existing = numbersByAgent.get(num.inbound_agent_id) || []
            const hasOutbound = num.outbound_agent_id === num.inbound_agent_id
            existing.push({
              e164: num.e164,
              type: hasOutbound ? 'both' : 'inbound',
              country: num.country
            })
            numbersByAgent.set(num.inbound_agent_id, existing)
          }

          // Check outbound linkage (if different from inbound)
          if (num.outbound_agent_id && num.outbound_agent_id !== num.inbound_agent_id) {
            const existing = numbersByAgent.get(num.outbound_agent_id) || []
            existing.push({
              e164: num.e164,
              type: 'outbound',
              country: num.country
            })
            numbersByAgent.set(num.outbound_agent_id, existing)
          }
        }
      }

      // 4. Fetch recent calls for each agent (last call info + month stats)
      const agentIds = agents.map(a => a.agent_id)

      // Get month start date for monthly stats
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      // Fetch call statistics per agent for this month
      const { data: callStats, error: callStatsError } = await supabase
        .from('retell_calls')
        .select('agent_id, duration_ms, status, outcome, started_at')
        .eq('organization_id', organizationId)
        .in('agent_id', agentIds)
        .gte('started_at', monthStart)
        .order('started_at', { ascending: false })

      if (callStatsError) {
        console.warn('Error fetching call stats:', callStatsError)
      }

      // Build call stats map
      const callStatsByAgent = new Map<string, {
        lastCallAt?: string
        lastCallResult?: string
        lastCallDuration?: number
        monthCalls: number
        monthMinutes: number
      }>()

      if (callStats) {
        for (const call of callStats) {
          const agentId = call.agent_id
          if (!agentId) continue

          const existing = callStatsByAgent.get(agentId)
          const durationMs = call.duration_ms || 0
          const durationSeconds = Math.ceil(durationMs / 1000)

          if (!existing) {
            // First call for this agent (most recent due to ordering)
            callStatsByAgent.set(agentId, {
              lastCallAt: call.started_at ?? undefined,
              lastCallResult: call.outcome || call.status,
              lastCallDuration: durationSeconds,
              monthCalls: 1,
              monthMinutes: Math.ceil(durationMs / 60000)
            })
          } else {
            // Add to monthly totals
            existing.monthCalls += 1
            existing.monthMinutes += Math.ceil(durationMs / 60000)
            callStatsByAgent.set(agentId, existing)
          }
        }
      }

      // 5. Transform agents into AiWorkerRow format
      const workerRows: AiWorkerRow[] = agents.map(agent => {
        const linkedNumbers = numbersByAgent.get(agent.agent_id) || []
        const stats = callStatsByAgent.get(agent.agent_id)
        const settings = agent.settings as Record<string, unknown> | null

        return {
          id: agent.id,
          agent_id: agent.agent_id,
          name: agent.name,
          description: (settings?.description as string) || undefined,
          organization_id: agent.organization_id,
          status: normalizeAgentStatus(agent.status),
          linked_numbers: linkedNumbers,
          last_call_at: stats?.lastCallAt,
          last_call_result: stats?.lastCallResult,
          last_call_duration: stats?.lastCallDuration,
          month_calls: stats?.monthCalls || 0,
          month_minutes: stats?.monthMinutes || 0,
          created_at: agent.created_at,
          updated_at: agent.updated_at,
          voice_id: agent.voice_id,
          language: agent.language
        }
      })

      // 6. Apply hasNumbers filter (post-fetch)
      let filteredRows = workerRows
      if (filters?.hasNumbers !== undefined) {
        filteredRows = workerRows.filter(w =>
          filters.hasNumbers ? w.linked_numbers.length > 0 : w.linked_numbers.length === 0
        )
      }

      // 7. Compute summary statistics
      const summaryStats: AiWorkersSummary = {
        totalWorkers: filteredRows.length,
        activeWorkers: filteredRows.filter(w => w.status === AgentStatus.ACTIVE).length,
        testingWorkers: filteredRows.filter(w => w.status === AgentStatus.TESTING).length,
        pausedWorkers: filteredRows.filter(w => w.status === AgentStatus.PAUSED).length,
        totalLinkedNumbers: filteredRows.reduce((sum, w) => sum + w.linked_numbers.length, 0),
        totalMonthCalls: filteredRows.reduce((sum, w) => sum + (w.month_calls || 0), 0),
        totalMonthMinutes: filteredRows.reduce((sum, w) => sum + (w.month_minutes || 0), 0)
      }

      // 8. Fetch CRM sync status for the organization
      try {
        const { data: crmOutboxData, error: crmError } = await supabase
          .from('crm_outbox')
          .select('status, last_error, updated_at')
          .eq('organization_id', organizationId)

        if (!crmError && crmOutboxData) {
          const completedCount = crmOutboxData.filter(r => r.status === 'completed').length
          const pendingCount = crmOutboxData.filter(r => r.status === 'pending' || r.status === 'processing').length
          const failedCount = crmOutboxData.filter(r => r.status === 'failed').length

          // Find the most recent error
          const failedEntries = crmOutboxData.filter(r => r.status === 'failed' && r.last_error)
          const lastError = failedEntries.length > 0
            ? failedEntries.sort((a, b) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            )[0]?.last_error
            : undefined

          // Find the most recent successful sync
          const completedEntries = crmOutboxData.filter(r => r.status === 'completed')
          const lastSyncedAt = completedEntries.length > 0
            ? completedEntries.sort((a, b) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            )[0]?.updated_at
            : undefined

          setCrmStatus({
            configured: true, // If we have any entries, CRM is configured
            syncedCount: completedCount,
            pendingCount,
            failedCount,
            lastError,
            lastSyncedAt
          })
        } else if (crmOutboxData && crmOutboxData.length === 0) {
          // No entries yet - check if CRM might be configured but no leads synced
          setCrmStatus({
            configured: false,
            syncedCount: 0,
            pendingCount: 0,
            failedCount: 0
          })
        }
      } catch (crmErr) {
        console.warn('Error fetching CRM status:', crmErr)
        // Don't fail the whole fetch if CRM status fails
        setCrmStatus(null)
      }

      setWorkers(filteredRows)
      setSummary(summaryStats)
      setPagination({
        total: agentsCount || filteredRows.length,
        limit,
        offset,
        hasMore: (agentsCount || 0) > offset + limit
      })
    } catch (err) {
      console.error('Error fetching AI workers:', err)
      setError(err as Error)
      toast({
        title: 'Error',
        description: 'Failed to load AI workers data.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [organizationId, filters, toast])

  // Update worker status (state machine transition)
  const updateWorkerStatus = useCallback(async (
    workerId: string,
    newStatus: AgentStatusType
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('retell_agents')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', workerId)

      if (error) throw error

      // Optimistically update local state
      setWorkers(prev => prev.map(w =>
        w.id === workerId ? { ...w, status: newStatus } : w
      ))

      toast({
        title: 'Status Updated',
        description: `Worker status changed to ${newStatus}.`
      })

      return true
    } catch (err) {
      console.error('Error updating worker status:', err)
      toast({
        title: 'Error',
        description: 'Failed to update worker status.',
        variant: 'destructive'
      })
      return false
    }
  }, [toast])

  // Initial fetch
  useEffect(() => {
    fetchWorkers()
  }, [fetchWorkers])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !organizationId) return

    const interval = setInterval(fetchWorkers, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchWorkers, organizationId])

  return {
    workers,
    summary,
    crmStatus,
    pagination,
    loading,
    error,
    refetch: fetchWorkers,
    updateWorkerStatus
  }
}
