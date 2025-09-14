import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { organizationId, e164, provider } = await req.json()

    // Import BYOC number to Retell
    const retellResponse = await fetch('https://api.retellai.com/v2/import-phone-number', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RETELL_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: e164,
        carrier: provider,
      }),
    })

    if (!retellResponse.ok) {
      const errorData = await retellResponse.text()
      console.error('Retell number import failed:', errorData)
      throw new Error(`Retell API error: ${retellResponse.status}`)
    }

    const retellData = await retellResponse.json()
    console.log('Imported Retell number:', retellData)

    // Extract country from E.164 format (simple implementation)
    const getCountryFromE164 = (number: string) => {
      if (number.startsWith('+1')) return 'US'
      if (number.startsWith('+44')) return 'GB'
      if (number.startsWith('+33')) return 'FR'
      if (number.startsWith('+49')) return 'DE'
      // Add more country codes as needed
      return 'US' // Default
    }

    // Store in our database
    const { data, error } = await supabase
      .from('retell_numbers')
      .insert({
        organization_id: organizationId,
        number_id: retellData.phone_number_id,
        e164: e164,
        country: getCountryFromE164(e164),
        is_active: true,
        is_byoc: true,
        byoc_provider: provider,
        sms_enabled: false,
        metadata: {
          retell_data: retellData,
          imported_from: provider
        }
      })
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in retell-numbers-import:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})