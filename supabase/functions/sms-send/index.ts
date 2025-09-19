import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireEntitlement } from '../_shared/entitlements.ts'
import { requireOrgIpAllowed, createIpBlockedResponse } from '../_shared/org-guard.ts'

interface SendSMSRequest {
  to_number: string
  message_body: string
  campaign_id?: string
  number_id?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's organization
    const { data: membership } = await supabaseClient
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

    // Check IP allowlist
    const ipGuardResult = await requireOrgIpAllowed(req, membership.organization_id, supabaseClient)
    if (!ipGuardResult.ok) {
      const corr = crypto.randomUUID()
      console.log(`[${corr}] IP blocked for org ${membership.organization_id}: ${ipGuardResult.clientIp}`)
      return createIpBlockedResponse(ipGuardResult, corsHeaders, corr)
    }

    const { to_number, message_body, campaign_id, number_id }: SendSMSRequest = await req.json()

    // Validate required fields
    if (!to_number || !message_body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to_number, message_body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check SMS entitlements
    const corr = crypto.randomUUID()
    const entitlementCheck = await requireEntitlement(supabaseClient, membership.organization_id, {
      feature: 'sms'
    }, corr)

    if (!entitlementCheck.ok) {
      console.log(`[${corr}] SMS sending blocked by entitlements:`, entitlementCheck.body)
      return new Response(
        JSON.stringify(entitlementCheck.body),
        { 
          status: entitlementCheck.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Retell API key
    const { RETELL_API_KEY } = await import('../_shared/env.ts')
    const retellApiKey = RETELL_API_KEY()
    if (!retellApiKey) {
      return new Response(
        JSON.stringify({ error: 'Retell API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the phone number to send from
    let fromNumber = ''
    if (number_id) {
      const { data: numberData } = await supabaseClient
        .from('retell_numbers')
        .select('e164')
        .eq('id', number_id)
        .eq('organization_id', membership.organization_id)
        .eq('sms_enabled', true)
        .single()

      if (numberData) {
        fromNumber = numberData.e164
      }
    }

    if (!fromNumber) {
      return new Response(
        JSON.stringify({ error: 'No SMS-enabled number available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send SMS via Retell API
    const retellResponse = await fetch('https://api.retellai.com/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromNumber,
        to: to_number,
        message: message_body,
      }),
    })

    const retellData = await retellResponse.json()

    if (!retellResponse.ok) {
      console.error('Retell SMS API error:', retellData)
      return new Response(
        JSON.stringify({ error: 'Failed to send SMS', details: retellData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Store SMS message in database
    const { data: smsMessage, error: insertError } = await supabaseClient
      .from('sms_messages')
      .insert({
        organization_id: membership.organization_id,
        campaign_id,
        number_id,
        direction: 'outbound',
        from_number: fromNumber,
        to_number,
        message_body,
        delivery_status: 'sent',
        provider_message_id: retellData.message_id,
        cost_cents: retellData.cost_cents || 0,
        metadata: {
          provider_response: retellData,
        },
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to store SMS message:', insertError)
      // Don't fail the request since SMS was sent successfully
    }

    // Track usage
    await supabaseClient
      .from('usage_events')
      .insert({
        organization_id: membership.organization_id,
        event_type: 'sms_sent',
        resource_type: 'sms_message',
        resource_id: smsMessage?.id,
        quantity: 1,
        cost_cents: retellData.cost_cents || 0,
        metadata: {
          to_number,
          from_number: fromNumber,
          message_length: message_body.length,
        },
      })

    return new Response(
      JSON.stringify({
        success: true,
        message_id: retellData.message_id,
        sms_message: smsMessage,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})