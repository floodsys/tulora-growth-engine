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

    // Only allow in preview environment
    const host = req.headers.get('host') || '';
    if (!host.includes('lovable.app')) {
      return new Response(JSON.stringify({
        error: 'Test endpoint only available in preview environment'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Check if user is superadmin
    const { data: isSuperadmin, error: superadminError } = await supabaseClient.rpc('is_superadmin', { user_id: user.id });
    if (superadminError || !isSuperadmin) {
      throw new Error("Unauthorized: Superadmin access required");
    }

    // Rate limiting check (simple in-memory for test endpoint)
    const rateLimitKey = `test_step_up_${user.id}`;
    
    // Set elevated admin session cookie (same as real step-up)
    const issuedAt = new Date().toISOString();
    const maxAge = 43200; // 12 hours
    const cookieValue = `${issuedAt}:${user.id}`;
    
    // Environment-aware domain
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const domain = isLocalhost ? undefined : '.lovable.app';
    
    // Clear any old cookies first
    const clearOldCookies = [
      `sa_issued=; Max-Age=0; Path=/admin; ${domain ? `Domain=${domain}; ` : ''}HttpOnly`,
      `sa_issued=; Max-Age=0; Path=/; ${domain ? `Domain=${domain}; ` : ''}HttpOnly`,
      `sa_issued=; Max-Age=0; Path=/; HttpOnly`,
      `sa_issued=; Max-Age=0; Path=/admin; HttpOnly`
    ];
    
    const cookieOptions = [
      `Max-Age=${maxAge}`,
      'HttpOnly',
      isLocalhost ? undefined : 'Secure',
      'SameSite=Lax',
      'Path=/',
      domain ? `Domain=${domain}` : undefined
    ].filter(Boolean).join('; ');

    // Log usage
    await supabaseClient
      .from('audit_log')
      .insert({
        organization_id: '00000000-0000-0000-0000-000000000000',
        actor_user_id: user.id,
        actor_role_snapshot: 'superadmin',
        action: 'admin.test_step_up',
        target_type: 'test_endpoint',
        target_id: 'admin-step-up-test',
        status: 'success',
        channel: 'audit',
        metadata: {
          test_mode: true,
          environment: 'preview',
          host: host,
          cookie_domain: domain || 'host-only',
          timestamp: new Date().toISOString()
        }
      });

    return new Response(JSON.stringify({
      ok: true,
      test_mode: true,
      issued_at: issuedAt,
      expires_at: new Date(Date.now() + maxAge * 1000).toISOString(),
      cookie_attributes: {
        domain: domain || 'host-only',
        path: '/',
        sameSite: 'Lax',
        secure: !isLocalhost,
        httpOnly: true,
        environment: 'preview'
      }
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Set-Cookie": [
          ...clearOldCookies,
          `sa_issued=${cookieValue}; ${cookieOptions}`
        ].join(', ')
      },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});