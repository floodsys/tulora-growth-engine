import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Get allowed origins from environment
const corsAllowedOrigins = Deno.env.get('CORS_ALLOWED_ORIGINS');
const allowedOrigins = corsAllowedOrigins 
  ? corsAllowedOrigins.split(',').map(origin => origin.trim())
  : ['*']; // Fallback to wildcard in dev

// Always allow Lovable preview domains in addition to configured origins
const lovablePreviewPattern = /^https:\/\/[a-zA-Z0-9-]+\.(lovable\.app|sandbox\.lovable\.dev)$/;
const isLovablePreview = (origin: string) => {
  const result = lovablePreviewPattern.test(origin);
  console.log(`[DEBUG] Testing origin: ${origin}, matches: ${result}`);
  return result;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Will be overridden per request
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowedOrigin = origin && (
    allowedOrigins.includes('*') || 
    allowedOrigins.includes(origin) || 
    isLovablePreview(origin)
  );
  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': isAllowedOrigin ? (allowedOrigins.includes('*') ? '*' : origin) : 'null',
  };
}

interface WebCallRequest {
  agentSlug: string;
}

interface RetellWebCallRequest {
  agent_id?: string;
}

serve(async (req) => {
  const traceId = generateTraceId();
  const origin = req.headers.get('origin');
  const responseCorsHeaders = getCorsHeaders(origin);

  // Environment variable guards - check required secrets
  const retellApiKey = Deno.env.get('RETELL_API_KEY');
  const retellWebCreateUrl = Deno.env.get('RETELL_WEB_CREATE_URL');
  
  if (!retellApiKey) {
    return new Response(
      JSON.stringify({ error: 'MISCONFIG: missing RETELL_API_KEY', traceId }),
      { 
        status: 500, 
        headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  if (!retellWebCreateUrl) {
    return new Response(
      JSON.stringify({ error: 'MISCONFIG: missing RETELL_WEB_CREATE_URL', traceId }),
      { 
        status: 500, 
        headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseCorsHeaders });
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
  if (origin && !allowedOrigins.includes('*') && !allowedOrigins.includes(origin) && !isLovablePreview(origin)) {
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
    const body: WebCallRequest = await req.json();
    
    if (!body.agentSlug) {
      console.log(`[${traceId}] Missing required field: agentSlug`);
      return new Response(
        JSON.stringify({ error: 'Missing required field: agentSlug', traceId }),
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

    // Environment variables already validated at function start

    // Determine agent_id based on agent slug
    const agentSlugUpper = body.agentSlug.toUpperCase();
    const agentId = Deno.env.get(`AGENT_${agentSlugUpper}_ID`);

    // agent_id is now required
    if (!agentId) {
      console.log(`[${traceId}] Unknown agentSlug or AGENT_*_ID not set: ${body.agentSlug}`);
      return new Response(
        JSON.stringify({ 
          error: 'Unknown agentSlug or AGENT_*_ID not set', 
          slug: body.agentSlug,
          traceId 
        }),
        { 
          status: 400, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prepare Retell API call payload
    const retellPayload: RetellWebCallRequest = {
      agent_id: agentId,
    };

    console.log(`[${traceId}] Creating web call for agent ${body.agentSlug}`);

    // Call Retell API
    const retellResponse = await fetch(retellWebCreateUrl, {
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
        JSON.stringify({ 
          error: 'UPSTREAM_RETELL_ERROR',
          status: retellResponse.status,
          hint: 'Check API key / payload / IDs / phone number.',
          traceId 
        }),
        { 
          status: 502, 
          headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const retellData = await retellResponse.json();
    
    console.log(`[${traceId}] Web call created successfully for agent: ${body.agentSlug}`);

    // Return the exact data from Retell for client initialization
    return new Response(
      JSON.stringify({ ...retellData, traceId }),
      {
        headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error(`[${traceId}] Error in retell-webcall-create function: ${error.message}`);
    return new Response(
      JSON.stringify({ error: 'Internal server error', traceId }),
      {
        status: 500,
        headers: { ...responseCorsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});