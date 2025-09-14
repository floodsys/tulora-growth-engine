import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface WebhookEvent {
  event: string
  call: any
  agent?: any
  data?: any
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

    const webhookData: WebhookEvent = await req.json()
    const { event, call, agent, data } = webhookData

    console.log('Received webhook event:', event, 'for call:', call?.call_id)

    // Route by event type
    switch (event) {
      case 'call_started':
        await handleCallStarted(supabase, call, agent)
        break
      
      case 'call_ended':
        await handleCallEnded(supabase, call, agent, data)
        break
        
      case 'call_analyzed':
        await handleCallAnalyzed(supabase, call, data)
        break
        
      default:
        console.log('Unhandled webhook event:', event)
    }

    // Store webhook event for debugging
    await supabase
      .from('webhook_events')
      .insert({
        organization_id: call?.organization_id || agent?.organization_id,
        event_type: event,
        event_data: webhookData,
        call_id: call?.call_id,
        agent_id: call?.agent_id || agent?.id,
      })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function handleCallStarted(supabase: any, call: any, agent: any) {
  if (!call?.call_id) return

  // Upsert call record with started status
  await supabase
    .from('retell_calls')
    .upsert({
      call_id: call.call_id,
      organization_id: call.organization_id || agent?.organization_id,
      agent_id: call.agent_id || agent?.id,
      direction: call.direction,
      to_e164: call.to_number,
      from_e164: call.from_number,
      status: 'started',
      started_at: call.start_timestamp ? new Date(call.start_timestamp).toISOString() : new Date().toISOString(),
    }, { 
      onConflict: 'call_id' 
    })

  console.log('Call started recorded:', call.call_id)
}

async function handleCallEnded(supabase: any, call: any, agent: any, data: any) {
  if (!call?.call_id) return

  const updates: any = {
    status: 'completed',
    ended_at: call.end_timestamp ? new Date(call.end_timestamp).toISOString() : new Date().toISOString(),
  }

  // Calculate duration if we have timestamps
  if (call.start_timestamp && call.end_timestamp) {
    updates.duration_ms = new Date(call.end_timestamp).getTime() - new Date(call.start_timestamp).getTime()
  }

  // Add recording URL if available
  if (call.recording_url) {
    updates.recording_signed_url = call.recording_url
  }

  // Add transcript if available
  if (call.transcript) {
    updates.transcript_summary = call.transcript
  }

  await supabase
    .from('retell_calls')
    .update(updates)
    .eq('call_id', call.call_id)

  console.log('Call ended recorded:', call.call_id)
}

async function handleCallAnalyzed(supabase: any, call: any, analysisData: any) {
  if (!call?.call_id) return

  const updates: any = {
    analysis_json: analysisData,
  }

  // Extract analysis fields for easier querying
  if (analysisData) {
    if (analysisData.sentiment) {
      updates.sentiment = analysisData.sentiment
    }
    if (analysisData.outcome) {
      updates.outcome = analysisData.outcome
    }
    if (analysisData.lead_score !== undefined) {
      updates.lead_score = analysisData.lead_score
    }
    if (analysisData.topics && Array.isArray(analysisData.topics)) {
      updates.topics = analysisData.topics
    }
    if (analysisData.summary) {
      updates.transcript_summary = analysisData.summary
    }
  }

  await supabase
    .from('retell_calls')
    .update(updates)
    .eq('call_id', call.call_id)

  console.log('Call analysis recorded:', call.call_id)
}