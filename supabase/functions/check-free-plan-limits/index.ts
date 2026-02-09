import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { getCorsHeaders } from '../_shared/cors.ts'

interface CheckLimitsRequest {
  action: 'create_organization' | 'add_team_member';
  organizationId?: string;
}

interface LimitCheckResult {
  allowed: boolean;
  error?: string;
  errorCode?: string;
  currentCount?: number;
  limit?: number;
}

const NON_PAYING_STATUSES = ['trialing', 'pending_billing', null];
const FREE_PLAN_KEYS = ['trial', 'free', null];

function isNonPayingOrg(org: any): boolean {
  return NON_PAYING_STATUSES.includes(org.billing_status) || 
         FREE_PLAN_KEYS.includes(org.plan_key);
}

async function checkOrganizationLimit(supabase: any, userId: string): Promise<LimitCheckResult> {
  // Get all organizations owned by or where user is a member
  const { data: userOrgs, error } = await supabase
    .from('organizations')
    .select('id, billing_status, plan_key, owner_user_id')
    .or(`owner_user_id.eq.${userId}`);

  if (error) {
    console.error('Error fetching user organizations:', error);
    return { allowed: false, error: 'Failed to check organization limit' };
  }

  // Count non-paying organizations where user is owner
  const nonPayingOrgCount = userOrgs?.filter(org => 
    org.owner_user_id === userId && isNonPayingOrg(org)
  ).length || 0;

  if (nonPayingOrgCount >= 1) {
    return {
      allowed: false,
      error: 'Free accounts can only have 1 organization',
      errorCode: 'ORG_LIMIT_EXCEEDED',
      currentCount: nonPayingOrgCount,
      limit: 1
    };
  }

  return { allowed: true };
}

async function checkTeamMemberLimit(supabase: any, organizationId: string): Promise<LimitCheckResult> {
  // Get organization details
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('billing_status, plan_key')
    .eq('id', organizationId)
    .single();

  if (orgError || !org) {
    return { allowed: false, error: 'Organization not found' };
  }

  // If organization is paying, no limits
  if (!isNonPayingOrg(org)) {
    return { allowed: true };
  }

  // Count current active team members
  const { data: members, error: membersError } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('seat_active', true);

  if (membersError) {
    console.error('Error fetching team members:', membersError);
    return { allowed: false, error: 'Failed to check team member limit' };
  }

  const currentCount = members?.length || 0;

  if (currentCount >= 1) {
    return {
      allowed: false,
      error: 'Free organizations can only have 1 team member',
      errorCode: 'TEAM_LIMIT_EXCEEDED',
      currentCount,
      limit: 1
    };
  }

  return { allowed: true };
}

async function logLimitHit(supabase: any, userId: string, organizationId: string | null, limitType: 'org_cap' | 'team_cap') {
  try {
    await supabase.rpc('log_activity_event', {
      p_org_id: organizationId || '00000000-0000-0000-0000-000000000000',
      p_action: 'limit.hit',
      p_target_type: 'limit',
      p_actor_user_id: userId,
      p_actor_role_snapshot: 'user',
      p_target_id: limitType,
      p_status: 'blocked',
      p_error_code: 'UPGRADE_REQUIRED',
      p_channel: 'audit',
      p_metadata: {
        type: limitType,
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
  const corsHeaders = getCorsHeaders(req);
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

    const body: CheckLimitsRequest = await req.json();
    const { action, organizationId } = body;

    let result: LimitCheckResult;

    switch (action) {
      case 'create_organization':
        result = await checkOrganizationLimit(supabase, user.id);
        if (!result.allowed) {
          await logLimitHit(supabase, user.id, null, 'org_cap');
        }
        break;

      case 'add_team_member':
        if (!organizationId) {
          return new Response(
            JSON.stringify({ error: 'Organization ID required for team member limit check' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await checkTeamMemberLimit(supabase, organizationId);
        if (!result.allowed) {
          await logLimitHit(supabase, user.id, organizationId, 'team_cap');
        }
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // If limit exceeded, return 402 Payment Required
    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: result.error,
          code: result.errorCode || 'UPGRADE_REQUIRED',
          currentCount: result.currentCount,
          limit: result.limit
        }),
        { 
          status: 402, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ allowed: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Limit check error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});