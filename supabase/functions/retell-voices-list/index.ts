import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireOrgActive, createBlockedResponse } from '../_shared/org-guard.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const corrId = crypto.randomUUID()
  console.log(`[retell-voices-list][${corrId}] ${req.method}`)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get organization ID from request query params
    const url = new URL(req.url)
    const organizationId = url.searchParams.get('organizationId')

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'organizationId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check organization status
    const guardResult = await requireOrgActive({
      organizationId,
      action: 'retell.voices.list',
      path: '/retell-voices-list',
      method: req.method,
      supabase
    })

    if (!guardResult.ok) {
      return createBlockedResponse(guardResult, corsHeaders)
    }

    // Fetch voices from Retell API
    const { RETELL_API_KEY } = await import('../_shared/env.ts')
    const retellApiKey = RETELL_API_KEY()

    console.log('Fetching voices from Retell API...')
    const retellResponse = await fetch('https://api.retellai.com/list-voices', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!retellResponse.ok) {
      const errorText = await retellResponse.text()
      console.error('Retell API error:', retellResponse.status, errorText)
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch voices from Retell',
          details: errorText
        }),
        {
          status: retellResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const voices = await retellResponse.json()
    console.log('Successfully fetched', voices?.length || 0, 'voices')

    // Log the successful API call
    await supabase.rpc('log_event', {
      p_org_id: organizationId,
      p_action: 'retell.voices.listed',
      p_target_type: 'retell_api',
      p_actor_user_id: null,
      p_actor_role_snapshot: 'user',
      p_status: 'success',
      p_channel: 'audit',
      p_metadata: {
        voices_count: voices?.length || 0,
        timestamp: new Date().toISOString()
      }
    })

    return new Response(
      JSON.stringify({ voices }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Unexpected error in retell-voices-list:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})