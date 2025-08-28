import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const body: OutboundCallRequest = await req.json();
    
    if (!body.agentSlug || !body.toNumber) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: agentSlug, toNumber' }),
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

    // Validate phone number format
    if (!body.toNumber.match(/^\+\d{10,15}$/)) {
      return new Response(
        JSON.stringify({ error: 'Invalid toNumber format. Must be E.164 format (+1234567890)' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get environment variables
    const retellApiKey = Deno.env.get('RETELL_API_KEY');
    const retellPhoneCreateUrl = Deno.env.get('RETELL_PHONE_CREATE_URL');
    
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

    if (!retellPhoneCreateUrl) {
      console.error('RETELL_PHONE_CREATE_URL not configured');
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
      console.error('No from_number available for agent:', body.agentSlug);
      return new Response(
        JSON.stringify({ error: 'No phone number configured for this agent' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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

    console.log(`Creating outbound call for agent ${body.agentSlug} to ${body.toNumber}`);

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
      console.error('Retell API error:', retellResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to create outbound call' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const retellData = await retellResponse.json();
    
    console.log('Outbound call created successfully for agent:', body.agentSlug);

    return new Response(
      JSON.stringify({
        status: 'queued',
        data: retellData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in retell-outbound function:', error.message);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});