import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateOrgRequest {
  name: string;
  slug?: string;
}

const NON_PAYING_STATUSES = ['trialing', 'pending_billing', null];
const FREE_PLAN_KEYS = ['trial', 'free', null];

function isNonPayingOrg(org: any): boolean {
  return NON_PAYING_STATUSES.includes(org.billing_status) || 
         FREE_PLAN_KEYS.includes(org.plan_key);
}

async function logLimitHit(supabase: any, userId: string) {
  try {
    await supabase.rpc('log_activity_event', {
      p_org_id: '00000000-0000-0000-0000-000000000000',
      p_action: 'limit.hit',
      p_target_type: 'limit',
      p_actor_user_id: userId,
      p_actor_role_snapshot: 'user',
      p_target_id: 'org_cap',
      p_status: 'blocked',
      p_error_code: 'UPGRADE_REQUIRED',
      p_channel: 'audit',
      p_metadata: {
        type: 'org_cap',
        user_id: userId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error logging limit hit:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get authenticated user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreateOrgRequest = await req.json();
    const { name, slug } = body;

    if (!name?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Organization name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check existing organizations for this user
    const { data: userOrgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, billing_status, plan_key, owner_user_id')
      .eq('owner_user_id', user.id);

    if (orgsError) {
      console.error('Error fetching user organizations:', orgsError);
      return new Response(
        JSON.stringify({ error: 'Failed to check organization limit' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count non-paying organizations
    const nonPayingOrgCount = userOrgs?.filter(org => isNonPayingOrg(org)).length || 0;

    if (nonPayingOrgCount >= 1) {
      // Log the limit hit
      await logLimitHit(supabase, user.id);
      
      return new Response(
        JSON.stringify({
          error: 'Free accounts can only have 1 organization',
          code: 'UPGRADE_REQUIRED',
          currentCount: nonPayingOrgCount,
          limit: 1
        }),
        { 
          status: 402, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate slug if not provided
    const orgSlug = slug || name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Create organization using the existing function
    const { data: orgId, error: createError } = await supabase
      .rpc('create_organization_with_owner', {
        p_name: name.trim(),
        p_slug: orgSlug
      });

    if (createError) {
      console.error('Error creating organization:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful creation
    await supabase.rpc('log_activity_event', {
      p_org_id: orgId,
      p_action: 'org.created',
      p_target_type: 'organization',
      p_actor_user_id: user.id,
      p_actor_role_snapshot: 'admin',
      p_target_id: orgId,
      p_status: 'success',
      p_channel: 'audit',
      p_metadata: {
        name: name.trim(),
        slug: orgSlug,
        created_via: 'api'
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        organizationId: orgId,
        name: name.trim(),
        slug: orgSlug
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Create organization error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});