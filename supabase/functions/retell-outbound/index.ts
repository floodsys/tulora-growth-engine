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
    // Parse request body
    const body: OutboundCallRequest = await req.json();
    
    // Validate required fields
    if (!body.agentSlug || !body.toNumber) {
      return new Response(
        JSON.stringify({ 
          error: 'INVALID_INPUT', 
          details: 'Missing required fields: agentSlug, toNumber',
          traceId 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate agent slug
    const validSlugs = ['paul', 'laura', 'jessica'];
    if (!validSlugs.includes(body.agentSlug.toLowerCase())) {
      return new Response(
        JSON.stringify({ 
          error: 'INVALID_INPUT', 
          details: `agentSlug must be one of: ${validSlugs.join(', ')}`,
          traceId 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate phone number format (E.164)
    if (!body.toNumber.match(/^\+\d{10,15}$/)) {
      return new Response(
        JSON.stringify({ 
          error: 'INVALID_INPUT', 
          details: 'toNumber must be in E.164 format (+1234567890)',
          traceId 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Resolve agent configuration
    const UP = body.agentSlug.toUpperCase();
    const agent_id = Deno.env.get(`AGENT_${UP}_ID`);
    const from_number = Deno.env.get(`AGENT_${UP}_FROM`) ?? Deno.env.get('RETELL_FROM_NUMBER');
    
    // Check for missing agent configuration
    const missing = [];
    if (!agent_id) missing.push(`AGENT_${UP}_ID`);
    if (!from_number) missing.push(`AGENT_${UP}_FROM or RETELL_FROM_NUMBER`);
    
    if (missing.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'MISCONFIG', 
          missing,
          traceId 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Resolve Retell API configuration
    const apiKey = Deno.env.get('RETELL_API_KEY');
    const url = Deno.env.get('RETELL_PHONE_CREATE_URL');
    
    const retellMissing = [];
    if (!apiKey) retellMissing.push('RETELL_API_KEY');
    if (!url) retellMissing.push('RETELL_PHONE_CREATE_URL');
    
    if (retellMissing.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'MISCONFIG', 
          missing: retellMissing,
          traceId 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[${traceId}] Creating outbound call for agent ${body.agentSlug} to ${body.toNumber.substring(0, 6)}***`);
    
    // Call Retell API
    const retellResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_number,
        to_number: body.toNumber,
        agent_id
      }),
    });
    
    if (!retellResponse.ok) {
      const errorText = await retellResponse.text();
      console.error(`[${traceId}] Retell API error: ${retellResponse.status} - ${errorText.substring(0, 200)}`);
      return new Response(
        JSON.stringify({ 
          error: 'UPSTREAM_RETELL_ERROR', 
          status: retellResponse.status, 
          traceId 
        }),
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