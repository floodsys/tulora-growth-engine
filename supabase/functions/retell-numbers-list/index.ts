import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface RetellNumber {
  id: string
  number: string
  country: string
  type: string
  usage?: {
    inbound?: boolean
    outbound?: boolean
  }
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

    // Get organization's numbers from database
    const { data: dbNumbers, error: dbError } = await supabaseClient
      .from('retell_numbers')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .eq('is_active', true)

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch numbers from database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Also fetch available numbers from Retell API
    const { RETELL_API_KEY } = await import('../_shared/env.ts')
    const retellApiKey = RETELL_API_KEY()

    let availableNumbers: RetellNumber[] = []
    try {
      const retellResponse = await fetch('https://api.retellai.com/list-phone-numbers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${retellApiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (retellResponse.ok) {
        const retellData = await retellResponse.json()
        availableNumbers = retellData.phone_numbers || []
      }
    } catch (error) {
      console.error('Error fetching from Retell API:', error)
      // Continue without Retell data
    }

    return new Response(
      JSON.stringify({
        owned_numbers: dbNumbers || [],
        available_numbers: availableNumbers
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