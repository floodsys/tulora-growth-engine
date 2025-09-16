import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireOrgActive, createBlockedResponse } from '../_shared/org-guard.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CallsListRequest {
  organizationId: string
  filters?: {
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
}

serve(async (req) => {
  console.log('=== Retell Calls List Request ===')
  console.log('Request method:', req.method)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { organizationId, filters = {} }: CallsListRequest = await req.json()

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'organizationId is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check organization status
    const guardResult = await requireOrgActive({
      organizationId,
      action: 'retell.calls.list',
      path: '/retell-calls-list',
      method: req.method,
      supabase
    })

    if (!guardResult.ok) {
      return createBlockedResponse(guardResult, corsHeaders)
    }

    console.log('Fetching calls with filters:', filters)

    // Build query with filters
    let query = supabase
      .from('retell_calls')
      .select('*', { count: 'exact' })
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

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.outcome) {
      query = query.eq('outcome', filters.outcome)
    }

    // Apply pagination
    const limit = Math.min(filters.limit || 50, 100) // Max 100 calls per request
    const offset = filters.offset || 0
    
    query = query
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: calls, error, count } = await query

    if (error) {
      const corr = crypto.randomUUID()
      console.error(`[${corr}] Error fetching calls:`, error)
      return new Response(
        JSON.stringify({
          code: 'DB_QUERY_FAILED',
          message: 'Failed to fetch calls',
          hint: 'Remove embedded joins or add a proper FK relationship.',
          corr
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Successfully fetched ${calls?.length || 0} calls`)

    // Log the successful API call
    await supabase.rpc('log_event', {
      p_org_id: organizationId,
      p_action: 'retell.calls.listed',
      p_target_type: 'retell_calls',
      p_status: 'success',
      p_channel: 'audit',
      p_metadata: {
        calls_count: calls?.length || 0,
        filters_applied: Object.keys(filters).length,
        total_count: count,
        timestamp: new Date().toISOString()
      }
    })

    return new Response(
      JSON.stringify({ 
        calls: calls || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (offset + limit) < (count || 0)
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Unexpected error in retell-calls-list:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})