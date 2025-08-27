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

    const body = await req.json();
    const { action } = body;

    if (action === 'verify_step_up') {
      // For now, we'll simulate step-up verification
      // In a real implementation, this would verify MFA/additional auth factors
      
      // Set elevated admin session cookie
      const issuedAt = new Date().toISOString();
      const maxAge = 43200; // 12 hours in seconds
      
      const cookieValue = `${issuedAt}:${user.id}`;
      
      // Environment-aware domain and security settings
      const host = req.headers.get('host') || '';
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
      
      // Set domain based on environment
      let domain;
      if (isLocalhost) {
        domain = undefined; // No domain for localhost
      } else if (host.includes('lovable.app')) {
        domain = '.lovable.app'; // Preview environment
      } else if (host.includes('tulora.io')) {
        domain = '.tulora.io'; // Production environment
      } else {
        domain = `.${host.replace(/^www\./, '')}`; // Fallback
      }
      
      // Clear any old cookies with different paths/domains first
      const clearOldCookies = [
        `sa_issued=; Max-Age=0; Path=/admin; ${domain ? `Domain=${domain}; ` : ''}HttpOnly`,
        `sa_issued=; Max-Age=0; Path=/; ${domain ? `Domain=${domain}; ` : ''}HttpOnly`,
        // Clear any legacy cookies without domain
        `sa_issued=; Max-Age=0; Path=/; HttpOnly`,
        `sa_issued=; Max-Age=0; Path=/admin; HttpOnly`
      ];
      
      const cookieOptions = [
        `Max-Age=${maxAge}`,
        'HttpOnly',
        isLocalhost ? undefined : 'Secure',
        'SameSite=Lax',
        'Path=/', // Broad scope for all admin routes
        domain ? `Domain=${domain}` : undefined
      ].filter(Boolean).join('; ');

      const response = new Response(JSON.stringify({
        success: true,
        issued_at: issuedAt,
        expires_at: new Date(Date.now() + maxAge * 1000).toISOString(),
        max_age_seconds: maxAge,
        cookie_attributes: {
          domain: domain || 'host-only',
          path: '/',
          sameSite: 'Lax',
          secure: !isLocalhost,
          httpOnly: true,
          environment: isLocalhost ? 'localhost' : (host.includes('lovable.app') ? 'preview' : 'production')
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

      return response;
    }

    if (action === 'check_session') {
      const cookieHeader = req.headers.get('Cookie');
      const cookies = new Map();
      
      if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
          const [name, value] = cookie.trim().split('=');
          if (name && value) cookies.set(name, value);
        });
      }

      const saIssued = cookies.get('sa_issued');
      
      if (!saIssued) {
        return new Response(JSON.stringify({
          valid: false,
          reason: 'No elevated session cookie found'
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const [issuedAtStr, cookieUserId] = saIssued.split(':');
      
      if (cookieUserId !== user.id) {
        return new Response(JSON.stringify({
          valid: false,
          reason: 'Session user mismatch'
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const issuedAt = new Date(issuedAtStr);
      const now = new Date();
      const ageMinutes = Math.floor((now.getTime() - issuedAt.getTime()) / (1000 * 60));
      const maxAgeMinutes = 720; // 12 hours
      
      const valid = ageMinutes <= maxAgeMinutes;

      return new Response(JSON.stringify({
        valid,
        issued_at: issuedAtStr,
        age_minutes: ageMinutes,
        max_age_minutes: maxAgeMinutes,
        ttl_minutes: Math.max(0, maxAgeMinutes - ageMinutes),
        reason: valid ? 'Valid session' : 'Session expired'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === 'clear_session') {
      const response = new Response(JSON.stringify({
        success: true,
        message: 'Admin session cleared'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Set-Cookie": [
            `sa_issued=; Max-Age=0; Path=/; ${domain ? `Domain=${domain}; ` : ''}HttpOnly; ${isLocalhost ? '' : 'Secure; '}SameSite=Lax`,
            `sa_issued=; Max-Age=0; Path=/; HttpOnly; ${isLocalhost ? '' : 'Secure; '}SameSite=Lax`
          ].join(', ')
        },
        status: 200,
      });

      return response;
    }

    throw new Error("Invalid action");

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});