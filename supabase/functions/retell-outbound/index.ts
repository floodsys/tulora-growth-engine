import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Get allowed origins from environment
const allowedOrigins = [
  Deno.env.get('VITE_APP_URL'),
  Deno.env.get('PROJECT_URL'),
  'https://nkjxbeypbiclvouqfjyc.supabase.co', // Project URL
].filter(Boolean);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Will be overridden per request
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'null',
  };
}

interface OutboundCallRequest {
  agentSlug: string;
  toNumber: string;
}

interface RetellCallRequest {
  from_number: string;
  to_number: string;
  agent_id?: string;
}

serve(async (req) => {
  const traceId = generateTraceId();
  const origin = req.headers.get('origin');
  const responseCorsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: responseCorsHeaders });
  }

  // Method guard - enforce POST only
  if (req.method !== 'POST') {
    console.log(`[${traceId}] Method not allowed: ${req.method}`);
    return new Response(
      JSON.stringify({ error: 'Method not allowed', traceId }),
      { 
        status: 405, 
        headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // CORS origin validation
  if (origin && !allowedOrigins.includes(origin)) {
    console.log(`[${traceId}] Origin not allowed: ${origin}`);
    return new Response(
      JSON.stringify({ error: 'Origin not allowed', traceId }),
      { 
        status: 403, 
        headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Validate content type
    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      console.log(`[${traceId}] Invalid content type: ${contentType}`);
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json', traceId }),
        { 
          status: 400, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse and validate request body
    const body: OutboundCallRequest = await req.json();
    
    if (!body.agentSlug || !body.toNumber) {
      console.log(`[${traceId}] Missing required fields - agentSlug: ${!!body.agentSlug}, toNumber: ${!!body.toNumber}`);
      return new Response(
        JSON.stringify({ error: 'Missing required fields: agentSlug, toNumber', traceId }),
        { 
          status: 400, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate agent slug
    const validSlugs = ['paul', 'laura', 'jessica'];
    if (!validSlugs.includes(body.agentSlug.toLowerCase())) {
      console.log(`[${traceId}] Invalid agentSlug: ${body.agentSlug}`);
      return new Response(
        JSON.stringify({ error: 'Invalid agentSlug. Must be one of: paul, laura, jessica', traceId }),
        { 
          status: 400, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate phone number format
    if (!body.toNumber.match(/^\+\d{10,15}$/)) {
      console.log(`[${traceId}] Invalid phone number format`);
      return new Response(
        JSON.stringify({ error: 'Invalid toNumber format. Must be E.164 format (+1234567890)', traceId }),
        { 
          status: 400, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get environment variables
    const retellApiKey = Deno.env.get('RETELL_API_KEY');
    const retellPhoneCreateUrl = Deno.env.get('RETELL_PHONE_CREATE_URL');
    
    if (!retellApiKey) {
      console.error(`[${traceId}] RETELL_API_KEY not configured`);
      return new Response(
        JSON.stringify({ error: 'Service configuration error', traceId }),
        { 
          status: 500, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!retellPhoneCreateUrl) {
      console.error(`[${traceId}] RETELL_PHONE_CREATE_URL not configured`);
      return new Response(
        JSON.stringify({ error: 'Service configuration error', traceId }),
        { 
          status: 500, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Determine from_number based on agent slug
    const agentSlugUpper = body.agentSlug.toUpperCase();
    const agentFromNumber = Deno.env.get(`AGENT_${agentSlugUpper}_FROM`);
    const defaultFromNumber = Deno.env.get('RETELL_FROM_NUMBER');
    const fallbackFromNumber = Deno.env.get('RETELL_FROM_NUMBER_DEFAULT');
    
    const fromNumber = agentFromNumber || defaultFromNumber || fallbackFromNumber;
    
    if (!fromNumber) {
      console.error(`[${traceId}] No from_number available for agent: ${body.agentSlug}`);
      return new Response(
        JSON.stringify({ error: 'No phone number configured for this agent', traceId }),
        { 
          status: 500, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Determine agent_id based on agent slug (optional)
    const agentId = Deno.env.get(`AGENT_${agentSlugUpper}_ID`);

    // Prepare Retell API call payload
    const retellPayload: RetellCallRequest = {
      from_number: fromNumber,
      to_number: body.toNumber,
    };

    // Only include agent_id if it's configured
    if (agentId) {
      retellPayload.agent_id = agentId;
    }

    console.log(`[${traceId}] Creating outbound call for agent ${body.agentSlug} to ${body.toNumber.substring(0, 6)}***`);

    // Call Retell API
    const retellResponse = await fetch(retellPhoneCreateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(retellPayload),
    });

    if (!retellResponse.ok) {
      const errorText = await retellResponse.text();
      console.error(`[${traceId}] Retell API error: ${retellResponse.status} - ${errorText.substring(0, 200)}`);
      return new Response(
        JSON.stringify({ error: 'Upstream service error', traceId }),
        { 
          status: 502, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const retellData = await retellResponse.json();
    
    console.log(`[${traceId}] Outbound call created successfully for agent: ${body.agentSlug}`);

    return new Response(
      JSON.stringify({
        status: 'queued',
        data: retellData,
        traceId
      }),
      {
        headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error(`[${traceId}] Error in retell-outbound function: ${error.message}`);
    return new Response(
      JSON.stringify({ error: 'Internal server error', traceId }),
      {
        status: 500,
        headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});