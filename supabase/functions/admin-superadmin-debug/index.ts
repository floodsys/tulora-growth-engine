import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Superadmin authorization gate (anon-key + user JWT) ──
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    }
  );

  const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !authUser) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: isSuperadmin, error: superadminError } = await supabaseClient.rpc('is_superadmin');
  if (superadminError || !isSuperadmin) {
    console.error('Superadmin check failed:', { error: superadminError, isSuperadmin, userId: authUser.id });
    return new Response(JSON.stringify({ error: 'Superadmin access required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const user = authUser;

  try {
    // Re-use the already-created user client for fresh user data
    const userClient = supabaseClient;

    // Create service client to check superadmins table
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get fresh user data
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('Failed to get user data');
    }

    const currentUser = userData.user;

    // Check if user exists in superadmins table
    const { data: superadminRow, error: superadminError } = await serviceClient
      .from('superadmins')
      .select('user_id, created_at, added_by')
      .eq('user_id', currentUser.id)
      .single();

    // Get environment info
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "NOT_SET";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "NOT_SET";

    // Mask most of the anon key for security, show first/last few chars
    const maskedAnonKey = anonKey.length > 20
      ? `${anonKey.substring(0, 8)}...${anonKey.substring(anonKey.length - 8)}`
      : anonKey;

    const debugInfo = {
      timestamp: new Date().toISOString(),
      current_user: {
        id: currentUser.id,
        email: currentUser.email,
        created_at: currentUser.created_at,
        last_sign_in_at: currentUser.last_sign_in_at
      },
      superadmin_check: {
        exists_in_table: !superadminError && superadminRow !== null,
        row_data: superadminRow || null,
        error: superadminError?.message || null
      },
      environment: {
        supabase_url: supabaseUrl,
        anon_key_masked: maskedAnonKey,
        is_localhost: supabaseUrl.includes('localhost'),
        is_staging: supabaseUrl.includes('staging'),
        is_production: !supabaseUrl.includes('localhost') && !supabaseUrl.includes('staging')
      }
    };

    // Generate SQL if missing from superadmins table
    let insertSQL = null;
    if (superadminError || !superadminRow) {
      insertSQL = `INSERT INTO public.superadmins (user_id) VALUES ('${currentUser.id}');`;
    }

    console.log('🔐 SUPERADMIN DEBUG LOG:', JSON.stringify(debugInfo, null, 2));
    if (insertSQL) {
      console.log('🚨 MISSING SUPERADMIN ROW - SQL TO RUN:', insertSQL);
    }

    return new Response(JSON.stringify({
      debug_info: debugInfo,
      insert_sql: insertSQL,
      status: insertSQL ? 'missing_superadmin_row' : 'superadmin_verified'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Superadmin debug error:', error);
    return new Response(JSON.stringify({
      error: 'Debug failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});