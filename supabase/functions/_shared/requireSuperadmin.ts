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
 */
export async function requireSuperadmin(req: Request): Promise<SuperadminGuardResult> {
  try {
    // Check for authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
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

    // Create Supabase client with service role key for admin operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Extract token and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      return {
        ok: false,
        response: new Response(JSON.stringify({
          error: 'Invalid authentication'
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

    // Check if user is superadmin
    const { data: isSuperadmin, error: superadminError } = await supabaseClient.rpc('is_superadmin', { user_id: user.id });
    
    if (superadminError || !isSuperadmin) {
      console.error('Superadmin check failed:', { error: superadminError, isSuperadmin, userId: user.id });
      
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