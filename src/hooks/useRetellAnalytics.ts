import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface CallAnalytics {
  total_calls: number
  successful_calls: number
  average_duration: number
  completion_rate: number
  sentiment_breakdown: {
    positive: number
    negative: number
    neutral: number
    mixed: number
  }
  outcome_breakdown: {
    positive: number
    negative: number
    neutral: number
    unknown: number
  }
  peak_hours: Array<{ hour: number; count: number }>
  agent_performance: Array<{
    agent_id: string
    agent_name: string
    call_count: number
    success_rate: number
    avg_duration: number
  }>
}

export interface AnalyticsFilters {
  dateRange?: {
    start: string
    end: string
  }
  agentId?: string
  direction?: 'inbound' | 'outbound'
}

export const useRetellAnalytics = (organizationId?: string) => {
  const [analytics, setAnalytics] = useState<CallAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadAnalytics = async (filters: AnalyticsFilters = {}) => {
    if (!organizationId) return

    try {
      setLoading(true)
      
      // Base query
      let query = supabase
        .from('retell_calls')
        .select(`
          *,
          retell_agents!inner(name)
        `)
        .eq('organization_id', organizationId)

      // Apply filters
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

      const { data: calls, error } = await query

      if (error) throw error

      // Process analytics
      const analytics = processCallAnalytics(calls || [])
      setAnalytics(analytics)

    } catch (error) {
      console.error('Error loading analytics:', error)
      toast({
        title: "Error",
        description: "Failed to load call analytics.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // New method: Get KPIs for dashboard overview
  const getKpis = useCallback(async (dateRange?: { start: string; end: string }) => {
    if (!organizationId) return null

    try {
      let query = supabase
        .from('retell_calls')
        .select('*')
        .eq('organization_id', organizationId)

      if (dateRange) {
        query = query
          .gte('started_at', dateRange.start)
          .lte('started_at', dateRange.end)
      }

      const { data: calls, error } = await query

      if (error) throw error

      const totalCalls = calls?.length || 0
      const completedCalls = calls?.filter(c => c.status === 'completed').length || 0
      const avgDurationSec = calls?.length > 0 
        ? calls.reduce((sum, call) => sum + (call.duration_ms || 0), 0) / calls.length / 1000
        : 0
      const activeAgents = new Set(calls?.map(c => c.agent_id).filter(Boolean)).size

      return {
        totalCalls,
        completedCalls,
        avgDurationMinutes: Math.round(avgDurationSec / 60),
        activeAgents,
      }
    } catch (error) {
      console.error('Error loading KPIs:', error)
      return null
    }
  }, [organizationId])

  // New method: Get analytics by agent
  const getByAgent = useCallback(async (dateRange?: { start: string; end: string }) => {
    if (!organizationId) return []

    try {
      // First get all calls
      let callQuery = supabase
        .from('retell_calls')
        .select('*')
        .eq('organization_id', organizationId)

      if (dateRange) {
        callQuery = callQuery
          .gte('started_at', dateRange.start)
          .lte('started_at', dateRange.end)
      }

      const { data: calls, error: callError } = await callQuery

      if (callError) throw callError

      // Get unique agent IDs
      const agentIds = [...new Set(calls?.map(c => c.agent_id).filter(Boolean))]
      
      // Get agent names
      const { data: agents, error: agentError } = await supabase
        .from('retell_agents')
        .select('agent_id, name')
        .in('agent_id', agentIds)
        .eq('organization_id', organizationId)

      if (agentError) {
        console.warn('Could not fetch agent names:', agentError)
      }

      // Create agent name lookup
      const agentNames: { [key: string]: string } = {}
      agents?.forEach(agent => {
        agentNames[agent.agent_id] = agent.name
      })

      // Group by agent and calculate performance
      const agentStats: { [agentId: string]: any } = {}
      calls?.forEach(call => {
        if (!call.agent_id) return
        
        if (!agentStats[call.agent_id]) {
          agentStats[call.agent_id] = {
            agent_id: call.agent_id,
            agent_name: agentNames[call.agent_id] || 'Unknown',
            calls: [],
          }
        }
        agentStats[call.agent_id].calls.push(call)
      })

      return Object.values(agentStats).map((agent: any) => {
        const calls = agent.calls
        const successfulCalls = calls.filter((c: any) => c.status === 'completed')
        const avgDuration = successfulCalls.length > 0
          ? successfulCalls.reduce((sum: number, call: any) => sum + (call.duration_ms || 0), 0) / successfulCalls.length
          : 0

        return {
          agent_id: agent.agent_id,
          agent_name: agent.agent_name,
          call_count: calls.length,
          success_rate: calls.length > 0 ? (successfulCalls.length / calls.length) * 100 : 0,
          avg_duration: Math.round(avgDuration / 1000), // Convert to seconds
        }
      }).sort((a, b) => b.call_count - a.call_count)
    } catch (error) {
      console.error('Error loading agent analytics:', error)
      return []
    }
  }, [organizationId])

  const processCallAnalytics = (calls: any[]): CallAnalytics => {
    const totalCalls = calls.length
    const successfulCalls = calls.filter(c => c.status === 'completed').length
    
    // Calculate average duration for completed calls
    const completedCalls = calls.filter(c => c.status === 'completed' && c.duration_ms)
    const avgDuration = completedCalls.length > 0
      ? completedCalls.reduce((sum, call) => sum + (call.duration_ms || 0), 0) / completedCalls.length
      : 0

    // Sentiment breakdown
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0, mixed: 0 }
    calls.forEach(call => {
      if (call.sentiment && sentimentCounts.hasOwnProperty(call.sentiment)) {
        sentimentCounts[call.sentiment as keyof typeof sentimentCounts]++
      }
    })

    // Outcome breakdown
    const outcomeCounts = { positive: 0, negative: 0, neutral: 0, unknown: 0 }
    calls.forEach(call => {
      if (call.outcome && outcomeCounts.hasOwnProperty(call.outcome)) {
        outcomeCounts[call.outcome as keyof typeof outcomeCounts]++
      } else {
        outcomeCounts.unknown++
      }
    })

    // Peak hours analysis
    const hourCounts: { [hour: number]: number } = {}
    calls.forEach(call => {
      if (call.started_at) {
        const hour = new Date(call.started_at).getHours()
        hourCounts[hour] = (hourCounts[hour] || 0) + 1
      }
    })
    const peakHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    // Agent performance
    const agentStats: { [agentId: string]: any } = {}
    calls.forEach(call => {
      if (!call.agent_id) return
      
      if (!agentStats[call.agent_id]) {
        agentStats[call.agent_id] = {
          agent_id: call.agent_id,
          agent_name: call.retell_agents?.name || 'Unknown',
          calls: [],
        }
      }
      agentStats[call.agent_id].calls.push(call)
    })

    const agentPerformance = Object.values(agentStats).map((agent: any) => {
      const calls = agent.calls
      const successfulCalls = calls.filter((c: any) => c.status === 'completed')
      const avgDuration = successfulCalls.length > 0
        ? successfulCalls.reduce((sum: number, call: any) => sum + (call.duration_ms || 0), 0) / successfulCalls.length
        : 0

      return {
        agent_id: agent.agent_id,
        agent_name: agent.agent_name,
        call_count: calls.length,
        success_rate: calls.length > 0 ? (successfulCalls.length / calls.length) * 100 : 0,
        avg_duration: Math.round(avgDuration / 1000), // Convert to seconds
      }
    }).sort((a, b) => b.call_count - a.call_count)

    return {
      total_calls: totalCalls,
      successful_calls: successfulCalls,
      average_duration: Math.round(avgDuration / 1000), // Convert to seconds
      completion_rate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
      sentiment_breakdown: sentimentCounts,
      outcome_breakdown: outcomeCounts,
      peak_hours: peakHours,
      agent_performance: agentPerformance,
    }
  }

  useEffect(() => {
    if (organizationId) {
      loadAnalytics()
    }
  }, [organizationId])

  return {
    analytics,
    loading,
    loadAnalytics,
    getKpis,
    getByAgent,
  }
}