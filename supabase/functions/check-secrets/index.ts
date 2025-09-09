import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const route = new URL(req.url).pathname;
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    console.log(JSON.stringify({ route, method: req.method, status: 405, error: "Method not allowed" }));
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    // Verify JWT (authenticated users only)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log(JSON.stringify({ route, status: 401, error: "Missing authorization header" }));
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Use ANON client with user's auth header
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { 
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Get user data to verify authentication
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.log(JSON.stringify({ route, status: 401, error: "Invalid or expired token" }));
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Check environment variables (never throw)
    const HAS_RESEND_API_KEY = Boolean(Deno.env.get('RESEND_API_KEY'));
    const NOTIFICATIONS_FROM = Deno.env.get('NOTIFICATIONS_FROM') || "";
    const HELLO_INBOX = Deno.env.get('HELLO_INBOX') || "";
    const ENTERPRISE_INBOX = Deno.env.get('ENTERPRISE_INBOX') || "";
    const SALES_INBOX = Deno.env.get('SALES_INBOX') || "";

    const result = {
      HAS_RESEND_API_KEY,
      NOTIFICATIONS_FROM,
      HELLO_INBOX,
      ENTERPRISE_INBOX,
      SALES_INBOX
    };

    console.log(JSON.stringify({ route, status: 200 }));
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    // Never throw - always return 200 with error info if needed
    console.log(JSON.stringify({ route, status: 200, error: error.message }));
    
    return new Response(JSON.stringify({
      HAS_RESEND_API_KEY: false,
      NOTIFICATIONS_FROM: "",
      HELLO_INBOX: "",
      ENTERPRISE_INBOX: "",
      SALES_INBOX: ""
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});