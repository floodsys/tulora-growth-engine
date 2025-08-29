import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface WebCallRequest {
  agentSlug: string;
}

interface RetellWebCallRequest {
  agent_id: string;
}

serve(async (req) => {
  const traceId = `trace_${Date.now()}_${crypto.randomUUID().slice(0,10)}`;
  console.log("[", traceId, "]", "retell-webcall-create request");
  
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
      JSON.stringify({ error: 'Method not allowed', traceId }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    // Parse request body
    const body: WebCallRequest = await req.json();
    
    if (!body.agentSlug) {
      return new Response(
        JSON.stringify({ error: 'INVALID_INPUT', details: 'Missing required field: agentSlug', traceId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate agent slug
    const validSlugs = ['paul', 'laura', 'jessica'];
    if (!validSlugs.includes(body.agentSlug.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'INVALID_INPUT', details: `agentSlug must be one of: ${validSlugs.join(', ')}`, traceId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Resolve agent configuration
    const UP = body.agentSlug.toUpperCase();
    const agent_id = Deno.env.get(`AGENT_${UP}_ID`);
    
    if (!agent_id) {
      return new Response(
        JSON.stringify({ error: 'MISCONFIG', missing: [`AGENT_${UP}_ID`], traceId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Resolve Retell API configuration
    const apiKey = Deno.env.get('RETELL_API_KEY');
    const url = Deno.env.get('RETELL_WEB_CREATE_URL');
    
    const missing = [];
    if (!apiKey) missing.push('RETELL_API_KEY');
    if (!url) missing.push('RETELL_WEB_CREATE_URL');
    
    if (missing.length > 0) {
      return new Response(
        JSON.stringify({ error: 'MISCONFIG', missing, traceId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[${traceId}] Creating web call for agent ${body.agentSlug}`);
    
    // Call Retell API
    const retellResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent_id }),
    });
    
    if (!retellResponse.ok) {
      const errorText = await retellResponse.text();
      console.error(`[${traceId}] Retell API error: ${retellResponse.status} - Error details redacted for security`);
      return new Response(
        JSON.stringify({ error: 'UPSTREAM_RETELL_ERROR', status: retellResponse.status, traceId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const retellData = await retellResponse.json();
    
    console.log(`[${traceId}] Web call created successfully for agent: ${body.agentSlug}`);
    
    return new Response(
      JSON.stringify({ ...retellData, traceId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error(`[${traceId}] Error in retell-webcall-create function: ${error.message}`);
    return new Response(
      JSON.stringify({ error: 'Internal server error', traceId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});