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

    const { organizationId, country, area_code } = await req.json()

    // Purchase number from Retell
    const retellResponse = await fetch('https://api.retellai.com/v2/buy-phone-number', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RETELL_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        country_code: country,
        area_code: area_code,
      }),
    })

    if (!retellResponse.ok) {
      const errorData = await retellResponse.text()
      console.error('Retell number purchase failed:', errorData)
      throw new Error(`Retell API error: ${retellResponse.status}`)
    }

    const retellData = await retellResponse.json()
    console.log('Purchased Retell number:', retellData)

    // Store in our database
    const { data, error } = await supabase
      .from('retell_numbers')
      .insert({
        organization_id: organizationId,
        number_id: retellData.phone_number_id,
        e164: retellData.phone_number,
        country: country,
        is_active: true,
        is_byoc: false,
        sms_enabled: false,
        metadata: {
          retell_data: retellData
        }
      })
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in retell-numbers-purchase:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})