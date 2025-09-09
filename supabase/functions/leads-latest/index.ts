import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const VERSION = "2025-09-09-1";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', version: VERSION }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Query the last 25 leads
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, created_at, email, first_name, last_name')
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Database query failed', 
          details: error.message,
          version: VERSION 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        leads: leads || [], 
        count: leads?.length || 0,
        version: VERSION 
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: (error as Error).message,
        version: VERSION 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});