import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkUsageQuota } from '../_shared/billingUsage.ts'
import { checkAgentForCalls, createAgentStatusErrorResponse } from '../_shared/agentStatus.ts'

interface WebCallRequest {
  agentSlug: string;
}

interface RetellWebCallRequest {
  agent_id: string;
}

serve(async (req) => {
  // Trace ID on every request
  const traceId = `trace_${Date.now()}_${crypto.randomUUID().slice(0,10)}`;
  console.log("[", traceId, "]", "retell-webcall-create request");
  
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
    const { getOptionalEnv } = await import('../_shared/env.ts')
    const apiKey = getOptionalEnv("RETELL_API_KEY");
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
  
  // Validate method first
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      error: "METHOD_NOT_ALLOWED",
      traceId
    }), { 
      status: 405, 
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
  
  try {
    // Read environment variables inside the request handler
    const { RETELL_API_KEY } = await import('../_shared/env.ts')
    const apiKey = RETELL_API_KEY();
    const webUrl = Deno.env.get("RETELL_WEB_CREATE_URL") ?? "https://api.retellai.com/v2/create-web-call";
    
    console.log(`[${traceId}] Environment check: API Key exists: ${!!apiKey}, Web URL: ${webUrl}`);
    
    // Parse request body with error handling
    const body = await req.json().catch(() => ({}));
    const agentSlug = (body.agentSlug ?? body.slug ?? "").toString().trim();
    
    console.log(`[${traceId}] Request parsed: agentSlug=${agentSlug}`);
    
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
    
    // Agent resolution
    const up = agentSlug.toUpperCase();
    const agentId = Deno.env.get(`AGENT_${up}_ID`) ?? null;
    
    console.log(`[${traceId}] Agent resolution: slug=${agentSlug}, agentId exists: ${!!agentId}`);
    
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
    
    console.log(`[${traceId}] Creating web call for agent ${agentSlug} using URL: ${webUrl}`);
    
    // Look up organization from agent to check quota and status
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // AGENT STATUS CHECK: Only ACTIVE agents can receive production calls
    const agentStatusCheck = await checkAgentForCalls(supabaseAdmin, agentId, traceId)
    
    if (!agentStatusCheck.allowed) {
      console.log(`[${traceId}] Agent status check failed: ${agentStatusCheck.error?.message}`)
      return createAgentStatusErrorResponse(agentStatusCheck, cors, traceId)
    }
    
    const agentData = agentStatusCheck.agent
    
    if (agentData?.organization_id) {
      // Check usage quota before initiating call
      const quotaResult = await checkUsageQuota(
        supabaseAdmin,
        agentData.organization_id,
        'calls',
        traceId
      )

      if (!quotaResult.allowed && quotaResult.reason === 'over_limit') {
        console.log(`[${traceId}] Blocked webcall for org ${agentData.organization_id}: quota exceeded (${quotaResult.current}/${quotaResult.limit})`)
        return new Response(JSON.stringify({
          status: 402,
          code: 'BILLING_OVER_LIMIT',
          metric: 'calls',
          remaining: 0,
          limit: quotaResult.limit,
          current: quotaResult.current,
          message: 'Monthly call limit exceeded.',
          traceId
        }), { 
          status: 402, 
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }
    }
    
    // Call Retell API
    const res = await fetch(webUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId }),
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
    
    console.log(`[${traceId}] Web call created successfully for agent: ${agentSlug}`);
    
    return new Response(JSON.stringify({
      ...retellData,
      traceId
    }), { 
      headers: { ...cors, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error(`[${traceId}] Error in retell-webcall-create function: ${error.message}`);
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
