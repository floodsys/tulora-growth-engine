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

    const { kbId, type, content, name, organizationId, options } = await req.json()

    // Get KB from database
    const { data: kb, error: kbError } = await supabase
      .from('retell_kbs')
      .select('*')
      .eq('id', kbId)
      .eq('organization_id', organizationId)
      .single()

    if (kbError || !kb) throw new Error('Knowledge base not found')

    let retellSourceData
    let size = 0

    // Handle different source types
    if (type === 'file') {
      // File upload - content should be base64 encoded file data
      const fileBlob = Uint8Array.from(atob(content), c => c.charCodeAt(0))
      size = fileBlob.length

      const formData = new FormData()
      formData.append('file', new Blob([fileBlob]), name)

      const retellResponse = await fetch(`https://api.retellai.com/v2/knowledge-base/${kb.kb_id}/add-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await import('../_shared/env.ts')).RETELL_API_KEY()}`,
        },
        body: formData,
      })

      if (!retellResponse.ok) {
        const errorData = await retellResponse.text()
        console.error('Retell file upload failed:', errorData)
        throw new Error(`Retell API error: ${retellResponse.status}`)
      }

      retellSourceData = await retellResponse.json()
    } else if (type === 'url') {
      // URL source with optional auto-refresh
      const urlPayload: any = { url: content }
      if (options?.enable_auto_refresh) {
        urlPayload.enable_auto_refresh = true
      }
      
      const retellResponse = await fetch(`https://api.retellai.com/v2/knowledge-base/${kb.kb_id}/add-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await import('../_shared/env.ts')).RETELL_API_KEY()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(urlPayload),
      })

      if (!retellResponse.ok) {
        const errorData = await retellResponse.text()
        console.error('Retell URL add failed:', errorData)
        throw new Error(`Retell API error: ${retellResponse.status}`)
      }

      retellSourceData = await retellResponse.json()
      size = content.length
    } else if (type === 'text') {
      // Text source
      size = new Blob([content]).size

      const retellResponse = await fetch(`https://api.retellai.com/v2/knowledge-base/${kb.kb_id}/add-text`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await import('../_shared/env.ts')).RETELL_API_KEY()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: content,
          text_name: name,
        }),
      })

      if (!retellResponse.ok) {
        const errorData = await retellResponse.text()
        console.error('Retell text add failed:', errorData)
        throw new Error(`Retell API error: ${retellResponse.status}`)
      }

      retellSourceData = await retellResponse.json()
    } else {
      throw new Error('Invalid source type')
    }

    console.log('Created Retell source:', retellSourceData)

    // Store in our database
    const { data, error } = await supabase
      .from('retell_kb_sources')
      .insert({
        source_id: retellSourceData.source_id,
        kb_id: kbId,
        type: type,
        name: name,
        size: size,
        status: 'pending',
        metadata: {
          retell_data: retellSourceData,
          ...(type === 'url' && options?.enable_auto_refresh && { enable_auto_refresh: true })
        }
      })
      .select()
      .single()

    if (error) throw error

    // Update KB source count
    const { error: updateError } = await supabase
      .from('retell_kbs')
      .update({ 
        source_count: supabase.sql`source_count + 1`,
        updated_at: new Date().toISOString()
      })
      .eq('id', kbId)

    if (updateError) console.error('Error updating KB source count:', updateError)

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in retell-kb-add-source:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})