import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { kbId, organizationId } = await req.json()

    // Get KB from database
    const { data: kb, error: kbError } = await supabase
      .from('retell_kbs')
      .select('*')
      .eq('id', kbId)
      .eq('organization_id', organizationId)
      .single()

    if (kbError || !kb) throw new Error('Knowledge base not found')

    // Get status from Retell
    const retellResponse = await fetch(`https://api.retellai.com/v2/knowledge-base/${kb.kb_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${(await import('../_shared/env.ts')).RETELL_API_KEY()}`,
        'Content-Type': 'application/json',
      },
    })

    if (!retellResponse.ok) {
      const errorData = await retellResponse.text()
      console.error('Retell KB status failed:', errorData)
      throw new Error(`Retell API error: ${retellResponse.status}`)
    }

    const retellData = await retellResponse.json()
    console.log('Retell KB status:', retellData)

    // Update our database with latest status
    const { data, error } = await supabase
      .from('retell_kbs')
      .update({
        state: retellData.state,
        chunks: retellData.total_chunks || 0,
        last_indexed_at: retellData.last_indexed_at ? new Date(retellData.last_indexed_at).toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', kbId)
      .select()
      .single()

    if (error) throw error

    // Get and update source statuses
    const { data: sources, error: sourcesError } = await supabase
      .from('retell_kb_sources')
      .select('*')
      .eq('kb_id', kbId)

    if (!sourcesError && sources) {
      // Check each source status with Retell
      for (const source of sources) {
        try {
          const sourceResponse = await fetch(`https://api.retellai.com/v2/knowledge-base/${kb.kb_id}/source/${source.source_id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${(await import('../_shared/env.ts')).RETELL_API_KEY()}`,
            },
          })

          if (sourceResponse.ok) {
            const sourceData = await sourceResponse.json()
            await supabase
              .from('retell_kb_sources')
              .update({
                status: sourceData.status,
                error_message: sourceData.error_message || null,
                updated_at: new Date().toISOString()
              })
              .eq('id', source.id)
          }
        } catch (sourceError) {
          console.error('Error updating source status:', sourceError)
        }
      }
    }

    return new Response(JSON.stringify({
      ...data,
      retell_data: retellData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in retell-kb-status:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})