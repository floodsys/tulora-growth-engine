import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateInviteRequest {
  p_org: string;
  p_email: string;
  p_role: string;
}

const NON_PAYING_STATUSES = ['trialing', 'pending_billing', null];
const FREE_PLAN_KEYS = ['trial', 'free', null];

function isNonPayingOrg(org: any): boolean {
  return NON_PAYING_STATUSES.includes(org.billing_status) || 
         FREE_PLAN_KEYS.includes(org.plan_key);
}

async function logLimitHit(supabase: any, userId: string, organizationId: string) {
  try {
    await supabase.rpc('log_activity_event', {
      p_org_id: organizationId,
      p_action: 'limit.hit',
      p_target_type: 'limit',
      p_actor_user_id: userId,
      p_actor_role_snapshot: 'admin',
      p_target_id: 'team_cap',
      p_status: 'blocked',
      p_error_code: 'UPGRADE_REQUIRED',
      p_channel: 'audit',
      p_metadata: {
        type: 'team_cap',
        user_id: userId,
        organization_id: organizationId,
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

    const body: CreateInviteRequest = await req.json();
    const { p_org: organizationId, p_email: email, p_role: role } = body;

    if (!organizationId || !email || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('billing_status, plan_key')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if organization is non-paying and enforce team limits
    if (isNonPayingOrg(org)) {
      // Count current active team members
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('seat_active', true);

      if (membersError) {
        console.error('Error fetching team members:', membersError);
        return new Response(
          JSON.stringify({ error: 'Failed to check team member limit' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const currentCount = members?.length || 0;

      if (currentCount >= 1) {
        // Log the limit hit
        await logLimitHit(supabase, user.id, organizationId);
        
        return new Response(
          JSON.stringify({
            error: 'Free organizations can only have 1 team member',
            code: 'UPGRADE_REQUIRED',
            currentCount,
            limit: 1
          }),
          { 
            status: 402, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Create the invitation using the existing RPC function
    const { data, error: inviteError } = await supabase
      .rpc('create_invite', {
        p_org: organizationId,
        p_email: email,
        p_role: role
      });

    if (inviteError) {
      console.error('Error creating invite:', inviteError);
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful invitation creation
    await supabase.rpc('log_activity_event', {
      p_org_id: organizationId,
      p_action: 'invite.created',
      p_target_type: 'invitation',
      p_actor_user_id: user.id,
      p_actor_role_snapshot: 'admin',
      p_target_id: email,
      p_status: 'success',
      p_channel: 'audit',
      p_metadata: {
        email,
        role,
        organization_id: organizationId
      }
    });

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Create invite error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});