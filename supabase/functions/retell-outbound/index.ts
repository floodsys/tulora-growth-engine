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
  const traceId = `trace_${Date.now()}_${crypto.randomUUID().slice(0,10)}`;
  console.log("[", traceId, "]", "retell-outbound request");
  
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
  if (new URL(req.url).pathname.endsWith('/ping')) {
    try {
      await fetch('https://dns.google/resolve?name=api.retell.ai');
      return new Response(
        JSON.stringify({ egress: true, traceId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ egress: false, traceId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
  
  // Only POST allowed for main functionality
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'METHOD_NOT_ALLOWED', traceId }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    // Parse request body
    const body: OutboundCallRequest = await req.json();
    
    // Read environment variables inside POST handler
    const apiKey = Deno.env.get("RETELL_API_KEY");
    const phoneUrl = Deno.env.get("RETELL_PHONE_CREATE_URL") ?? "https://api.retellai.com/v2/create-phone-call";
    
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
    if (!body.toNumber.match(/^\+[1-9]\d{7,14}$/)) {
      return new Response(
        JSON.stringify({ 
          error: 'INVALID_INPUT', 
          details: 'toNumber must be in E.164',
          traceId 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Resolve agent configuration
    const up = body.agentSlug.toUpperCase();
    const agentId = Deno.env.get(`AGENT_${up}_ID`);
    const fromNumber = Deno.env.get(`AGENT_${up}_FROM`) ?? Deno.env.get("RETELL_FROM_NUMBER");
    
    // Check for missing agent configuration
    if (!agentId) {
      return new Response(
        JSON.stringify({ 
          error: 'MISCONFIG', 
          missing: [`AGENT_${up}_ID`],
          traceId 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!fromNumber) {
      return new Response(
        JSON.stringify({ 
          error: 'MISCONFIG', 
          missing: ['AGENT_*_FROM or RETELL_FROM_NUMBER'],
          traceId 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check for missing Retell API configuration
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'MISCONFIG', 
          missing: ['RETELL_API_KEY'],
          traceId 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[${traceId}] Creating outbound call for agent ${body.agentSlug} to ${body.toNumber.substring(0, 6)}***`);
    
    // Call Retell API
    const retellResponse = await fetch(phoneUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from_number: fromNumber,
        to_number: body.toNumber,
        agent_id: agentId
      })
    });
    
    if (!retellResponse.ok) {
      const status = retellResponse.status;
      const text = await retellResponse.text();
      console.error("[", traceId, "] Retell upstream", status, text.slice(0, 200));
      return new Response(
        JSON.stringify({ 
          error: 'UPSTREAM_RETELL_ERROR', 
          status: status,
          hint: 'Check RETELL_API_KEY / from_number / agent binding / destination permissions.',
          traceId 
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const retellData = await retellResponse.json();
    
    console.log(`[${traceId}] Outbound call created successfully for agent: ${body.agentSlug}`);
    
    return new Response(
      JSON.stringify({ status: "queued", data: retellData, traceId }),
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