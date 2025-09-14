import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface BuyNumberRequest {
  area_code?: string
  country?: string
  type?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
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
    const requestData: BuyNumberRequest = await req.json()

    // Call Retell API to purchase number
    const { RETELL_API_KEY } = await import('../_shared/env.ts')
    const retellApiKey = RETELL_API_KEY()

    const retellResponse = await fetch('https://api.retellai.com/buy-phone-number', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        area_code: requestData.area_code,
        country: requestData.country || 'US',
      }),
    })

    if (!retellResponse.ok) {
      const errorData = await retellResponse.text()
      console.error('Retell API error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to purchase number from Retell' }),
        { status: retellResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const purchasedNumber = await retellResponse.json()

    // Store the purchased number in our database
    const { data: dbNumber, error: dbError } = await supabaseClient
      .from('retell_numbers')
      .insert({
        organization_id: membership.organization_id,
        number_id: purchasedNumber.phone_number_id,
        e164: purchasedNumber.phone_number,
        country: requestData.country || 'US',
        is_active: true,
        sms_enabled: false,
        is_byoc: false,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Try to clean up by releasing the number from Retell
      try {
        await fetch(`https://api.retellai.com/delete-phone-number/${purchasedNumber.phone_number_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${retellApiKey}`,
          },
        })
      } catch (cleanupError) {
        console.error('Failed to cleanup number after DB error:', cleanupError)
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to store number in database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        number: dbNumber
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