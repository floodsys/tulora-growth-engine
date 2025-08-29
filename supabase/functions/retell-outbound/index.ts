import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface OutboundCallRequest {
  agentSlug: string;
  toNumber: string;
}

interface RetellCallRequest {
  from_number: string;
  to_number: string;
  agent_id: string;
}

serve(async (req) => {
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Parse CORS allowlist once per request
  const allow = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  
  // CORS helper
  function cors(origin: string | null): Record<string, string> {
    const isAllowed = origin && allow.includes(origin);
    return {
      'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    };
  }
  
  const origin = req.headers.get('origin');
  const corsHeaders = cors(origin);
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  // Handle /ping for external egress test
  if (new URL(req.url).pathname === '/ping') {
    try {
      const testResponse = await fetch('https://httpbin.org/json');
      const testData = await testResponse.json();
      return new Response(
        JSON.stringify({ status: 'ok', egress: 'working', test: testData, traceId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ status: 'error', egress: 'failed', error: error.message, traceId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
  
  // Only POST allowed for main functionality
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', traceId }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    // Check required secrets
    const retellApiKey = Deno.env.get('RETELL_API_KEY');
    if (!retellApiKey) {
      return new Response(
        JSON.stringify({ error: 'MISCONFIG: missing RETELL_API_KEY', traceId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const retellUrl = Deno.env.get('RETELL_PHONE_CREATE_URL') || 'https://api.retell.ai/v2/create-phone-call';
    
    // Parse request body
    const body: OutboundCallRequest = await req.json();
    
    if (!body.agentSlug || !body.toNumber) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: agentSlug, toNumber', traceId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate agent slug
    const validSlugs = ['paul', 'laura', 'jessica'];
    if (!validSlugs.includes(body.agentSlug.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Invalid agentSlug. Must be one of: paul, laura, jessica', traceId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate phone number format
    if (!body.toNumber.match(/^\+\d{10,15}$/)) {
      return new Response(
        JSON.stringify({ error: 'Invalid toNumber format. Must be E.164 format (+1234567890)', traceId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get agent configuration
    const agentSlugUpper = body.agentSlug.toUpperCase();
    const agentId = Deno.env.get(`AGENT_${agentSlugUpper}_ID`);
    const fromNumber = Deno.env.get(`AGENT_${agentSlugUpper}_FROM`) ?? Deno.env.get('RETELL_FROM_NUMBER');
    
    if (!agentId) {
      return new Response(
        JSON.stringify({ error: `MISCONFIG: missing AGENT_${agentSlugUpper}_ID`, traceId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!fromNumber) {
      return new Response(
        JSON.stringify({ error: `MISCONFIG: missing AGENT_${agentSlugUpper}_FROM or RETELL_FROM_NUMBER`, traceId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Prepare Retell API payload
    const retellPayload: RetellCallRequest = {
      from_number: fromNumber,
      to_number: body.toNumber,
      agent_id: agentId,
    };
    
    console.log(`[${traceId}] Creating outbound call for agent ${body.agentSlug} to ${body.toNumber.substring(0, 6)}***`);
    
    // Call Retell API
    const retellResponse = await fetch(retellUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(retellPayload),
    });
    
    if (!retellResponse.ok) {
      const errorText = await retellResponse.text();
      console.error(`[${traceId}] Retell API error: ${retellResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: 'UPSTREAM_RETELL_ERROR', status: retellResponse.status, traceId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const retellData = await retellResponse.json();
    
    console.log(`[${traceId}] Outbound call created successfully for agent: ${body.agentSlug}`);
    
    return new Response(
      JSON.stringify({ status: 'queued', data: retellData, traceId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error(`[${traceId}] Error in retell-outbound function: ${error.message}`);
    return new Response(
      JSON.stringify({ error: 'Internal server error', traceId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});