/**
 * Shared billing seats sync helper for Edge Functions
 * Syncs active seat count to Stripe subscription quantity
 * 
 * This is SERVER-SIDE ONLY - do not import into frontend code.
 */

import Stripe from 'https://esm.sh/stripe@14.21.0'

export interface SeatSyncResult {
  success: boolean;
  message: string;
  oldQuantity?: number;
  newQuantity?: number;
  subscriptionId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Stripe factory type for dependency injection in tests
 */
export type StripeFactory = (stripeKey: string) => {
  subscriptions: { retrieve: Function };
  subscriptionItems: { update: Function };
};

/**
 * Sync active seat count to Stripe subscription quantity
 * 
 * @param supabase - Supabase client with service_role permissions
 * @param orgId - Organization ID
 * @param correlationId - Optional correlation ID for logging
 * @param stripeFactory - Optional factory for creating Stripe client (for testing)
 * @returns SeatSyncResult with sync status and details
 */
export async function syncStripeSeatsForOrg(
  supabase: any,
  orgId: string,
  correlationId?: string,
  stripeFactory?: StripeFactory
): Promise<SeatSyncResult> {
  const corr = correlationId || crypto.randomUUID();
  const logPrefix = `[billingSeats][${corr}]`;

  console.log(`${logPrefix} Starting seat sync for org ${orgId}`);

  try {
    // Get Stripe API key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.warn(`${logPrefix} STRIPE_SECRET_KEY not configured, skipping seat sync`);
      return {
        success: true,
        skipped: true,
        message: 'Stripe not configured, seat sync skipped',
      };
    }

    // Step 1: Count active seats
    const { data: activeSeats, error: seatsError } = await supabase
      .from('organization_members')
      .select('user_id', { count: 'exact' })
      .eq('organization_id', orgId)
      .eq('seat_active', true);

    if (seatsError) {
      console.error(`${logPrefix} Error counting seats:`, seatsError);
      throw new Error(`Failed to count active seats: ${seatsError.message}`);
    }

    const seatCount = activeSeats?.length || 0;
    console.log(`${logPrefix} Active seat count: ${seatCount}`);

    // Step 2: Get the org's active subscription
    const { data: subscription, error: subError } = await supabase
      .from('org_stripe_subscriptions')
      .select('*')
      .eq('organization_id', orgId)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    // Fail-closed: if there's any error fetching subscription, return failure
    if (subError) {
      console.error(`${logPrefix} Error fetching subscription:`, subError);
      return {
        success: false,
        message: 'Failed to fetch subscription',
        error: subError.message,
      };
    }

    // Fail-open: if no subscription found, skip (not an error)
    if (!subscription) {
      console.log(`${logPrefix} No active subscription found, skipping seat sync`);
      return {
        success: true,
        skipped: true,
        message: 'No active subscription to update',
        newQuantity: seatCount,
      };
    }

    const oldQuantity = subscription.quantity || 0;
    console.log(`${logPrefix} Found subscription:`, {
      subscriptionId: subscription.stripe_subscription_id,
      currentQuantity: oldQuantity,
    });

    // Step 3: If seat count matches current quantity, no update needed
    if (seatCount === oldQuantity) {
      console.log(`${logPrefix} Seat count matches current quantity, no update needed`);
      return {
        success: true,
        message: 'Seat count already up to date',
        oldQuantity,
        newQuantity: seatCount,
        subscriptionId: subscription.stripe_subscription_id,
      };
    }

    // Step 4: Initialize Stripe and retrieve subscription items
    const stripe = stripeFactory
      ? stripeFactory(stripeKey)
      : new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Retrieve the subscription from Stripe to get the item ID
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );

    if (!stripeSubscription.items.data.length) {
      console.error(`${logPrefix} No subscription items found in Stripe subscription`);
      throw new Error('No subscription items found in Stripe subscription');
    }

    // Use the first subscription item (primary seat item)
    const subscriptionItemId = stripeSubscription.items.data[0].id;
    console.log(`${logPrefix} Subscription item ID: ${subscriptionItemId}`);

    // Step 5: Update the subscription item quantity in Stripe
    await stripe.subscriptionItems.update(subscriptionItemId, {
      quantity: seatCount,
      proration_behavior: 'create_prorations',
    });

    console.log(`${logPrefix} Updated Stripe subscription item:`, {
      subscriptionItemId,
      newQuantity: seatCount,
    });

    // Step 6: Update the quantity in our database
    const { error: updateError } = await supabase
      .from('org_stripe_subscriptions')
      .update({
        quantity: seatCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    if (updateError) {
      console.error(`${logPrefix} Error updating subscription in database:`, updateError);
      // Don't throw - Stripe is already updated, just log the warning
      console.warn(`${logPrefix} Stripe updated but database sync failed`);
    }

    // Step 7: Log the seat sync event (fire-and-forget)
    logSeatSyncEvent(supabase, orgId, oldQuantity, seatCount, subscription.stripe_subscription_id, corr)
      .catch((logErr) => {
        console.error(`${logPrefix} Failed to log seat sync event:`, logErr);
      });

    console.log(`${logPrefix} Successfully synced seats:`, {
      orgId,
      oldQuantity,
      newQuantity: seatCount,
    });

    return {
      success: true,
      message: `Seats updated from ${oldQuantity} to ${seatCount}`,
      oldQuantity,
      newQuantity: seatCount,
      subscriptionId: subscription.stripe_subscription_id,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} Seat sync failed:`, errorMessage);

    // Log the failure event (fire-and-forget)
    logSeatSyncFailure(supabase, orgId, errorMessage, corr)
      .catch((logErr) => {
        console.error(`${logPrefix} Failed to log seat sync failure:`, logErr);
      });

    return {
      success: false,
      message: 'Seat sync failed',
      error: errorMessage,
    };
  }
}

/**
 * Log successful seat sync event to activity_events
 */
async function logSeatSyncEvent(
  supabase: any,
  orgId: string,
  oldQuantity: number,
  newQuantity: number,
  subscriptionId: string,
  correlationId: string
): Promise<void> {
  try {
    // Try using log_activity_event RPC first
    const { error: rpcError } = await supabase.rpc('log_activity_event', {
      p_org_id: orgId,
      p_action: 'billing.seats_synced',
      p_target_type: 'subscription',
      p_actor_user_id: null,
      p_actor_role_snapshot: 'system',
      p_target_id: subscriptionId,
      p_status: 'success',
      p_error_code: null,
      p_ip_hash: null,
      p_user_agent: null,
      p_request_id: correlationId,
      p_channel: 'audit',
      p_metadata: {
        old_quantity: oldQuantity,
        new_quantity: newQuantity,
        stripe_subscription_id: subscriptionId,
        timestamp: new Date().toISOString(),
        source: 'billing_seats_sync',
      },
    });

    if (rpcError) {
      console.warn(`[billingSeats][${correlationId}] log_activity_event failed, trying audit_log:`, rpcError);

      // Fallback to direct audit_log insert
      await supabase.from('audit_log').insert({
        organization_id: orgId,
        actor_user_id: null,
        actor_role_snapshot: 'system',
        action: 'billing.seats_synced',
        target_type: 'subscription',
        target_id: subscriptionId,
        status: 'success',
        channel: 'audit',
        metadata: {
          old_quantity: oldQuantity,
          new_quantity: newQuantity,
          stripe_subscription_id: subscriptionId,
          correlation_id: correlationId,
        },
      });
    }
  } catch (logError) {
    console.error(`[billingSeats][${correlationId}] Logging failed:`, logError);
  }
}

/**
 * Log seat sync failure to activity_events
 */
async function logSeatSyncFailure(
  supabase: any,
  orgId: string,
  errorMessage: string,
  correlationId: string
): Promise<void> {
  try {
    const { error: rpcError } = await supabase.rpc('log_activity_event', {
      p_org_id: orgId,
      p_action: 'billing.seats_sync_failed',
      p_target_type: 'subscription',
      p_actor_user_id: null,
      p_actor_role_snapshot: 'system',
      p_target_id: null,
      p_status: 'error',
      p_error_code: 'SEAT_SYNC_ERROR',
      p_ip_hash: null,
      p_user_agent: null,
      p_request_id: correlationId,
      p_channel: 'audit',
      p_metadata: {
        error_message: errorMessage,
        timestamp: new Date().toISOString(),
        source: 'billing_seats_sync',
      },
    });

    if (rpcError) {
      // Fallback to direct audit_log insert
      await supabase.from('audit_log').insert({
        organization_id: orgId,
        actor_user_id: null,
        actor_role_snapshot: 'system',
        action: 'billing.seats_sync_failed',
        target_type: 'subscription',
        target_id: null,
        status: 'error',
        error_code: 'SEAT_SYNC_ERROR',
        channel: 'audit',
        metadata: {
          error_message: errorMessage,
          correlation_id: correlationId,
        },
      });
    }
  } catch (logError) {
    console.error(`[billingSeats][${correlationId}] Failure logging failed:`, logError);
  }
}

/**
 * Fire-and-forget wrapper for seat sync that doesn't block calling code
 * Use this when you want to sync seats but don't want errors to affect the main flow
 * 
 * @param supabase - Supabase client with service_role permissions
 * @param orgId - Organization ID
 * @param correlationId - Optional correlation ID for logging
 * @param stripeFactory - Optional factory for creating Stripe client (for testing)
 */
export function syncStripeSeatsForOrgAsync(
  supabase: any,
  orgId: string,
  correlationId?: string,
  stripeFactory?: StripeFactory
): void {
  const corr = correlationId || crypto.randomUUID();

  // Fire and forget - errors are logged but not propagated
  syncStripeSeatsForOrg(supabase, orgId, corr, stripeFactory).catch((error) => {
    console.error(`[billingSeats][${corr}] Async seat sync failed for org ${orgId}:`, error);
  });
}
