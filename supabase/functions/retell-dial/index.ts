import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireOrgActive, createBlockedResponse } from '../_shared/org-guard.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DialRequest {
  agentId: string
  phoneNumber: string
  agentProfileId?: string
}

serve(async (req) => {
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

    const { agentId, phoneNumber, agentProfileId }: DialRequest = await req.json()
    
    console.log('Dialing with agent:', agentId, 'to:', phoneNumber)

    // Get authenticated user first
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get user's organization to check status
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('seat_active', true)
      .single()

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'No active organization membership found' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check organization status with guard
    const guardResult = await requireOrgActive({
      organizationId: membership.organization_id,
      action: 'retell.dial',
      path: '/retell-dial',
      method: req.method,
      actorUserId: user.id,
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      supabase
    })

    if (!guardResult.ok) {
      return createBlockedResponse(guardResult, corsHeaders)
    }

    // Validate inputs
    if (!agentId || !phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Agent ID and phone number are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate phone number format
    if (!/^\+\d{7,15}$/.test(phoneNumber)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format. Must be E.164 format (+1234567890)' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { RETELL_API_KEY, getOptionalEnv } = await import('../_shared/env.ts')
    const retellApiKey = RETELL_API_KEY()
    const fromNumber = getOptionalEnv('RETELL_FROM_NUMBER')

    if (!fromNumber) {
      console.error('Missing RETELL_FROM_NUMBER')
      return new Response(
        JSON.stringify({ error: 'Retell configuration missing' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Make call to Retell API
    const retellResponse = await fetch('https://api.retellai.com/v2/call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agentId,
        audio_websocket_protocol: 'web',
        audio_encoding: 'mulaw',
        sample_rate: 8000,
        from_number: fromNumber,
        to_number: phoneNumber,
      }),
    })

    if (!retellResponse.ok) {
      const error = await retellResponse.text()
      console.error('Retell API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to initiate call' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const callData = await retellResponse.json()
    console.log('Call initiated:', callData.call_id)

    // Save call record to database
    const { error: callError } = await supabase
      .from('calls')
      .insert({
        id: callData.call_id,
        organization_id: membership.organization_id,
        agent_name: agentId,
        phone_number: phoneNumber,
        status: 'scheduled',
        metadata: {
          retell_agent_id: agentId,
          agent_profile_id: agentProfileId,
          initiated_by: user.id
        }
      })

    if (callError) {
      console.error('Error saving call record:', callError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        callId: callData.call_id,
        message: 'Call initiated successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})