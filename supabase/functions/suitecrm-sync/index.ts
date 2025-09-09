import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getSuiteCRMClient } from "../_shared/suitecrm.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const VERSION = "2025-09-09-2"

async function createLeadInSuiteCRM(payload: any) {
  try {
    const client = getSuiteCRMClient()
    const mode = client.getMode()

    // Normalize attributes
    const attrs = { ...payload }
    if (!attrs.last_name) {
      attrs.last_name = (attrs.full_name?.trim()?.split(' ').pop()) ||
                       (attrs.email1?.split('@')[0]) ||
                       'Unknown'
    }

    // Try JSON:API format first
    let response = await client.crmFetch("module/Leads", {
      method: "POST",
      headers: { "Content-Type": "application/vnd.api+json" },
      body: JSON.stringify({ data: { type: "Leads", attributes: attrs } })
    })

    console.info("suitecrm.sync", { status: response.status })

    // If JSON:API fails with specific status codes, try plain JSON fallback
    if (!response.ok && [400, 406, 415].includes(response.status)) {
      response = await client.crmFetch("module/Leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attrs)
      })
      console.info("suitecrm.sync", { status: response.status, fallback: true })
    }

    if (!response.ok) {
      // Parse error response
      const text = await response.text()
      let message = text.slice(0, 300)
      
      try {
        const parsed = JSON.parse(text)
        message = parsed?.errors?.[0]?.detail || 
                 parsed?.message || 
                 parsed?.error || 
                 message
      } catch {
        // Use text as-is if not JSON
      }

      return new Response(
        JSON.stringify({
          ok: false,
          status: response.status,
          error: message,
          mode,
          version: VERSION
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse successful response
    const parsed = await response.json()
    
    return new Response(
      JSON.stringify({
        ok: true,
        result: parsed,
        version: VERSION
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        mode: 'client_credentials',
        version: VERSION
      }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Method not allowed. Use POST only.',
        version: VERSION
      }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    const payload = await req.json()
    return await createLeadInSuiteCRM(payload)
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Request processing failed',
        mode: 'client_credentials',
        version: VERSION
      }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})