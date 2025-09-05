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
  // Trace ID on every request
  const traceId = `trace_${Date.now()}_${crypto.randomUUID().slice(0,10)}`;
  console.log("[", traceId, "]", "retell-outbound request");
  
  // CORS helper (per request)
  const allow = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get("Origin") ?? "";
  const isAllowed = allow.includes(origin);
  const cors = {
    "Access-Control-Allow-Origin": isAllowed ? origin : "null",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  
  // Handle /health for health checks
  if (new URL(req.url).pathname.endsWith('/health')) {
    const apiKey = Deno.env.get("RETELL_API_KEY");
    const phoneUrl = Deno.env.get("RETELL_PHONE_CREATE_URL");
    const webUrl = Deno.env.get("RETELL_WEB_CREATE_URL");
    
    const url = new URL(req.url);
    const agent = url.searchParams.get("agent");
    let agentMapped = false;
    
    if (agent) {
      const up = agent.toUpperCase();
      const agentId = Deno.env.get(`AGENT_${up}_ID`);
      agentMapped = !!agentId;
    }
    
    return new Response(JSON.stringify({
      hasApiKey: !!apiKey,
      hasPhoneUrl: !!phoneUrl,
      hasWebUrl: !!webUrl,
      agentMapped,
      traceId
    }), { 
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
  
  // Handle /ping for external egress test
  if (new URL(req.url).pathname.endsWith('/ping')) {
    try {
      await fetch('https://dns.google/resolve?name=api.retellai.com');
      return new Response(JSON.stringify({
        egress: true,
        traceId
      }), { 
        headers: { ...cors, "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        egress: false,
        traceId
      }), { 
        status: 502, 
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
  }
  
  // Only POST allowed for main functionality
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'METHOD_NOT_ALLOWED', traceId }),
      { status: 405, headers: cors }
    );
  }
  
  try {
    // Read environment variables inside the request handler
    const apiKey = Deno.env.get("RETELL_API_KEY");
    const phoneUrl = Deno.env.get("RETELL_PHONE_CREATE_URL") ?? "https://api.retellai.com/v2/create-phone-call";
    
    console.log(`[${traceId}] Environment check: API Key exists: ${!!apiKey}, Phone URL: ${phoneUrl}`);
    
    // Parse request body with error handling
    const body = await req.json().catch(() => ({}));
    const agentSlug = (body.agentSlug ?? body.slug ?? "").toString().trim();
    const toNumber = body.toNumber;
    
    console.log(`[${traceId}] Request parsed: agentSlug=${agentSlug}, toNumber=${toNumber ? toNumber.substring(0, 6) + '***' : 'undefined'}`);
    
    // Validate required fields
    if (!apiKey) {
      console.error(`[${traceId}] Missing RETELL_API_KEY`);
      return new Response(JSON.stringify({
        error: "MISCONFIG",
        missing: ["RETELL_API_KEY"],
        traceId
      }), { 
        status: 500, 
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
    
    if (!agentSlug) {
      return new Response(JSON.stringify({
        error: "INVALID_INPUT",
        details: "Unknown or missing agentSlug",
        traceId
      }), { 
        status: 400, 
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
    
    // Validate phone number format (E.164)
    if (!toNumber || !toNumber.match(/^\+[1-9]\d{7,14}$/)) {
      return new Response(JSON.stringify({
        error: "INVALID_INPUT",
        details: "toNumber must be in E.164 (+1234567890)",
        traceId
      }), { 
        status: 400, 
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
    
    // Agent resolution
    const up = agentSlug.toUpperCase();
    const agentId = Deno.env.get(`AGENT_${up}_ID`) ?? null;
    const fromNumber = Deno.env.get(`AGENT_${up}_FROM`) ?? Deno.env.get("RETELL_FROM_NUMBER") ?? null;
    
    console.log(`[${traceId}] Agent resolution: slug=${agentSlug}, agentId exists: ${!!agentId}, fromNumber exists: ${!!fromNumber}`);
    
    // Check for missing agent configuration
    if (!agentId) {
      console.error(`[${traceId}] Missing agent ID for ${agentSlug} (looked for AGENT_${up}_ID)`);
      return new Response(JSON.stringify({
        error: "INVALID_INPUT",
        details: "Unknown or missing agentSlug",
        traceId
      }), { 
        status: 400, 
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
    
    if (!fromNumber) {
      console.error(`[${traceId}] Missing from number for ${agentSlug} (looked for AGENT_${up}_FROM or RETELL_FROM_NUMBER)`);
      return new Response(JSON.stringify({
        error: "MISCONFIG",
        missing: ["AGENT_*_FROM or RETELL_FROM_NUMBER"],
        traceId
      }), { 
        status: 500, 
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
    
    console.log(`[${traceId}] Creating outbound call for agent ${agentSlug} to ${toNumber.substring(0, 6)}***`);
    
    // Call Retell API
    const res = await fetch(phoneUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from_number: fromNumber, to_number: toNumber, agent_id: agentId }),
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error("[", traceId, "] Retell upstream", res.status, text.slice(0, 200));
      return new Response(JSON.stringify({
        error: "UPSTREAM_RETELL_ERROR",
        status: res.status,
        hint: "Check RETELL_API_KEY / from_number / agent binding / destination permissions.",
        traceId,
      }), { 
        status: 502, 
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
    
    const retellData = await res.json();
    
    console.log(`[${traceId}] Outbound call created successfully for agent: ${agentSlug}`);
    
    return new Response(JSON.stringify({
      status: "queued",
      data: retellData,
      traceId
    }), { 
      headers: { ...cors, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error(`[${traceId}] Error in retell-outbound function: ${error.message}`);
    console.error(`[${traceId}] Error stack: ${error.stack}`);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      traceId
    }), { 
      status: 500, 
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});