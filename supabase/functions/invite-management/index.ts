import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireOrgActive, createBlockedResponse } from '../_shared/org-guard.ts'
import { syncStripeSeatsForOrgAsync } from '../_shared/billingSeats.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

interface InviteRequest {
  action: 'create' | 'revoke' | 'accept';
  organizationId: string;
  email?: string;
  role?: string;
  inviteToken?: string;
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

    const body: InviteRequest = await req.json();
    const { action, organizationId, email, role, inviteToken } = body;

    // Check organization status before proceeding (except for accept action)
    if (action !== 'accept' && organizationId) {
      const guardResult = await requireOrgActive({
        organizationId,
        action: `invite.${action}`,
        path: '/invite-management',
        method: req.method,
        actorUserId: user.id,
        supabase
      });

      if (!guardResult.ok) {
        return createBlockedResponse(guardResult, corsHeaders);
      }
    }

    let result;
    let auditAction;
    let auditStatus = 'success';
    let auditMetadata = {};
    let auditTargetId;

    switch (action) {
      case 'create':
        if (!email || !role) {
          return new Response(
            JSON.stringify({ error: 'Email and role are required for creating invites' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check for existing invite
        const { data: existingInvite } = await supabase
          .from('organization_invitations')
          .select('id, status')
          .eq('organization_id', organizationId)
          .eq('email', email.toLowerCase().trim())
          .eq('status', 'pending')
          .single();

        if (existingInvite) {
          auditAction = 'invite.duplicate_blocked';
          auditStatus = 'error';
          auditMetadata = { email, role, reason: 'duplicate_pending_invite' };
          
          // Log the blocked duplicate invite
          await supabase.rpc('log_event', {
            p_org_id: organizationId,
            p_action: auditAction,
            p_target_type: 'invite',
            p_target_id: email,
            p_status: auditStatus,
            p_metadata: auditMetadata
          });

          return new Response(
            JSON.stringify({ error: 'An invitation for this email is already pending' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create new invite using existing RPC
        const { data: inviteData, error: inviteError } = await supabase.rpc('create_invite', {
          p_org: organizationId,
          p_email: email,
          p_role: role
        });

        if (inviteError) {
          auditAction = 'invite.create_failed';
          auditStatus = 'error';
          auditMetadata = { email, role, error: inviteError.message };
          auditTargetId = email;
        } else {
          auditAction = 'invite.created';
          auditMetadata = { email, role, invitation_id: inviteData.invitation_id };
          auditTargetId = inviteData.invitation_id;
          result = inviteData;
        }
        break;

      case 'revoke':
        if (!inviteToken) {
          return new Response(
            JSON.stringify({ error: 'Invite token is required for revoking invites' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: inviteToRevoke, error: fetchError } = await supabase
          .from('organization_invitations')
          .select('id, email, role')
          .eq('invite_token', inviteToken)
          .eq('organization_id', organizationId)
          .eq('status', 'pending')
          .single();

        if (fetchError || !inviteToRevoke) {
          auditAction = 'invite.revoke_failed';
          auditStatus = 'error';
          auditMetadata = { invite_token: inviteToken, error: 'invite_not_found' };
        } else {
          const { error: revokeError } = await supabase
            .from('organization_invitations')
            .update({ status: 'revoked' })
            .eq('id', inviteToRevoke.id);

          if (revokeError) {
            auditAction = 'invite.revoke_failed';
            auditStatus = 'error';
            auditMetadata = { 
              email: inviteToRevoke.email, 
              role: inviteToRevoke.role, 
              error: revokeError.message 
            };
          } else {
            auditAction = 'invite.revoked';
            auditMetadata = { 
              email: inviteToRevoke.email, 
              role: inviteToRevoke.role 
            };
            auditTargetId = inviteToRevoke.id;
            result = { success: true };
          }
        }
        break;

      case 'accept':
        if (!inviteToken) {
          return new Response(
            JSON.stringify({ error: 'Invite token is required for accepting invites' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: acceptData, error: acceptError } = await supabase.rpc('accept_invite', {
          p_token: inviteToken
        });

        if (acceptError || !acceptData.success) {
          auditAction = 'invite.accept_failed';
          auditStatus = 'error';
          auditMetadata = { 
            invite_token: inviteToken, 
            error: acceptError?.message || acceptData.error 
          };
        } else {
          auditAction = 'invite.accepted';
          auditMetadata = { 
            role: acceptData.role,
            organization_id: acceptData.organization_id 
          };
          auditTargetId = user.id;
          result = acceptData;
          
          // Sync seat count to Stripe after successful invite acceptance
          // (fire-and-forget, don't block response)
          if (acceptData.organization_id) {
            syncStripeSeatsForOrgAsync(supabase, acceptData.organization_id);
          }
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
      p_target_type: 'invite',
      p_target_id: auditTargetId,
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
    console.error('Invite management error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
