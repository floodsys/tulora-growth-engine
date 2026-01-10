import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RETELL_WEBHOOK_SECRET } from '../_shared/env.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retell-signature',
}

// Helper function to verify webhook signature
async function verifyWebhookSignature(
  signature: string,
  body: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const expectedSignature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );
    
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Remove 'sha256=' prefix if present
    const cleanSignature = signature.replace('sha256=', '');
    
    return cleanSignature === expectedHex;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

interface RetellWebhookEvent {
  event: string
  call_id: string
  agent_id?: string
  call_type?: 'web_call' | 'phone_call'
  call_status?: 'ongoing' | 'completed' | 'error'
  direction?: 'inbound' | 'outbound'
  from_number?: string
  to_number?: string
  start_timestamp?: number
  end_timestamp?: number
  call_length?: number
  recording_url?: string
  transcript?: string
  transcript_summary?: string
  call_analysis?: {
    call_successful?: boolean
    call_summary?: string
    user_sentiment?: string
    agent_summary?: string
    inbound_phone_call_summary?: {
      evaluation?: {
        call_result?: string
        call_summary?: string
        extraction?: Record<string, any>
      }
    }
  }
  metadata?: Record<string, any>
}

// Helper function to determine organization from agent_id
async function getOrganizationFromAgent(supabase: any, agentId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('retell_agents')
      .select('organization_id')
      .eq('agent_id', agentId)
      .single()
    
    if (error || !data) {
      console.error('Could not find organization for agent:', agentId, error)
      return null
    }
    
    return data.organization_id
  } catch (error) {
    console.error('Error finding organization for agent:', error)
    return null
  }
}

// Helper function to extract analysis fields
function extractAnalysisFields(callAnalysis: any) {
  let outcome = null
  let sentiment = null
  let leadScore = null
  let topics = []

  if (callAnalysis) {
    // Extract outcome from various possible fields
    if (callAnalysis.call_successful !== undefined) {
      outcome = callAnalysis.call_successful ? 'positive' : 'negative'
    } else if (callAnalysis.inbound_phone_call_summary?.evaluation?.call_result) {
      const result = callAnalysis.inbound_phone_call_summary.evaluation.call_result.toLowerCase()
      if (result.includes('success') || result.includes('positive')) {
        outcome = 'positive'
      } else if (result.includes('fail') || result.includes('negative')) {
        outcome = 'negative'
      } else {
        outcome = 'neutral'
      }
    }

    // Extract sentiment
    if (callAnalysis.user_sentiment) {
      sentiment = callAnalysis.user_sentiment.toLowerCase()
    }

    // Extract lead score (0-100 based on analysis)
    if (callAnalysis.inbound_phone_call_summary?.evaluation?.extraction) {
      const extraction = callAnalysis.inbound_phone_call_summary.evaluation.extraction
      // Try to compute a lead score from various factors
      let score = 50 // Base score
      
      if (outcome === 'positive') score += 30
      else if (outcome === 'negative') score -= 30
      
      if (sentiment === 'positive') score += 20
      else if (sentiment === 'negative') score -= 20
      
      leadScore = Math.max(0, Math.min(100, score))
    }

    // Extract topics/keywords
    if (callAnalysis.call_summary) {
      // Simple keyword extraction - in production, you might use NLP
      const keywords = callAnalysis.call_summary.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 4)
        .slice(0, 10) // Limit to 10 keywords
      topics = keywords
    }
  }

  return { outcome, sentiment, leadScore, topics }
}

async function handleCallStarted(supabase: any, event: RetellWebhookEvent, organizationId: string) {
  const callData = {
    call_id: event.call_id,
    organization_id: organizationId,
    agent_id: event.agent_id,
    direction: event.direction || 'inbound',
    to_e164: event.to_number || 'unknown',
    from_e164: event.from_number || 'unknown',
    status: 'started',
    started_at: event.start_timestamp ? new Date(event.start_timestamp * 1000).toISOString() : new Date().toISOString(),
    raw_webhook_data: event
  }

  const { data, error } = await supabase
    .from('retell_calls')
    .upsert(callData, { onConflict: 'call_id' })
    .select()

  if (error) {
    console.error('Error creating call record:', error)
    throw error
  }

  console.log('Call started record created:', data)
  return data
}

async function handleCallEnded(supabase: any, event: RetellWebhookEvent, organizationId: string) {
  const updateData = {
    status: 'completed',
    ended_at: event.end_timestamp ? new Date(event.end_timestamp * 1000).toISOString() : new Date().toISOString(),
    duration_ms: event.call_length ? event.call_length * 1000 : null,
    recording_signed_url: event.recording_url,
    transcript_summary: event.transcript_summary,
    raw_webhook_data: event
  }

  const { data, error } = await supabase
    .from('retell_calls')
    .update(updateData)
    .eq('call_id', event.call_id)
    .select()

  if (error) {
    console.error('Error updating call record:', error)
    throw error
  }

  console.log('Call ended record updated:', data)
  return data
}

async function handleCallAnalyzed(supabase: any, event: RetellWebhookEvent, organizationId: string) {
  const analysisFields = extractAnalysisFields(event.call_analysis)
  
  const updateData = {
    analysis_json: event.call_analysis || {},
    outcome: analysisFields.outcome,
    sentiment: analysisFields.sentiment,
    lead_score: analysisFields.leadScore,
    topics: analysisFields.topics,
    raw_webhook_data: event
  }

  const { data, error } = await supabase
    .from('retell_calls')
    .update(updateData)
    .eq('call_id', event.call_id)
    .select()

  if (error) {
    console.error('Error updating call analysis:', error)
    throw error
  }

  console.log('Call analysis updated:', data)
  return data
}

async function handleGenericEvent(supabase: any, event: RetellWebhookEvent, organizationId: string) {
  // For any other event types, just update the raw webhook data
  const { data, error } = await supabase
    .from('retell_calls')
    .update({ 
      raw_webhook_data: event,
      updated_at: new Date().toISOString()
    })
    .eq('call_id', event.call_id)
    .select()

  if (error) {
    console.error('Error updating call with generic event:', error)
    throw error
  }

  console.log('Generic event processed:', data)
  return data
}

// Helper function to process different event types
async function processWebhookEvent(supabase: any, event: RetellWebhookEvent) {
  const organizationId = event.agent_id ? await getOrganizationFromAgent(supabase, event.agent_id) : null
  
  if (!organizationId) {
    console.error('Could not determine organization for event:', event)
    return null
  }

  console.log(`Processing ${event.event} for call ${event.call_id}`)

  switch (event.event) {
    case 'call_started':
      return await handleCallStarted(supabase, event, organizationId)
    
    case 'call_ended':
      return await handleCallEnded(supabase, event, organizationId)
    
    case 'call_analyzed':
    case 'analysis_completed':
      return await handleCallAnalyzed(supabase, event, organizationId)
    
    default:
      console.log('Unknown event type:', event.event)
      return await handleGenericEvent(supabase, event, organizationId)
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== Retell Webhook Received ===");
  console.log("Method:", req.method);
  console.log("Headers:", Object.fromEntries(req.headers));

  try {
    // Create Supabase client with service role for webhook processing
    const supabase = createClient(
      SUPABASE_URL(),
      SUPABASE_SERVICE_ROLE_KEY(),
    );

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get raw body for signature verification
    const rawBody = await req.text();
    console.log("Raw body length:", rawBody.length);

    // REQUIRED: Verify webhook signature (hardened - no processing without valid signature)
    const signature = req.headers.get('x-retell-signature');
    
    // Fail immediately if signature header is missing
    if (!signature) {
      console.error('Missing x-retell-signature header - rejecting request');
      return new Response(
        JSON.stringify({ error: 'Missing webhook signature' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get webhook secret and verify signature
    const webhookSecret = RETELL_WEBHOOK_SECRET();
    if (!webhookSecret) {
      console.error('RETELL_WEBHOOK_SECRET environment variable not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const isValidSignature = await verifyWebhookSignature(signature, rawBody, webhookSecret);
    
    // Fail if signature does not match
    if (!isValidSignature) {
      console.error('Invalid webhook signature - computed HMAC does not match header');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('Webhook signature verified successfully');

    // Parse the webhook body ONLY after signature verification passes
    const webhookBody: RetellWebhookEvent = JSON.parse(rawBody);
    console.log("Webhook body:", JSON.stringify(webhookBody, null, 2));

    // Process the webhook event
    const result = await processWebhookEvent(supabase, webhookBody);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook processed successfully",
        event: webhookBody.event,
        call_id: webhookBody.call_id,
        data: result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error("Error processing webhook:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
