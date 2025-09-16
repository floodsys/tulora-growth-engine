import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface RetellCall {
  id: string
  call_id: string
  organization_id: string
  agent_id?: string
  direction: 'inbound' | 'outbound'
  to_e164: string
  from_e164: string
  status: 'started' | 'ongoing' | 'completed' | 'failed' | 'canceled'
  started_at?: string
  ended_at?: string
  duration_ms?: number
  recording_signed_url?: string
  transcript_summary?: string
  analysis_json: any
  outcome?: 'positive' | 'negative' | 'neutral' | 'unknown'
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed'
  lead_score?: number
  topics?: string[]
  owner_user_id?: string
  tags: string[]
  raw_webhook_data?: any
  created_at: string
  updated_at: string
  retell_agents?: {
    name: string
    voice_id?: string
    data_storage_setting: string
    opt_in_signed_url: boolean
  }
}

export interface CallFilters {
  dateRange?: {
    start: string
    end: string
  }
  agentId?: string
  direction?: 'inbound' | 'outbound'
  status?: string
  outcome?: string
  limit?: number
  offset?: number
}

export const useRetellCalls = (organizationId?: string) => {
  const [calls, setCalls] = useState<RetellCall[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false
  })
  const { toast } = useToast()

  // Constants
  const MAX_LIMIT = 100

  // Sleep helper for backoff
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  // Load calls with filters
  const loadCalls = async (filters: CallFilters = {}) => {
    if (!organizationId) return

    const controller = new AbortController()
    
    try {
      setLoading(true)
      
      // Primary: Use function invoke with 404 fallback and backoff
      let data: any = {}
      let attempts = 0
      const maxAttempts = 3
      
      const tryRequest = async (): Promise<void> => {
        try {
          const limit = Math.min(filters.limit || pagination.limit, MAX_LIMIT)
          const response = await supabase.functions.invoke('retell-calls-list', {
            body: {
              organizationId,
              filters: {
                ...filters,
                limit,
                offset: filters.offset || 0
              }
            }
          })
          
          if (response.error) throw response.error
          data = response.data
        } catch (error: any) {
          attempts++
          
          // Fallback on 404 only
          if (error?.status === 404) {
            const limit = Math.min(filters.limit || 50, MAX_LIMIT)
            let query = supabase
              .from('retell_calls')
              .select('*')
              .eq('organization_id', organizationId)
              .order('started_at', { ascending: false })
              .limit(limit)

            if (filters.dateRange) {
              query = query
                .gte('started_at', filters.dateRange.start)
                .lte('started_at', filters.dateRange.end)
            }

            if (filters.agentId) {
              query = query.eq('agent_id', filters.agentId)
            }

            if (filters.direction) {
              query = query.eq('direction', filters.direction)
            }

            if (filters.status) {
              query = query.eq('status', filters.status)
            }

            if (filters.outcome) {
              query = query.eq('outcome', filters.outcome)
            }

            const { data: fallbackCalls, error: fallbackError } = await query
            if (fallbackError) throw fallbackError
            
            data = {
              calls: fallbackCalls || [],
              pagination: { total: (fallbackCalls || []).length, limit, offset: 0, hasMore: false }
            }
            return
          }
          
          // For other errors, implement exponential backoff
          if (attempts < maxAttempts) {
            const delay = Math.min(200 * Math.pow(2, attempts - 1), 800) // 200ms → 400ms → 800ms max
            await sleep(delay)
            await tryRequest()
          } else {
            throw error
          }
        }
      }
      
      await tryRequest()

      setCalls(data.calls || [])
      setPagination(data.pagination || { total: 0, limit: 50, offset: 0, hasMore: false })
    } catch (error: any) {
      console.error('Error loading calls:', error)
      
      // Surface structured errors with correlation ID priority
      const errorMessage = error?.message || 'Failed to load calls.'
      const errorCode = error?.status || error?.code
      const correlationId = error?.correlationId || error?.traceId || error?.error_code
      
      toast({
        title: "Error",
        description: `${errorMessage}${errorCode ? ` (${errorCode})` : ''}${correlationId ? ` - ${correlationId}` : ''}`,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }

    return () => controller.abort()
  }

  // Get call details
  const getCallDetails = async (callId: string) => {
    if (!organizationId) return null

    try {
      const { data, error } = await supabase.functions.invoke('retell-calls-get', {
        body: {
          callId,
          organizationId
        }
      })

      if (error) throw error
      return data.call
    } catch (error) {
      console.error('Error loading call details:', error)
      toast({
        title: "Error",
        description: "Failed to load call details.",
        variant: "destructive"
      })
      return null
    }
  }

  // Update call tags
  const updateCallTags = async (callId: string, tags: string[]) => {
    try {
      const { data, error } = await supabase
        .from('retell_calls')
        .update({ tags })
        .eq('call_id', callId)
        .eq('organization_id', organizationId)
        .select()
        .single()

      if (error) throw error

      setCalls(prev => prev.map(call => 
        call.call_id === callId ? { ...call, tags } as RetellCall : call
      ))

      toast({
        title: "Tags Updated",
        description: "Call tags have been updated successfully.",
      })

      return data
    } catch (error) {
      console.error('Error updating call tags:', error)
      toast({
        title: "Error",
        description: "Failed to update call tags.",
        variant: "destructive"
      })
      return null
    }
  }

  // Get call stats/summary
  const getCallStats = async (filters: CallFilters = {}) => {
    if (!organizationId) return null

    try {
      let query = supabase
        .from('retell_calls')
        .select('status, outcome, sentiment, duration_ms, created_at', { count: 'exact' })
        .eq('organization_id', organizationId)

      // Apply same filters as loadCalls
      if (filters.dateRange) {
        query = query
          .gte('started_at', filters.dateRange.start)
          .lte('started_at', filters.dateRange.end)
      }

      if (filters.agentId) {
        query = query.eq('agent_id', filters.agentId)
      }

      if (filters.direction) {
        query = query.eq('direction', filters.direction)
      }

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      if (filters.outcome) {
        query = query.eq('outcome', filters.outcome)
      }

      const { data, error, count } = await query

      if (error) throw error

      // Calculate stats
      const stats = {
        total: count || 0,
        completed: data?.filter(c => c.status === 'completed').length || 0,
        averageDuration: 0,
        positiveOutcome: data?.filter(c => c.outcome === 'positive').length || 0,
        negativeOutcome: data?.filter(c => c.outcome === 'negative').length || 0,
        neutralOutcome: data?.filter(c => c.outcome === 'neutral').length || 0,
      }

      // Calculate average duration for completed calls
      const completedCalls = data?.filter(c => c.status === 'completed' && c.duration_ms) || []
      if (completedCalls.length > 0) {
        const totalDuration = completedCalls.reduce((sum, call) => sum + (call.duration_ms || 0), 0)
        stats.averageDuration = Math.round(totalDuration / completedCalls.length / 1000) // Convert to seconds
      }

      return stats
    } catch (error) {
      console.error('Error loading call stats:', error)
      return null
    }
  }

  useEffect(() => {
    if (organizationId) {
      loadCalls()
    }
  }, [organizationId])

  return {
    calls,
    loading,
    pagination,
    loadCalls,
    getCallDetails,
    updateCallTags,
    getCallStats,
  }
}