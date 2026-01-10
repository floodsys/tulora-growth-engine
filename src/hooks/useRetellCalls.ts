import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useUserOrganization } from '@/hooks/useUserOrganization'
import { toast } from 'sonner'

const getCorrId = (err: any) => err?.correlationId ?? err?.corr ?? err?.traceId ?? null

export interface Call {
  id: string
  call_id: string
  agent_id: string
  from_number: string
  to_number: string
  direction: 'inbound' | 'outbound'
  status: string
  outcome?: string
  duration?: number
  started_at: string
  ended_at?: string
  recording_url?: string
  transcript?: any
  metadata?: any
}

export interface Pagination {
  total: number
  limit: number
  offset: number
  hasMore: boolean
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

export function useRetellCalls(filters?: CallFilters) {
  const { organization } = useUserOrganization()
  const [data, setData] = useState<{calls: Call[], pagination: Pagination} | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchCalls = async () => {
    if (!organization?.id) {
      setLoading(false)
      return
    }
    
    const corr = crypto.randomUUID()
    try {
      const { data, error } = await supabase.functions.invoke('retell-calls-list', {
        body: { 
          organizationId: organization.id,
          filters 
        }
      })
      
      if (error) throw error
      setData(data)
    } catch (err) {
      setError(err as Error)
      const corrId = getCorrId(err) || corr
      toast.error(`Failed to load calls (Corr ID: ${corrId})`)
      console.error('Calls fetch failed:', { corrId, error: err })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    fetchCalls() 
  }, [organization?.id, JSON.stringify(filters)])

  return { 
    calls: data?.calls || [], 
    pagination: data?.pagination || { 
      total: 0, 
      limit: 50, 
      offset: 0, 
      hasMore: false 
    },
    loading, 
    error, 
    refetch: fetchCalls 
  }
}
