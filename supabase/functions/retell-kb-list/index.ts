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

    const { organizationId } = await req.json()

    // Get KBs from our database
    const { data: kbs, error } = await supabase
      .from('retell_kbs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get sources for each KB
    const kbsWithSources = await Promise.all(
      kbs.map(async (kb) => {
        const { data: sources, error: sourcesError } = await supabase
          .from('retell_kb_sources')
          .select('*')
          .eq('kb_id', kb.id)

        if (sourcesError) {
          console.error('Error fetching sources for KB:', sourcesError)
          return { ...kb, sources: [] }
        }

        return { ...kb, sources: sources || [] }
      })
    )

    return new Response(JSON.stringify(kbsWithSources), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in retell-kb-list:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})