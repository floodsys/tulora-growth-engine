import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const corsHeaders = { ...getCorsHeaders(req), 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cookie', 'Access-Control-Allow-Credentials': 'true' };
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
        valid: false,
        reason: 'No authorization header'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Vary": "Cookie, Authorization"
        },
        status: 200,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Use service role to verify the JWT token
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      console.log('Auth error details:', userError);
      return new Response(JSON.stringify({
        valid: false,
        reason: `Authentication error: ${userError?.message || 'User not found'}`
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Vary": "Cookie, Authorization"
        },
        status: 200,
      });
    }

    const user = userData.user;

    // Check if user is superadmin
    const { data: isSuperadmin, error: superadminError } = await supabaseClient.rpc('is_superadmin', { user_id: user.id });
    if (superadminError || !isSuperadmin) {
      return new Response(JSON.stringify({
        valid: false,
        reason: 'Unauthorized: Superadmin access required'
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Vary": "Cookie, Authorization"
        },
        status: 200,
      });
    }

    // Parse cookies
    const cookieHeader = req.headers.get('Cookie');
    const cookies = new Map();
    
    console.log('Received cookie header:', cookieHeader);
    
    if (cookieHeader) {
      cookieHeader.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookies.set(name, value);
          console.log('Parsed cookie:', name, '=', value);
        }
      });
    }

    const saIssued = cookies.get('sa_issued');
    console.log('Looking for sa_issued cookie, found:', saIssued);
    
    if (!saIssued) {
      console.log('No sa_issued cookie found, available cookies:', Array.from(cookies.keys()));
      return new Response(JSON.stringify({
        valid: false,
        reason: 'No elevated session cookie found',
        cookie_present: false,
        debug_cookies: Array.from(cookies.keys())
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Vary": "Cookie, Authorization"
        },
        status: 200,
      });
    }

    const [issuedAtStr, cookieUserId] = saIssued.split(':');
    
    if (cookieUserId !== user.id) {
      return new Response(JSON.stringify({
        valid: false,
        reason: 'Session user mismatch',
        cookie_present: true
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Vary": "Cookie, Authorization"
        },
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
      reason: valid ? 'Valid session' : 'Session expired',
      cookie_present: true
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Vary": "Cookie, Authorization"
      },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      valid: false,
      reason: 'Validation failed',
      error: errorMessage,
      cookie_present: false
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Vary": "Cookie, Authorization"
      },
      status: 500,
    });
  }
});