import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from request
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { orgId } = await req.json();

    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Organization ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user has access to this organization
    const { data: membership } = await supabaseClient
      .from('organization_members')
      .select('*')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .eq('seat_active', true)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current concurrency
    const { data: currentConcurrency, error: concurrencyError } = await supabaseClient
      .rpc('get_current_concurrency', { p_org_id: orgId });

    if (concurrencyError) {
      console.error('Error getting concurrency:', concurrencyError);
      return new Response(JSON.stringify({ error: 'Failed to get concurrency' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get organization entitlements for limits
    const { data: org } = await supabaseClient
      .from('organizations')
      .select('entitlements, plan_key')
      .eq('id', orgId)
      .single();

    const entitlements = org?.entitlements || {};
    const concurrencyLimit = entitlements.limit_concurrency || 1; // Default limit

    // Get peak concurrency for current month
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const { data: rollup } = await supabaseClient
      .from('usage_rollups')
      .select('concurrency_peak')
      .eq('organization_id', orgId)
      .eq('year_month', currentMonth)
      .single();

    const result = {
      current: currentConcurrency || 0,
      limit: concurrencyLimit,
      peak_this_month: rollup?.concurrency_peak || 0,
      percentage: Math.round((currentConcurrency / concurrencyLimit) * 100),
      warning_threshold: Math.round(concurrencyLimit * 0.8), // 80% warning
      critical_threshold: Math.round(concurrencyLimit * 0.95), // 95% critical
      status: currentConcurrency >= concurrencyLimit * 0.95 ? 'critical' :
              currentConcurrency >= concurrencyLimit * 0.8 ? 'warning' : 'ok'
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});