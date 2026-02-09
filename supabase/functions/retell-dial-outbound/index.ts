import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkUsageQuota } from '../_shared/billingUsage.ts'
import { checkAgentForCalls, createAgentStatusErrorResponse } from '../_shared/agentStatus.ts'

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Trace ID for logging
  const traceId = `trace_${Date.now()}_${crypto.randomUUID().slice(0, 10)}`
  const log = (msg: string) => console.log(`[${traceId}] ${msg}`)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      log('Unauthorized: no user')
      return new Response(
        JSON.stringify({ error: 'Unauthorized', traceId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('seat_active', true)
      .single()

    if (!membership) {
      log('No active organization membership')
      return new Response(
        JSON.stringify({ error: 'No active organization membership', traceId }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { phoneNumber, agentId } = body

    if (!phoneNumber || !agentId) {
      log('Missing required fields: phoneNumber or agentId')
      return new Response(
        JSON.stringify({ error: 'Phone number and agent ID are required', traceId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    log(`Initiating outbound call: agentId=${agentId}, to=${phoneNumber}`)

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // AGENT STATUS CHECK: Only ACTIVE agents can receive production calls
    const agentStatusCheck = await checkAgentForCalls(supabaseAdmin, agentId, traceId)

    if (!agentStatusCheck.allowed) {
      log(`Agent status check failed for ${agentId}: ${agentStatusCheck.error?.message}`)
      return createAgentStatusErrorResponse(agentStatusCheck, corsHeaders, traceId)
    }

    // Verify agent belongs to the user's organization
    if (agentStatusCheck.agent?.organization_id !== membership.organization_id) {
      log(`Agent ${agentId} does not belong to org ${membership.organization_id}`)
      return new Response(
        JSON.stringify({
          error: 'AGENT_NOT_FOUND',
          message: 'Agent not found or not accessible',
          traceId
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check usage quota before initiating call
    const quotaResult = await checkUsageQuota(
      supabaseAdmin,
      membership.organization_id,
      'calls',
      traceId
    )

    if (!quotaResult.allowed && quotaResult.reason === 'over_limit') {
      log(`Blocked call for org ${membership.organization_id}: quota exceeded (${quotaResult.current}/${quotaResult.limit})`)
      return new Response(
        JSON.stringify({
          status: 402,
          code: 'BILLING_OVER_LIMIT',
          metric: 'calls',
          remaining: 0,
          limit: quotaResult.limit,
          current: quotaResult.current,
          message: 'Monthly call limit exceeded. Please upgrade your plan.',
          traceId
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get a number assigned to this agent for outbound calls
    const { data: number } = await supabase
      .from('retell_numbers')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .eq('outbound_agent_id', agentId)
      .eq('is_active', true)
      .single()

    if (!number) {
      log('No phone number assigned to this agent for outbound calls')
      return new Response(
        JSON.stringify({ error: 'No phone number assigned to this agent for outbound calls', traceId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call Retell API to initiate outbound call
    const { RETELL_API_KEY } = await import('../_shared/env.ts')
    const retellApiKey = RETELL_API_KEY()

    const retellResponse = await fetch('https://api.retellai.com/create-phone-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_number: number.e164,
        to_number: phoneNumber,
        agent_id: agentId,
        metadata: {
          organization_id: membership.organization_id,
          initiated_by: user.id,
          number_id: number.id,
        }
      }),
    })

    if (!retellResponse.ok) {
      const errorData = await retellResponse.text()
      log(`Retell API error: ${errorData}`)
      return new Response(
        JSON.stringify({ error: 'Failed to initiate call', traceId }),
        { status: retellResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callData = await retellResponse.json()
    log(`Call initiated successfully: call_id=${callData.call_id}`)

    // Record call in our database
    const { data: call, error: callError } = await supabase
      .from('retell_calls')
      .insert({
        call_id: callData.call_id,
        organization_id: membership.organization_id,
        agent_id: agentId,
        direction: 'outbound',
        to_e164: phoneNumber,
        from_e164: number.e164,
        status: 'started',
        started_at: new Date().toISOString(),
        owner_user_id: user.id,
        raw_webhook_data: { retell_response: callData },
      })
      .select()
      .single()

    if (callError) {
      log(`Error storing call record: ${callError.message}`)
      // Continue anyway, call was initiated
    }

    return new Response(
      JSON.stringify({
        success: true,
        call_id: callData.call_id,
        call_status: callData.call_status,
        message: `Outbound call initiated to ${phoneNumber}`,
        traceId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error(`[${traceId}] Error initiating outbound call:`, error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', traceId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
