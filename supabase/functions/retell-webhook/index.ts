import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to verify webhook signature
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Remove 'sha256=' prefix if present
    const providedSignature = signature.replace(/^sha256=/, '');
    
    return expectedHex === providedSignature;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

// Helper function to determine call direction
function getCallDirection(payload: any): string {
  // Check for web call indicators
  if (payload.channel === 'web' || payload.call_type === 'web_call') {
    return 'web';
  }
  
  // Check direction field
  if (payload.direction) {
    return payload.direction.toLowerCase();
  }
  
  // Fallback logic based on phone numbers or other indicators
  if (payload.from_number && payload.to_number) {
    // Could implement logic to determine if this is inbound/outbound
    // based on known agent numbers, but default to 'inbound' for now
    return 'inbound';
  }
  
  return 'inbound'; // Default fallback
}

// Helper function to parse timestamps
function parseTimestamp(timestamp: string | number | null): string | null {
  if (!timestamp) return null;
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Method guard
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    let payload: any;
    
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      console.error('Invalid JSON payload:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify webhook signature if secret is configured
    const webhookSecret = Deno.env.get('RETELL_WEBHOOK_SECRET');
    const signature = req.headers.get('x-retell-signature') || req.headers.get('x-signature');
    
    if (webhookSecret && signature) {
      const isValidSignature = await verifySignature(rawBody, signature, webhookSecret);
      if (!isValidSignature) {
        console.error('Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } else if (webhookSecret) {
      console.warn('Webhook secret configured but no signature provided');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Received Retell webhook:', payload.event || 'unknown_event');

    // Extract call information from payload
    const callId = payload.call_id || payload.id;
    if (!callId) {
      console.warn('No call_id found in webhook payload');
      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map webhook data to call_logs schema
    const callLogData = {
      call_id: callId,
      direction: getCallDirection(payload),
      to_e164: payload.to_number || payload.to || null,
      from_e164: payload.from_number || payload.from || null,
      status: payload.call_status || payload.status || 'unknown',
      started_at: parseTimestamp(payload.start_timestamp || payload.started_at),
      ended_at: parseTimestamp(payload.end_timestamp || payload.ended_at),
      transcript_url: payload.recording_url || payload.transcript_url || null,
      raw: payload,
    };

    // Try to find matching agent based on agent_id or phone numbers
    let agentId: string | null = null;
    
    if (payload.agent_id) {
      // Try to match by retell_agent_id
      const { data: agentByRetellId } = await supabase
        .from('voice_agents')
        .select('id')
        .eq('retell_agent_id', payload.agent_id)
        .maybeSingle();
      
      if (agentByRetellId) {
        agentId = agentByRetellId.id;
      }
    }
    
    if (!agentId && callLogData.from_e164) {
      // Try to match by from_number
      const { data: agentByFromNumber } = await supabase
        .from('voice_agents')
        .select('id')
        .eq('from_number', callLogData.from_e164)
        .maybeSingle();
      
      if (agentByFromNumber) {
        agentId = agentByFromNumber.id;
      }
    }

    // Upsert call log record
    const { error: upsertError } = await supabase
      .from('call_logs')
      .upsert(
        {
          ...callLogData,
          agent_id: agentId,
        },
        {
          onConflict: 'call_id',
        }
      );

    if (upsertError) {
      console.error('Error upserting call log:', upsertError);
    } else {
      console.log(`Call log upserted for call_id: ${callId}, agent_id: ${agentId || 'none'}`);
    }

    // Return quick response
    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in retell-webhook function:', error.message);
    
    // Return success even on errors to avoid Retell retrying
    // Log errors for debugging but don't block webhook delivery
    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});