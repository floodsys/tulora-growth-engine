import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ORG-BILLING-WEBHOOK] ${step}${detailsStr}`);
}

serve(async (req) => {
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

  const fail = (status: number, code: string, message: string, hint?: string, details?: any) => {
    logStep("ERROR", { corr, code, message, hint, details, status });
    return new Response(JSON.stringify({ corr, code, message, hint, details }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });
  };

  try {
    logStep('Webhook received', { corr })

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    
    if (!stripeKey) {
      return fail(500, 'INTERNAL_ERROR', 'STRIPE_SECRET_KEY not configured', 'Configure Stripe secret key in environment');
    }
    
    if (!webhookSecret) {
      return fail(500, 'INTERNAL_ERROR', 'STRIPE_WEBHOOK_SECRET not configured', 'Configure Stripe webhook secret in environment');
    }

    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return fail(400, 'MISSING_SIGNATURE', 'Missing Stripe signature', 'Webhook request must include stripe-signature header');
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return fail(500, 'SERVICE_ROLE_MISSING', 'Service role key not configured', 'Configure SUPABASE_SERVICE_ROLE_KEY in environment');
    }

    const body = await req.text()
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    // Verify webhook signature
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    logStep('Event verified', { corr, type: event.type, id: event.id })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

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
      return fail(400, 'INVALID_SIGNATURE', 'Invalid webhook signature', 'Verify STRIPE_WEBHOOK_SECRET matches endpoint configuration');
    }
    
    return fail(500, 'INTERNAL_ERROR', 'Webhook processing failed', 'Check function logs for details', { error: errorMessage });
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
    const planKey = priceMetadata.plan_key || subscription.metadata.plan_key || 'trial'
    const productLine = priceMetadata.product_line || subscription.metadata.product_line || 'leadgen'
    
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