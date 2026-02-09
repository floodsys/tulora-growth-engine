import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireOrgActive, createBlockedResponse } from '../_shared/org-guard.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

interface CallDetailsRequest {
  callId: string
  organizationId: string
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  console.log('=== Retell Call Details Request ===')
  console.log('Request method:', req.method)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
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

    const { callId, organizationId }: CallDetailsRequest = await req.json()

    if (!callId || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'callId and organizationId are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check organization status
    const guardResult = await requireOrgActive({
      organizationId,
      action: 'retell.call.get',
      path: '/retell-calls-get',
      method: req.method,
      supabase
    })

    if (!guardResult.ok) {
      return createBlockedResponse(guardResult, corsHeaders)
    }

    console.log('Fetching call details for:', callId)

    // Get call from database
    const { data: call, error: callError } = await supabase
      .from('retell_calls')
      .select(`
        *,
        retell_agents(name, voice_id, data_storage_setting, opt_in_signed_url)
      `)
      .eq('call_id', callId)
      .eq('organization_id', organizationId)
      .single()

    if (callError || !call) {
      console.error('Call not found:', callError)
      return new Response(
        JSON.stringify({ error: 'Call not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Fetch additional details from Retell API if needed
    const { RETELL_API_KEY } = await import('../_shared/env.ts')
    const retellApiKey = RETELL_API_KEY()
    let retellCallData = null
    let transcriptDetails = null
    let recordingUrl = null

    if (retellApiKey) {
      try {
        console.log('Fetching additional details from Retell API...')
        
        // Get call details from Retell
        const retellResponse = await fetch(`https://api.retellai.com/get-call/${callId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${retellApiKey}`,
            'Content-Type': 'application/json',
          },
        })

        if (retellResponse.ok) {
          retellCallData = await retellResponse.json()
        }

        // Get transcript if available
        if (retellCallData?.transcript_url) {
          const transcriptResponse = await fetch(retellCallData.transcript_url, {
            headers: {
              'Authorization': `Bearer ${retellApiKey}`,
            },
          })

          if (transcriptResponse.ok) {
            transcriptDetails = await transcriptResponse.json()
          }
        }

        // Generate signed recording URL if storage settings allow
        const agent = call.retell_agents
        if (agent?.opt_in_signed_url && retellCallData?.recording_url) {
          // Create a proxy signed URL through our storage system
          try {
            const { data: signedUrl } = await supabase.storage
              .from('call-recordings')
              .createSignedUrl(`${callId}/recording.mp3`, 3600) // 1 hour expiry

            if (signedUrl) {
              recordingUrl = signedUrl.signedUrl
            }
          } catch (storageError) {
            console.log('Could not create signed URL:', storageError)
            // If the file doesn't exist in storage, use the Retell URL directly if allowed
            if (agent.data_storage_setting !== 'minimal') {
              recordingUrl = retellCallData.recording_url
            }
          }
        }

      } catch (retellError) {
        console.error('Error fetching from Retell API:', retellError)
        // Continue with database data only
      }
    }

    // Build comprehensive call details
    const callDetails = {
      ...call,
      retell_data: retellCallData,
      transcript: transcriptDetails,
      recording_url: recordingUrl,
      timeline: [
        ...(call.started_at ? [{
          timestamp: call.started_at,
          event: 'call_started',
          description: `Call ${call.direction === 'inbound' ? 'received from' : 'placed to'} ${call.direction === 'inbound' ? call.from_e164 : call.to_e164}`
        }] : []),
        ...(call.ended_at ? [{
          timestamp: call.ended_at,
          event: 'call_ended',
          description: `Call completed after ${call.duration_ms ? Math.round(call.duration_ms / 1000) : 0} seconds`
        }] : []),
        ...(call.analysis_json && Object.keys(call.analysis_json).length > 0 ? [{
          timestamp: call.updated_at,
          event: 'analysis_completed',
          description: 'Call analysis and scoring completed'
        }] : [])
      ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    }

    console.log('Successfully fetched call details')

    // Log the successful API call
    await supabase.rpc('log_event', {
      p_org_id: organizationId,
      p_action: 'retell.call.viewed',
      p_target_type: 'retell_call',
      p_target_id: callId,
      p_status: 'success',
      p_channel: 'audit',
      p_metadata: {
        call_duration_ms: call.duration_ms,
        has_recording: !!recordingUrl,
        has_transcript: !!transcriptDetails,
        timestamp: new Date().toISOString()
      }
    })

    return new Response(
      JSON.stringify({ call: callDetails }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Unexpected error in retell-calls-get:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})