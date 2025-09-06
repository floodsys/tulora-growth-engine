import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateSeatsRequest {
  orgId: string
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ORG-UPDATE-SEATS] ${step}${detailsStr}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    logStep('Function started')

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not set')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header provided')

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) throw new Error('User not authenticated')

    const { orgId }: UpdateSeatsRequest = await req.json()
    logStep('Request data', { orgId })

    // Verify user has admin access to this org
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userData.user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Insufficient permissions')
    }

    // Count active seats
    const { data: activeSeats, error: seatsError } = await supabase
      .from('organization_members')
      .select('user_id', { count: 'exact' })
      .eq('organization_id', orgId)
      .eq('seat_active', true)

    if (seatsError) {
      logStep('Error counting seats', { error: seatsError })
      throw new Error('Failed to count active seats')
    }

    const seatCount = activeSeats?.length || 0
    logStep('Active seat count', { seatCount })

    // Get the org's active subscription
    const { data: subscription } = await supabase
      .from('org_stripe_subscriptions')
      .select('*')
      .eq('organization_id', orgId)
      .in('status', ['active', 'trialing'])
      .single()

    if (!subscription) {
      logStep('No active subscription found')
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active subscription to update',
        seatCount 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    logStep('Found subscription', { 
      subscriptionId: subscription.stripe_subscription_id,
      currentQuantity: subscription.quantity 
    })

    // If seat count matches current quantity, no update needed
    if (seatCount === subscription.quantity) {
      logStep('Seat count matches current quantity, no update needed')
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Seat count already up to date',
        seatCount 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    // Update the subscription item quantity in Stripe
    const subscriptionItemId = subscription.subscription_item_id
    if (!subscriptionItemId) {
      throw new Error('No subscription item ID found')
    }

    await stripe.subscriptionItems.update(subscriptionItemId, {
      quantity: seatCount,
      proration_behavior: 'create_prorations',
    })

    logStep('Updated Stripe subscription item', { 
      subscriptionItemId,
      newQuantity: seatCount 
    })

    // Update the quantity in our database
    const { error: updateError } = await supabase
      .from('org_stripe_subscriptions')
      .update({ 
        quantity: seatCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id)

    if (updateError) {
      logStep('Error updating subscription in database', { error: updateError })
      throw new Error('Failed to update subscription in database')
    }

    // Log the seat sync event
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        organization_id: orgId,
        actor_user_id: userData.user.id,
        actor_role_snapshot: 'admin',
        action: 'billing.seats_synced',
        target_type: 'subscription',
        target_id: subscription.stripe_subscription_id,
        status: 'success',
        channel: 'audit',
        metadata: {
          old_quantity: subscription.quantity,
          new_quantity: seatCount,
          stripe_subscription_id: subscription.stripe_subscription_id
        }
      })

    if (auditError) {
      logStep('Warning: Failed to log audit event', { error: auditError })
    }

    logStep('Successfully updated seat count', { 
      orgId,
      oldQuantity: subscription.quantity,
      newQuantity: seatCount 
    })

    return new Response(JSON.stringify({ 
      success: true,
      message: `Seats updated from ${subscription.quantity} to ${seatCount}`,
      oldQuantity: subscription.quantity,
      newQuantity: seatCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logStep('ERROR', { message: errorMessage })
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})