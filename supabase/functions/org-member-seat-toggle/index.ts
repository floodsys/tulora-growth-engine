/**
 * Organization Member Seat Toggle Edge Function
 * 
 * Handles activating/deactivating member seats and syncs the seat count to Stripe.
 * This wraps the admin_toggle_member_seat SQL function and adds billing sync.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { syncStripeSeatsForOrgAsync } from '../_shared/billingSeats.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

interface SeatToggleRequest {
  organizationId: string;
  userId: string;
  seatActive: boolean;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ORG-MEMBER-SEAT-TOGGLE] ${step}${detailsStr}`);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const corr = crypto.randomUUID();

  try {
    logStep('Function started', { corr })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request
    const { organizationId, userId, seatActive }: SeatToggleRequest = await req.json()
    
    if (!organizationId || !userId || typeof seatActive !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: organizationId, userId, seatActive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    logStep('Request data', { corr, organizationId, userId, seatActive })

    // Verify caller has admin access to this org
    const { data: callerMembership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userData.user.id)
      .eq('seat_active', true)
      .single()

    if (membershipError || !callerMembership) {
      logStep('Caller not a member of org', { corr, error: membershipError })
      return new Response(
        JSON.stringify({ error: 'You are not a member of this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if caller is admin or owner
    const { data: org } = await supabase
      .from('organizations')
      .select('owner_user_id')
      .eq('id', organizationId)
      .single()

    const isOwner = org?.owner_user_id === userData.user.id
    const isAdmin = callerMembership.role === 'admin'

    if (!isOwner && !isAdmin) {
      logStep('Insufficient permissions', { corr, role: callerMembership.role, isOwner })
      return new Response(
        JSON.stringify({ error: 'Only admins can toggle member seats' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cannot deactivate owner's seat
    if (!seatActive && org?.owner_user_id === userId) {
      logStep('Cannot deactivate owner seat', { corr, userId })
      return new Response(
        JSON.stringify({ error: 'Cannot deactivate the organization owner\'s seat' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get current seat status
    const { data: currentMember, error: currentError } = await supabase
      .from('organization_members')
      .select('seat_active, role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .single()

    if (currentError || !currentMember) {
      logStep('Target member not found', { corr, error: currentError })
      return new Response(
        JSON.stringify({ error: 'Member not found in this organization' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const oldSeatActive = currentMember.seat_active

    // If status is already the same, no change needed
    if (oldSeatActive === seatActive) {
      logStep('Seat status already matches', { corr, seatActive })
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Seat is already ${seatActive ? 'active' : 'inactive'}`,
          seatActive
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update the seat status
    const { error: updateError } = await supabase
      .from('organization_members')
      .update({ seat_active: seatActive })
      .eq('organization_id', organizationId)
      .eq('user_id', userId)

    if (updateError) {
      logStep('Error updating seat status', { corr, error: updateError })
      return new Response(
        JSON.stringify({ error: 'Failed to update seat status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    logStep('Seat status updated', { corr, oldSeatActive, newSeatActive: seatActive })

    // Get member info for audit logging
    const { data: memberProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    // Log the audit event
    await supabase.rpc('log_activity_event', {
      p_org_id: organizationId,
      p_action: seatActive ? 'member.seat_activated' : 'member.seat_deactivated',
      p_target_type: 'member',
      p_actor_user_id: userData.user.id,
      p_actor_role_snapshot: isOwner ? 'owner' : 'admin',
      p_target_id: userId,
      p_status: 'success',
      p_error_code: null,
      p_ip_hash: null,
      p_user_agent: req.headers.get('user-agent'),
      p_request_id: corr,
      p_channel: 'audit',
      p_metadata: {
        member_email: memberProfile?.email,
        member_name: memberProfile?.full_name,
        old_seat_active: oldSeatActive,
        new_seat_active: seatActive,
        changed_by: userData.user.email,
        timestamp: new Date().toISOString()
      }
    }).catch((logError) => {
      logStep('Warning: Failed to log activity event', { corr, error: logError })
    })

    // Sync seat count to Stripe (fire-and-forget, don't block response)
    // This updates the subscription quantity to match active seats
    syncStripeSeatsForOrgAsync(supabase, organizationId, corr)

    logStep('Successfully toggled seat', { 
      corr,
      organizationId,
      userId,
      oldSeatActive,
      newSeatActive: seatActive
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Seat ${seatActive ? 'activated' : 'deactivated'} successfully`,
        oldSeatActive,
        seatActive,
        userId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logStep('ERROR', { corr, message: errorMessage })
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
