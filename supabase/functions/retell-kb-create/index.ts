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

    const { title, organizationId } = await req.json()

    // Create KB in Retell
    const retellResponse = await fetch('https://api.retellai.com/v2/create-knowledge-base', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RETELL_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        knowledge_base_name: title,
      }),
    })

    if (!retellResponse.ok) {
      const errorData = await retellResponse.text()
      console.error('Retell KB creation failed:', errorData)
      throw new Error(`Retell API error: ${retellResponse.status}`)
    }

    const retellData = await retellResponse.json()
    console.log('Created Retell KB:', retellData)

    // Store in our database
    const { data, error } = await supabase
      .from('retell_kbs')
      .insert({
        kb_id: retellData.knowledge_base_id,
        organization_id: organizationId,
        title: title,
        state: 'pending',
        source_count: 0,
        chunks: 0,
      })
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in retell-kb-create:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})