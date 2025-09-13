import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface UpdateNumberRequest {
  number_id: string
  inbound_agent_id?: string
  outbound_agent_id?: string
  sms_enabled?: boolean
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'PUT') {
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

    // Parse request body
    const requestData: UpdateNumberRequest = await req.json()

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

    // Update the number in our database
    const updateData: any = { updated_at: new Date().toISOString() }
    
    if (requestData.inbound_agent_id !== undefined) {
      updateData.inbound_agent_id = requestData.inbound_agent_id
    }
    if (requestData.outbound_agent_id !== undefined) {
      updateData.outbound_agent_id = requestData.outbound_agent_id
    }
    if (requestData.sms_enabled !== undefined) {
      updateData.sms_enabled = requestData.sms_enabled
    }

    const { data: updatedNumber, error: updateError } = await supabaseClient
      .from('retell_numbers')
      .update(updateData)
      .eq('number_id', requestData.number_id)
      .eq('organization_id', membership.organization_id)
      .select()
      .single()

    if (updateError) {
      console.error('Database update error:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update number' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If inbound agent is being updated, also update Retell API
    if (requestData.inbound_agent_id !== undefined) {
      const { RETELL_API_KEY } = await import('../_shared/env.ts')
      const retellApiKey = RETELL_API_KEY()
      if (retellApiKey) {
        try {
          await fetch(`https://api.retellai.com/update-phone-number/${requestData.number_id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${retellApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inbound_agent_id: requestData.inbound_agent_id || null,
            }),
          })
        } catch (retellError) {
          console.error('Retell API update error:', retellError)
          // Continue - we've updated our database, Retell update is optional
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        number: updatedNumber
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