import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Credentials': 'true',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid authentication'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const user = userData.user;

    // Check if user is superadmin
    const { data: isSuperadmin, error: superadminError } = await supabaseClient.rpc('is_superadmin', { user_id: user.id });
    
    if (superadminError || !isSuperadmin) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Superadmin access required'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Set elevated admin session cookie
    const issuedAt = new Date().toISOString();
    const maxAge = 43200; // 12 hours in seconds
    const cookieValue = `${issuedAt}:${user.id}`;
    
    // Get the request URL to determine domain
    const url = new URL(req.url);
    const host = url.hostname;
    
    // Environment-aware domain detection
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const isProd = host.includes('tulora.io');
    const isPreview = host.includes('lovable.app') || host.includes('sandbox.lovable.dev');
    
    let domain;
    if (isLocalhost) {
      domain = undefined; // Host-only for localhost
    } else if (isProd) {
      domain = '.tulora.io';
    } else if (isPreview) {
      domain = undefined; // Use host-only for sandbox domains
    } else {
      domain = undefined; // Fallback to host-only
    }
    
    const cookieOptions = [
      `Max-Age=${maxAge}`,
      'HttpOnly',
      !isLocalhost ? 'Secure' : undefined,
      'SameSite=Lax',
      'Path=/',
      domain ? `Domain=${domain}` : undefined
    ].filter(Boolean).join('; ');

    const headers = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Set-Cookie': `sa_issued=${cookieValue}; ${cookieOptions}`,
      'Cache-Control': 'no-store',
    };

    console.log('Setting cookie with value:', cookieValue);
    console.log('Cookie options:', cookieOptions);
    console.log('Full Set-Cookie header:', `sa_issued=${cookieValue}; ${cookieOptions}`);

    return new Response(JSON.stringify({
      success: true,
      issued_at: issuedAt,
      expires_at: new Date(Date.now() + maxAge * 1000).toISOString(),
      cookie_set: true,
      environment: isProd ? 'production' : (isPreview ? 'preview' : 'localhost'),
      user_id: user.id,
      debug_cookie: cookieValue,
      debug_options: cookieOptions
    }), {
      headers,
      status: 200,
    });

  } catch (error) {
    console.error('Step-up test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});