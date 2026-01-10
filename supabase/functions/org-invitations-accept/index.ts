import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { syncStripeSeatsForOrgAsync } from '../_shared/billingSeats.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AcceptInviteRequest {
  token: string;
}

interface InviteDetails {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  organization_name: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get authenticated user from JWT token
    const authHeader = req.headers.get('authorization');
    let authenticatedUser = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        authenticatedUser = user;
      }
    }

    const url = new URL(req.url);
    
    // Handle GET request - fetch invite details (no auth required)
    if (req.method === 'GET') {
      const token = url.searchParams.get('token');
      
      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Missing token parameter', error_code: 'MISSING_TOKEN' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch invitation details using service role (bypasses RLS)
      const { data: invite, error: fetchError } = await supabase
        .from('organization_invitations')
        .select(`
          id,
          organization_id,
          email,
          role,
          status,
          expires_at,
          organizations!inner (
            name
          )
        `)
        .eq('invite_token', token)
        .single();

      if (fetchError || !invite) {
        return new Response(
          JSON.stringify({ 
            error: 'Invitation not found or invalid token', 
            error_code: 'INVITE_NOT_FOUND' 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if expired
      if (new Date(invite.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ 
            error: 'This invitation has expired',
            error_code: 'INVITE_EXPIRED',
            invite: {
              email: invite.email,
              organization_name: invite.organizations?.name || 'Unknown Organization'
            }
          }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if already used
      if (invite.status !== 'pending') {
        return new Response(
          JSON.stringify({ 
            error: 'This invitation has already been used or is no longer valid',
            error_code: 'INVITE_ALREADY_USED',
            status: invite.status
          }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Return invite details
      const inviteDetails: InviteDetails = {
        id: invite.id,
        organization_id: invite.organization_id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expires_at: invite.expires_at,
        organization_name: invite.organizations?.name || 'Unknown Organization'
      };

      return new Response(
        JSON.stringify({ success: true, invite: inviteDetails }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle POST request - accept the invitation (auth required)
    if (req.method === 'POST') {
      if (!authenticatedUser) {
        return new Response(
          JSON.stringify({ error: 'Authentication required', error_code: 'AUTH_REQUIRED' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body: AcceptInviteRequest = await req.json();
      const { token } = body;

      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Missing token in request body', error_code: 'MISSING_TOKEN' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch invitation details
      const { data: invite, error: fetchError } = await supabase
        .from('organization_invitations')
        .select(`
          id,
          organization_id,
          email,
          role,
          status,
          expires_at,
          organizations!inner (
            name
          )
        `)
        .eq('invite_token', token)
        .single();

      if (fetchError || !invite) {
        // Log failed attempt
        await supabase.rpc('log_event', {
          p_org_id: '00000000-0000-0000-0000-000000000000',
          p_action: 'invite.accept_failed',
          p_target_type: 'invite',
          p_target_id: token.substring(0, 8),
          p_status: 'error',
          p_metadata: { error: 'invite_not_found', user_id: authenticatedUser.id }
        });

        return new Response(
          JSON.stringify({ 
            error: 'Invitation not found or invalid token', 
            error_code: 'INVITE_NOT_FOUND' 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate expiry
      if (new Date(invite.expires_at) < new Date()) {
        await supabase.rpc('log_event', {
          p_org_id: invite.organization_id,
          p_action: 'invite.accept_failed',
          p_target_type: 'invite',
          p_target_id: invite.id,
          p_status: 'error',
          p_metadata: { error: 'invite_expired', user_id: authenticatedUser.id }
        });

        return new Response(
          JSON.stringify({ 
            error: 'This invitation has expired',
            error_code: 'INVITE_EXPIRED'
          }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate status
      if (invite.status !== 'pending') {
        await supabase.rpc('log_event', {
          p_org_id: invite.organization_id,
          p_action: 'invite.accept_failed',
          p_target_type: 'invite',
          p_target_id: invite.id,
          p_status: 'error',
          p_metadata: { error: 'invite_not_pending', status: invite.status, user_id: authenticatedUser.id }
        });

        return new Response(
          JSON.stringify({ 
            error: 'This invitation has already been used or is no longer valid',
            error_code: 'INVITE_ALREADY_USED'
          }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate email match (case-insensitive)
      const userEmail = authenticatedUser.email?.toLowerCase().trim();
      const inviteEmail = invite.email?.toLowerCase().trim();

      if (userEmail !== inviteEmail) {
        await supabase.rpc('log_event', {
          p_org_id: invite.organization_id,
          p_action: 'invite.accept_failed',
          p_target_type: 'invite',
          p_target_id: invite.id,
          p_status: 'error',
          p_metadata: { 
            error: 'email_mismatch', 
            invite_email: inviteEmail,
            user_email: userEmail,
            user_id: authenticatedUser.id 
          }
        });

        return new Response(
          JSON.stringify({ 
            error: `This invitation is for ${invite.email}, but you're signed in as ${authenticatedUser.email}`,
            error_code: 'EMAIL_MISMATCH',
            invite_email: invite.email
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create organization_members row (upsert to handle existing members)
      const { error: memberError } = await supabase
        .from('organization_members')
        .upsert({
          organization_id: invite.organization_id,
          user_id: authenticatedUser.id,
          role: invite.role,
          seat_active: true
        }, {
          onConflict: 'organization_id,user_id'
        });

      if (memberError) {
        console.error('Error creating membership:', memberError);
        
        await supabase.rpc('log_event', {
          p_org_id: invite.organization_id,
          p_action: 'invite.accept_failed',
          p_target_type: 'invite',
          p_target_id: invite.id,
          p_status: 'error',
          p_metadata: { error: 'membership_create_failed', details: memberError.message, user_id: authenticatedUser.id }
        });

        return new Response(
          JSON.stringify({ 
            error: 'Failed to create organization membership',
            error_code: 'MEMBERSHIP_ERROR'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user has no current_org_id and set it
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_org_id')
        .eq('id', authenticatedUser.id)
        .single();

      if (profile && !profile.current_org_id) {
        await supabase
          .from('profiles')
          .update({ current_org_id: invite.organization_id })
          .eq('id', authenticatedUser.id);
      }

      // Mark invitation as accepted
      const { error: updateError } = await supabase
        .from('organization_invitations')
        .update({ status: 'accepted' })
        .eq('id', invite.id);

      if (updateError) {
        console.error('Error updating invitation status:', updateError);
        // Don't fail the request - membership was created successfully
      }

      // Log successful acceptance
      await supabase.rpc('log_event', {
        p_org_id: invite.organization_id,
        p_action: 'invite.accepted',
        p_target_type: 'invite',
        p_target_id: invite.id,
        p_status: 'success',
        p_metadata: { 
          role: invite.role,
          user_id: authenticatedUser.id,
          email: invite.email
        }
      });

      // Also log member.added
      await supabase.rpc('log_event', {
        p_org_id: invite.organization_id,
        p_action: 'member.added',
        p_target_type: 'member',
        p_target_id: authenticatedUser.id,
        p_status: 'success',
        p_metadata: { 
          role: invite.role,
          email: invite.email,
          via: 'invitation'
        }
      });

      // Sync seat count to Stripe (fire-and-forget, don't block response)
      // This updates the subscription quantity to match active seats
      syncStripeSeatsForOrgAsync(supabase, invite.organization_id);

      return new Response(
        JSON.stringify({ 
          success: true,
          organization_id: invite.organization_id,
          organization_name: invite.organizations?.name || 'Unknown Organization',
          role: invite.role,
          message: 'Invitation accepted successfully'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Invite acceptance error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', error_code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
