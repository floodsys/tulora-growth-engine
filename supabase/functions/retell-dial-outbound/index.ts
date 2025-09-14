import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
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
      return new Response(
        JSON.stringify({ error: 'No active organization membership' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { phoneNumber, agentId } = body

    if (!phoneNumber || !agentId) {
      return new Response(
        JSON.stringify({ error: 'Phone number and agent ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify agent belongs to organization and is published
    const { data: agent } = await supabase
      .from('retell_agents')
      .select('*')
      .eq('agent_id', agentId)
      .eq('organization_id', membership.organization_id)
      .eq('status', 'published')
      .single()

    if (!agent) {
      return new Response(
        JSON.stringify({ error: 'Agent not found or not published' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      return new Response(
        JSON.stringify({ error: 'No phone number assigned to this agent for outbound calls' }),
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
      console.error('Retell API error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to initiate call' }),
        { status: retellResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callData = await retellResponse.json()

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
      console.error('Error storing call record:', callError)
      // Continue anyway, call was initiated
    }

    return new Response(
      JSON.stringify({
        success: true,
        call_id: callData.call_id,
        call_status: callData.call_status,
        message: `Outbound call initiated to ${phoneNumber}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error initiating outbound call:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})