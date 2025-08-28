import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebCallRequest {
  agentSlug: string;
}

interface RetellWebCallRequest {
  agent_id?: string;
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
    // Validate content type
    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse and validate request body
    const body: WebCallRequest = await req.json();
    
    if (!body.agentSlug) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: agentSlug' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate agent slug
    const validSlugs = ['paul', 'laura', 'jessica'];
    if (!validSlugs.includes(body.agentSlug.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Invalid agentSlug. Must be one of: paul, laura, jessica' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get environment variables
    const retellApiKey = Deno.env.get('RETELL_API_KEY');
    const retellWebCreateUrl = Deno.env.get('RETELL_WEB_CREATE_URL');
    
    if (!retellApiKey) {
      console.error('RETELL_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!retellWebCreateUrl) {
      console.error('RETELL_WEB_CREATE_URL not configured');
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Determine agent_id based on agent slug
    const agentSlugUpper = body.agentSlug.toUpperCase();
    const agentId = Deno.env.get(`AGENT_${agentSlugUpper}_ID`);

    // Prepare Retell API call payload
    const retellPayload: RetellWebCallRequest = {};

    // Only include agent_id if it's configured
    if (agentId) {
      retellPayload.agent_id = agentId;
    }

    console.log(`Creating web call for agent ${body.agentSlug}`);

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
      console.error('Retell API error:', retellResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to create web call' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const retellData = await retellResponse.json();
    
    console.log('Web call created successfully for agent:', body.agentSlug);

    // Return the exact data from Retell for client initialization
    return new Response(
      JSON.stringify(retellData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in retell-webcall-create function:', error.message);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});