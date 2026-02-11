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

    const { sourceId, organizationId } = await req.json()

    // Get source from database
    const { data: source, error: sourceError } = await supabase
      .from('retell_kb_sources')
      .select('*, retell_kbs!inner(organization_id, kb_id)')
      .eq('id', sourceId)
      .single()

    if (sourceError || !source) throw new Error('Source not found')

    // Verify organization access
    if (source.retell_kbs.organization_id !== organizationId) {
      throw new Error('Unauthorized')
    }

    // Delete from Retell
    const retellResponse = await fetch(`https://api.retellai.com/v2/knowledge-base/${source.retell_kbs.kb_id}/delete-source/${source.source_id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${(await import('../_shared/env.ts')).RETELL_API_KEY()}`,
      },
    })

    if (!retellResponse.ok) {
      const errorData = await retellResponse.text()
      console.error('Retell source deletion failed:', errorData)
      throw new Error(`Retell API error: ${retellResponse.status}`)
    }

    console.log('Deleted Retell source:', source.source_id)

    // Delete from our database
    const { error } = await supabase
      .from('retell_kb_sources')
      .delete()
      .eq('id', sourceId)

    if (error) throw error

    // Update KB source count
    const { error: updateError } = await supabase
      .from('retell_kbs')
      .update({ 
        source_count: supabase.sql`source_count - 1`,
        updated_at: new Date().toISOString()
      })
      .eq('id', source.kb_id)

    if (updateError) console.error('Error updating KB source count:', updateError)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in retell-kb-delete-source:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})