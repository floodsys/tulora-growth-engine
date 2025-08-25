import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireOrgActive, createBlockedResponse } from '../_shared/org-guard.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MemberRequest {
  action: 'add' | 'remove' | 'change_role';
  organizationId: string;
  userId: string;
  newRole?: string;
  oldRole?: string;
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

    const body: MemberRequest = await req.json();
    const { action, organizationId, userId, newRole, oldRole } = body;

    // Check organization status with guard
    const guardResult = await requireOrgActive({
      organizationId,
      action: `member.${action}`,
      path: '/member-management',
      method: req.method,
      actorUserId: user.id,
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      supabase
    })

    if (!guardResult.ok) {
      return createBlockedResponse(guardResult, corsHeaders)
    }

    let result;
    let auditAction;
    let auditStatus = 'success';
    let auditMetadata = {};

    // Get member info for audit logging
    const { data: memberProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    const memberInfo = {
      user_id: userId,
      email: memberProfile?.email,
      full_name: memberProfile?.full_name
    };

    switch (action) {
      case 'add':
        if (!newRole) {
          return new Response(
            JSON.stringify({ error: 'Role is required for adding members' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: addError } = await supabase
          .from('organization_members')
          .insert({
            organization_id: organizationId,
            user_id: userId,
            role: newRole,
            seat_active: true
          });

        if (addError) {
          auditAction = 'member.add_failed';
          auditStatus = 'error';
          auditMetadata = { ...memberInfo, role: newRole, error: addError.message };
        } else {
          auditAction = 'member.added';
          auditMetadata = { ...memberInfo, role: newRole };
          result = { success: true };
        }
        break;

      case 'remove':
        const { error: removeError } = await supabase
          .from('organization_members')
          .delete()
          .eq('organization_id', organizationId)
          .eq('user_id', userId);

        if (removeError) {
          auditAction = 'member.remove_failed';
          auditStatus = 'error';
          auditMetadata = { ...memberInfo, error: removeError.message };
        } else {
          auditAction = 'member.removed';
          auditMetadata = memberInfo;
          result = { success: true };
        }
        break;

      case 'change_role':
        if (!newRole || !oldRole) {
          return new Response(
            JSON.stringify({ error: 'Both old and new roles are required for role changes' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: roleError } = await supabase
          .from('organization_members')
          .update({ role: newRole })
          .eq('organization_id', organizationId)
          .eq('user_id', userId);

        if (roleError) {
          auditAction = 'member.role_change_failed';
          auditStatus = 'error';
          auditMetadata = { 
            ...memberInfo, 
            old_role: oldRole, 
            new_role: newRole, 
            error: roleError.message 
          };
        } else {
          auditAction = 'member.role_changed';
          auditMetadata = { 
            ...memberInfo, 
            old_role: oldRole, 
            new_role: newRole 
          };
          result = { success: true };
        }
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Log the audit event
    await supabase.rpc('log_event', {
      p_org_id: organizationId,
      p_action: auditAction,
      p_target_type: 'member',
      p_target_id: userId,
      p_status: auditStatus,
      p_metadata: auditMetadata
    });

    if (auditStatus === 'error') {
      return new Response(
        JSON.stringify({ error: auditMetadata.error || 'Operation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Member management error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});