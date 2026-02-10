import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireOrgIpAllowed, createIpBlockedResponse } from '../_shared/org-guard.ts'

interface ReleaseNumberRequest {
  number_id: string
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'DELETE') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
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

    // Parse request body
    const requestData: ReleaseNumberRequest = await req.json()

    // Verify the number belongs to the organization
    const { data: existingNumber, error: fetchError } = await supabaseClient
      .from('retell_numbers')
      .select('*')
      .eq('number_id', requestData.number_id)
      .eq('organization_id', membership.organization_id)
      .single()

    if (fetchError || !existingNumber) {
      return new Response(
        JSON.stringify({ error: 'Number not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Release from Retell API first (if not BYOC)
    if (!existingNumber.is_byoc) {
      const { RETELL_API_KEY } = await import('../_shared/env.ts')
      const retellApiKey = RETELL_API_KEY()
      if (retellApiKey) {
        try {
          const retellResponse = await fetch(`https://api.retellai.com/delete-phone-number/${requestData.number_id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${retellApiKey}`,
            },
          })

          if (!retellResponse.ok) {
            console.error('Retell API release error:', await retellResponse.text())
            // Continue with database cleanup even if Retell fails
          }
        } catch (retellError) {
          console.error('Retell API error:', retellError)
          // Continue with database cleanup
        }
      }
    }

    // Mark as inactive in our database
    const { error: updateError } = await supabaseClient
      .from('retell_numbers')
      .update({
        is_active: false,
        inbound_agent_id: null,
        outbound_agent_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('number_id', requestData.number_id)
      .eq('organization_id', membership.organization_id)

    if (updateError) {
      console.error('Database update error:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to release number' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Number released successfully'
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