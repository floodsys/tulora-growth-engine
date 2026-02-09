import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Method guard - only allow GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Check for debug key
  const debugKey = req.headers.get('x-debug-key');
  const expectedKey = Deno.env.get('VOICE_DEBUG_KEY');
  
  if (!expectedKey) {
    return new Response(
      JSON.stringify({ error: 'MISCONFIG: missing VOICE_DEBUG_KEY' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  if (!debugKey || debugKey !== expectedKey) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Check environment variables presence (boolean only)
  const healthCheck = {
    retell: {
      apiKey: Boolean((await import('../_shared/env.ts')).getOptionalEnv('RETELL_API_KEY')),
      phoneUrl: Boolean(Deno.env.get('RETELL_PHONE_CREATE_URL')),
      webUrl: Boolean(Deno.env.get('RETELL_WEB_CREATE_URL')),
      fromNumber: Boolean(Deno.env.get('RETELL_FROM_NUMBER'))
    },
    booking: {
      enabled: false,
      note: "Booking integration disabled for demo"
    }
  };

  return new Response(
    JSON.stringify(healthCheck),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});