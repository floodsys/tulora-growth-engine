import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'X-Function, X-Version',
};

interface RequestBody {
  orgId: string;
  planKey: 'pro' | 'business' | 'trial';
  manual: {
    active: boolean;
    ends_at?: string;
    notes?: string;
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // ── Superadmin authorization gate (anon-key + user JWT) ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );

    const { data: { user: authUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !authUser) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: isSuperadmin, error: superadminError } = await supabaseClient.rpc('is_superadmin');
    if (superadminError || !isSuperadmin) {
      console.error('Superadmin check failed:', { error: superadminError, isSuperadmin, userId: authUser.id });
      return new Response(JSON.stringify({ error: 'Superadmin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const user = authUser;

    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse and validate request body
    let requestBody: RequestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { orgId, planKey, manual } = requestBody;

    // Validate required fields
    if (!orgId || !planKey || typeof manual !== 'object') {
      return new Response(JSON.stringify({
        error: 'Missing required fields: orgId, planKey, manual'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate planKey
    if (!['pro', 'business', 'trial'].includes(planKey)) {
      return new Response(JSON.stringify({
        error: 'planKey must be one of: pro, business, trial'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create service role client for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    let updateResult;
    let auditMetadata;

    if (manual.active === true) {
      // Calculate ends_at if not provided (90 days from now)
      const endsAt = manual.ends_at || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      // Activate manual access
      const manualActivationData = {
        active: true,
        ends_at: endsAt,
        notes: manual.notes || '',
        set_by: user.id,
        set_at: new Date().toISOString()
      };

      // First get current entitlements
      const { data: currentOrg } = await supabase
        .from('organizations')
        .select('entitlements')
        .eq('id', orgId)
        .single();

      const currentEntitlements = currentOrg?.entitlements || {};
      const updatedEntitlements = {
        ...currentEntitlements,
        manual_activation: manualActivationData
      };

      const { data, error } = await supabase
        .from('organizations')
        .update({
          plan_key: planKey,
          billing_status: 'active',
          entitlements: updatedEntitlements
        })
        .eq('id', orgId)
        .select()
        .single();

      if (error) {
        console.error('Database update error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to update organization',
          details: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      updateResult = data;
      auditMetadata = {
        plan_key: planKey,
        manual: manualActivationData,
        ends_at: endsAt,
        notes: manual.notes || '',
        actor: user.id
      };

    } else {
      // Deactivate manual access
      // First get current entitlements
      const { data: currentOrg } = await supabase
        .from('organizations')
        .select('entitlements')
        .eq('id', orgId)
        .single();

      const currentEntitlements = currentOrg?.entitlements || {};
      const { manual_activation, ...remainingEntitlements } = currentEntitlements;

      const { data, error } = await supabase
        .from('organizations')
        .update({
          billing_status: 'trialing',
          plan_key: 'trial',
          entitlements: remainingEntitlements
        })
        .eq('id', orgId)
        .select()
        .single();

      if (error) {
        console.error('Database update error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to update organization',
          details: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      updateResult = data;
      auditMetadata = {
        plan_key: 'trial',
        manual: { active: false },
        actor: user.id
      };
    }

    // Log audit event
    try {
      await supabase.rpc('log_event', {
        p_org_id: orgId,
        p_actor_user_id: user.id,
        p_actor_role_snapshot: 'superadmin',
        p_action: 'admin.manual_access.set',
        p_target_type: 'organization',
        p_target_id: orgId,
        p_status: 'success',
        p_channel: 'audit',
        p_metadata: auditMetadata
      });
    } catch (auditError) {
      console.warn('Failed to log audit event:', auditError);
      // Don't fail the main operation if audit logging fails
    }

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      plan_key: updateResult.plan_key,
      billing_status: updateResult.billing_status,
      manual_activation: updateResult.entitlements?.manual_activation || null
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Function': 'admin-set-org-access',
        'X-Version': '1.0'
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});