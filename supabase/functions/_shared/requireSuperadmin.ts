import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

export interface SuperadminGuardResult {
  ok: boolean;
  user?: any;
  response?: Response;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Validates if the requesting user is a superadmin.
 * Returns authentication and authorization errors with proper CORS headers.
 * Logs denial attempts to audit sink when available.
 */
export async function requireSuperadmin(req: Request, endpoint?: string): Promise<SuperadminGuardResult> {
  const requestUrl = new URL(req.url);
  const endpointName = endpoint || requestUrl.pathname.split('/').pop() || 'unknown';
  
  try {
    // Create user Supabase client for authorization checks (NOT service role)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      // Log unauthenticated attempt with service role client for logging
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );
      
      await logDenialAttempt(serviceClient, {
        endpoint: endpointName,
        user_id: null,
        reason: 'unauthenticated',
        ts: new Date().toISOString()
      });

      return {
        ok: false,
        response: new Response(JSON.stringify({
          error: 'Authentication required'
        }), {
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "WWW-Authenticate": "Bearer realm=\"admin\""
          },
          status: 401,
        })
      };
    }

    // Create user client for authorization check (preserves user context)
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Extract token and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      // Log unauthenticated attempt (invalid token) with service client
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );
      
      await logDenialAttempt(serviceClient, {
        endpoint: endpointName,
        user_id: null,
        reason: 'unauthenticated',
        ts: new Date().toISOString()
      });

      return {
        ok: false,
        response: new Response(JSON.stringify({
          error: 'Authentication required'
        }), {
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "WWW-Authenticate": "Bearer realm=\"admin\""
          },
          status: 401,
        })
      };
    }

    const user = userData.user;

    // Check if user is superadmin using USER context (not service role)
    const { data: isSuperadmin, error: superadminError } = await userClient.rpc('is_superadmin', { user_id: user.id });
    
    if (superadminError || !isSuperadmin) {
      console.error('Superadmin check failed:', { error: superadminError, isSuperadmin, userId: user.id });
      
      // Log non-superadmin attempt with service client
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );
      
      await logDenialAttempt(serviceClient, {
        endpoint: endpointName,
        user_id: user.id,
        reason: 'not_superadmin',
        ts: new Date().toISOString()
      });

      return {
        ok: false,
        response: new Response(JSON.stringify({
          error: 'Superadmin access required'
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        })
      };
    }

    // Success - user is authenticated and is a superadmin
    return {
      ok: true,
      user
    };

  } catch (error) {
    console.error('Error in superadmin guard:', error);
    return {
      ok: false,
      response: new Response(JSON.stringify({
        error: 'Internal server error'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      })
    };
  }
}

/**
 * Logs denial attempts to audit sink for security monitoring
 */
async function logDenialAttempt(
  supabase: any,
  details: {
    endpoint: string;
    user_id: string | null;
    reason: string;
    ts: string;
  }
) {
  try {
    // Insert into audit_log table if it exists
    await supabase.from('audit_log').insert({
      organization_id: '00000000-0000-0000-0000-000000000000', // System-level event
      actor_user_id: details.user_id,
      actor_role_snapshot: 'unknown',
      action: 'admin.access_denied',
      target_type: 'endpoint',
      target_id: details.endpoint,
      status: 'error',
      error_code: details.reason,
      channel: 'security',
      metadata: {
        endpoint: details.endpoint,
        denial_reason: details.reason,
        timestamp: details.ts,
        security_event: true
      }
    });
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.warn('Failed to log denial attempt:', error);
  }
}