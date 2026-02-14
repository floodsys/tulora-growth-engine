import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { getCorsHeaders } from '../_shared/cors.ts'
import { safeJson } from '../_shared/log.ts'

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(safeJson(details))}` : '';
  console.log(`[ORG-BILLING-WEBHOOK] ${step}${detailsStr}`);
}

// Error context for logging failed webhooks
interface WebhookErrorContext {
  eventId?: string;
  eventType?: string;
  orgId?: string;
  errorCode: string;
  errorMessage: string;
  rawStatus: number;
  correlationId: string;
}

/**
 * Log webhook error to billing_webhook_errors table and activity_events
 * This enables monitoring and alerting for failed Stripe webhooks
 * 
 * TODO: Hook this into email/Slack alerts for critical failures
 */
async function logWebhookError(supabase: any, context: WebhookErrorContext): Promise<void> {
  const { eventId, eventType, orgId, errorCode, errorMessage, rawStatus, correlationId } = context;

  try {
    // Insert into billing_webhook_errors table
    const { error: insertError } = await supabase
      .from('billing_webhook_errors')
      .insert({
        event_id: eventId || null,
        event_type: eventType || null,
        organization_id: orgId || null,
        error_message: errorMessage,
        error_code: errorCode,
        raw_status: rawStatus,
        correlation_id: correlationId,
      });

    if (insertError) {
      logStep('WARNING: Failed to insert webhook error to table', { error: insertError, correlationId });
    } else {
      logStep('Webhook error logged to billing_webhook_errors', { eventId, eventType, correlationId });
    }

    // Also log to activity_events for telemetry/audit trail
    await supabase.rpc('log_activity_event', {
      p_org_id: orgId || null,
      p_action: 'billing.webhook_failed',
      p_target_type: 'stripe_webhook',
      p_actor_user_id: null,
      p_actor_role_snapshot: 'system',
      p_target_id: eventId || null,
      p_status: 'error',
      p_error_code: 'STRIPE_WEBHOOK_ERROR',
      p_ip_hash: null,
      p_user_agent: null,
      p_request_id: correlationId,
      p_channel: 'audit',
      p_metadata: {
        event_type: eventType,
        event_id: eventId,
        org_id: orgId,
        error_code: errorCode,
        error_message: errorMessage,
        raw_status: rawStatus,
        timestamp: new Date().toISOString(),
      }
    });

    logStep('Webhook error logged to activity_events', { correlationId });
  } catch (logError) {
    // Don't throw - logging failures shouldn't break the response
    logStep('WARNING: Failed to log webhook error', {
      error: logError instanceof Error ? logError.message : String(logError),
      correlationId
    });
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      status: 204
    })
  }

  const corr = crypto.randomUUID();

  // Track event context for error logging (populated as we parse the webhook)
  let eventId: string | undefined;
  let eventType: string | undefined;
  let resolvedOrgId: string | undefined;
  let supabaseClient: any = null;

  const fail = async (status: number, code: string, message: string, hint?: string, details?: any) => {
    logStep("ERROR", { corr, code, message, hint, details, status });

    // Log error to database if we have a supabase client
    if (supabaseClient) {
      await logWebhookError(supabaseClient, {
        eventId,
        eventType,
        orgId: resolvedOrgId,
        errorCode: code,
        errorMessage: message,
        rawStatus: status,
        correlationId: corr,
      });
    }

    return new Response(JSON.stringify({ corr, code, message, hint, details }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });
  };

  try {
    logStep('Webhook received', { corr })

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    // Initialize supabase client early so we can log errors even for config issues
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (serviceRoleKey && Deno.env.get('SUPABASE_URL')) {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        serviceRoleKey,
        { auth: { persistSession: false } }
      );
    }

    if (!stripeKey) {
      return await fail(500, 'INTERNAL_ERROR', 'STRIPE_SECRET_KEY not configured', 'Configure Stripe secret key in environment');
    }

    if (!webhookSecret) {
      return await fail(500, 'INTERNAL_ERROR', 'STRIPE_WEBHOOK_SECRET not configured', 'Configure Stripe webhook secret in environment');
    }

    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return await fail(400, 'MISSING_SIGNATURE', 'Missing Stripe signature', 'Webhook request must include stripe-signature header');
    }

    if (!serviceRoleKey) {
      return await fail(500, 'SERVICE_ROLE_MISSING', 'Service role key not configured', 'Configure SUPABASE_SERVICE_ROLE_KEY in environment');
    }

    const body = await req.text()
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    // Verify webhook signature
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)

    // Store event context for error logging
    eventId = event.id;
    eventType = event.type;

    logStep('Event verified', { corr, type: event.type, id: event.id })

    // Use the already-initialized supabase client
    const supabase = supabaseClient;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        logStep('Checkout completed', { sessionId: session.id })

        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          await handleSubscriptionUpdate(supabase, stripe, subscription, event.id)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        // Try to resolve org ID early for error logging context
        resolvedOrgId = subscription.metadata.organization_id || subscription.metadata.org_id;
        logStep('Subscription event', {
          type: event.type,
          subscriptionId: subscription.id,
          status: subscription.status
        })
        await handleSubscriptionUpdate(supabase, stripe, subscription, event.id)
        break
      }

      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        logStep('Invoice event', {
          type: event.type,
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription
        })

        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
          await handleSubscriptionUpdate(supabase, stripe, subscription, event.id)
        }
        break
      }

      default:
        logStep('Unhandled event type', { type: event.type })
    }

    return new Response(JSON.stringify({ corr, received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Handle webhook-specific errors
    if (error instanceof Error && error.message.includes('signature')) {
      return await fail(400, 'INVALID_SIGNATURE', 'Invalid webhook signature', 'Verify STRIPE_WEBHOOK_SECRET matches endpoint configuration');
    }

    // Return 500 so Stripe will retry the webhook
    return await fail(500, 'INTERNAL_ERROR', 'Webhook processing failed', 'Check function logs for details', { error: errorMessage });
  }
})

async function handleSubscriptionUpdate(supabase: any, stripe: Stripe, subscription: Stripe.Subscription, eventId: string) {
  try {
    logStep('Handling subscription update', {
      subscriptionId: subscription.id,
      status: subscription.status,
      eventId
    })

    // Check if this event has already been processed (idempotency)
    const { data: existingEvent } = await supabase
      .from('processed_webhook_events')
      .select('id')
      .eq('stripe_event_id', eventId)
      .single()

    if (existingEvent) {
      logStep('Event already processed, skipping', { eventId })
      return
    }

    // Primary: Resolve org via subscription.metadata.organization_id
    let orgId = subscription.metadata.organization_id || subscription.metadata.org_id

    // Fallback: Map customer → organizations.stripe_customer_id
    if (!orgId && subscription.customer) {
      logStep('No org_id in subscription metadata, resolving via customer mapping')

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('stripe_customer_id', subscription.customer)
        .single()

      if (orgError) {
        logStep('Error looking up org by customer', { error: orgError })
      } else if (org) {
        orgId = org.id
        logStep('Resolved org via customer mapping', { orgId, customerId: subscription.customer })
      }
    }

    if (!orgId) {
      logStep('ERROR: Cannot resolve org for subscription', {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        metadata: subscription.metadata
      })
      return
    }

    // Get subscription item details - handle empty items gracefully
    const subscriptionItem = subscription.items.data[0]
    if (!subscriptionItem || !subscription.items.data.length) {
      logStep('WARNING: No subscription items found, using subscription-level defaults', {
        subscriptionId: subscription.id,
        itemCount: subscription.items.data.length
      })
    }

    // Fetch price metadata from Stripe for entitlements (if subscription item exists)
    let priceMetadata = {}
    if (subscriptionItem?.price?.id) {
      try {
        const price = await stripe.prices.retrieve(subscriptionItem.price.id)
        priceMetadata = price.metadata || {}

        logStep('Price metadata retrieved', {
          priceId: price.id,
          metadata: priceMetadata
        })
      } catch (error) {
        logStep('WARNING: Could not retrieve price metadata', {
          priceId: subscriptionItem.price.id,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    // Extract plan_key and product_line from metadata or subscription metadata
    let planKey = priceMetadata.plan_key || subscription.metadata.plan_key
    const productLine = priceMetadata.product_line || subscription.metadata.product_line || 'leadgen'

    // Fallback: Map price ID to plan_key via plan_configs if metadata missing
    if (!planKey && subscriptionItem?.price?.id) {
      try {
        const { data: planConfig } = await supabase
          .from('plan_configs')
          .select('plan_key')
          .or(`stripe_price_id_monthly.eq.${subscriptionItem.price.id},stripe_price_id_yearly.eq.${subscriptionItem.price.id}`)
          .single()

        if (planConfig) {
          planKey = planConfig.plan_key
          logStep('Plan key resolved via price mapping', { priceId: subscriptionItem.price.id, planKey })
        }
      } catch (error) {
        logStep('Could not resolve plan key from price ID', { priceId: subscriptionItem.price.id, error })
      }
    }

    // Default fallback (only if no other method worked)
    if (!planKey) {
      planKey = 'trial'
      logStep('Using fallback plan key', { planKey })
    }

    logStep('Extracted plan info', { planKey, productLine })

    // Build subscription data with safe timestamp conversion and new fields
    const subscriptionData = {
      organization_id: orgId,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      plan_key: planKey,
      product_line: productLine,
      status: subscription.status,
      quantity: subscriptionItem?.quantity || 1,
      current_period_start: subscription.current_period_start ?
        (await supabase.rpc('safe_stripe_timestamp', { stripe_timestamp: subscription.current_period_start })).data : null,
      current_period_end: subscription.current_period_end ?
        (await supabase.rpc('safe_stripe_timestamp', { stripe_timestamp: subscription.current_period_end })).data : null,
      trial_end: subscription.trial_end ?
        (await supabase.rpc('safe_stripe_timestamp', { stripe_timestamp: subscription.trial_end })).data : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      last_event_id: eventId,
      event_processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    logStep('Prepared subscription data', {
      orgId,
      subscriptionId: subscription.id,
      status: subscription.status,
      quantity: subscriptionData.quantity,
      planKey,
      productLine
    })

    // Handle subscription deletion or cancellation
    if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      logStep('Subscription canceled/expired, removing from database', { subscriptionId: subscription.id, status: subscription.status })

      const { error: deleteError } = await supabase
        .from('org_stripe_subscriptions')
        .delete()
        .eq('stripe_subscription_id', subscription.id)

      if (deleteError) {
        logStep('ERROR deleting canceled subscription', {
          error: deleteError,
          subscriptionId: subscription.id
        })
        throw deleteError
      }
    } else {
      // Upsert to org_stripe_subscriptions with idempotency 
      const { error: subUpsertError } = await supabase
        .from('org_stripe_subscriptions')
        .upsert(subscriptionData, {
          onConflict: 'stripe_subscription_id'
        })

      if (subUpsertError) {
        logStep('ERROR upserting to org_stripe_subscriptions', {
          error: subUpsertError,
          subscriptionId: subscription.id,
          subscriptionData
        })
        throw subUpsertError
      }
    }

    // Record event as processed for idempotency
    await supabase
      .from('processed_webhook_events')
      .insert({
        stripe_event_id: eventId,
        event_type: 'subscription_update',
        organization_id: orgId,
        subscription_id: subscription.id
      })

    // Refresh organization billing summary using computed entitlements
    await supabase.rpc('refresh_organization_billing_summary', { p_org_id: orgId })

    logStep('Successfully processed subscription update', {
      orgId,
      subscriptionId: subscription.id,
      status: subscription.status,
      quantity: subscriptionData.quantity,
      planKey,
      productLine,
      eventId
    })

  } catch (error) {
    logStep('ERROR in handleSubscriptionUpdate', {
      error: error instanceof Error ? error.message : String(error),
      subscriptionId: subscription.id
    })
    throw error // Re-throw to ensure webhook returns error status
  }
}
