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
    return new Response(null, { headers: corsHeaders })
  }

  try {
    logStep('Webhook received')

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    
    if (!stripeKey || !webhookSecret) {
      throw new Error('Missing Stripe configuration')
    }

    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      throw new Error('Missing Stripe signature')
    }

    const body = await req.text()
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    // Verify webhook signature
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    logStep('Event verified', { type: event.type, id: event.id })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        logStep('Checkout completed', { sessionId: session.id })
        
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          await handleSubscriptionUpdate(supabase, stripe, subscription)
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
        await handleSubscriptionUpdate(supabase, stripe, subscription)
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
          await handleSubscriptionUpdate(supabase, stripe, subscription)
        }
        break
      }

      default:
        logStep('Unhandled event type', { type: event.type })
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logStep('ERROR', { message: errorMessage })
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

async function handleSubscriptionUpdate(supabase: any, stripe: Stripe, subscription: Stripe.Subscription) {
  try {
    logStep('Handling subscription update', { 
      subscriptionId: subscription.id,
      status: subscription.status 
    })

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

    // Get subscription item details
    const subscriptionItem = subscription.items.data[0]
    if (!subscriptionItem) {
      logStep('ERROR: No subscription items found', { subscriptionId: subscription.id })
      return
    }

    // Fetch price metadata from Stripe for entitlements
    const price = await stripe.prices.retrieve(subscriptionItem.price.id)
    const priceMetadata = price.metadata || {}
    
    logStep('Price metadata retrieved', { 
      priceId: price.id, 
      metadata: priceMetadata 
    })

    // Build entitlements from price metadata
    // If no price metadata, derive plan from price ID
    let planKey = priceMetadata.plan_key || 'free'
    let limitAgents = parseInt(priceMetadata.limit_agents || '0') || null
    let limitSeats = parseInt(priceMetadata.limit_seats || '1') || 1
    let features = priceMetadata.features ? JSON.parse(priceMetadata.features) : []
    
    // Fallback: if price metadata is empty, use the environment price IDs to determine plan
    if (!priceMetadata.plan_key && (price.id === Deno.env.get('PRICE_ID_PRO_MONTHLY') || price.id === Deno.env.get('PRICE_ID_PRO_YEARLY'))) {
      planKey = price.id === Deno.env.get('PRICE_ID_PRO_MONTHLY') ? 'pro_monthly' : 'pro_yearly'
      limitAgents = null // unlimited
      limitSeats = 5
      features = ['advanced_analytics', 'priority_support']
      logStep('Using fallback pro plan entitlements', { priceId: price.id, planKey })
    }
    
    const entitlements = {
      plan_key: planKey,
      limit_agents: limitAgents,
      limit_seats: limitSeats,
      features: features,
      ...priceMetadata // Include any other metadata fields
    }

    // Build subscription data with timestamp guards
    const subscriptionData = {
      stripe_subscription_id: subscription.id,
      subscription_item_id: subscriptionItem.id,
      price_id: subscriptionItem.price.id,
      status: subscription.status,
      quantity: subscriptionItem.quantity || 1,
      plan_key: planKey,
      current_period_start: subscription.current_period_start ? 
        new Date(subscription.current_period_start * 1000).toISOString() : null,
      current_period_end: subscription.current_period_end ? 
        new Date(subscription.current_period_end * 1000).toISOString() : null,
      trial_end: subscription.trial_end ? 
        new Date(subscription.trial_end * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString()
    }

    logStep('Prepared subscription data', {
      orgId,
      subscriptionId: subscription.id,
      status: subscription.status,
      quantity: subscriptionData.quantity,
      priceId: subscriptionData.price_id
    })

    // Handle subscription deletion 
    if (subscription.status === 'canceled') {
      logStep('Subscription canceled, removing from database', { subscriptionId: subscription.id })
      
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
        .upsert({
          organization_id: orgId,
          stripe_customer_id: subscription.customer,
          ...subscriptionData
        }, {
          onConflict: 'stripe_subscription_id'  // Ensures idempotency
        })

      if (subUpsertError) {
        logStep('ERROR upserting to org_stripe_subscriptions', { 
          error: subUpsertError,
          subscriptionId: subscription.id 
        })
        throw subUpsertError
      }
    }

    // Mirror key fields to organizations table for UI caching, including entitlements
    const organizationUpdates = {
      billing_status: subscription.status,
      plan_key: planKey,
      current_period_end: subscriptionData.current_period_end,
      cancel_at_period_end: subscriptionData.cancel_at_period_end,
      entitlements: entitlements,
      billing_tier: entitlements.plan_key || 'free',
      updated_at: new Date().toISOString()
    }

    const { error: orgUpdateError } = await supabase
      .from('organizations')
      .update(organizationUpdates)
      .eq('id', orgId)

    if (orgUpdateError) {
      logStep('ERROR updating organizations table', { 
        error: orgUpdateError,
        orgId 
      })
      throw orgUpdateError
    }

    logStep('Successfully processed subscription update', { 
      orgId,
      subscriptionId: subscription.id,
      status: subscription.status,
      quantity: subscriptionData.quantity,
      priceId: subscriptionData.price_id
    })

  } catch (error) {
    logStep('ERROR in handleSubscriptionUpdate', { 
      error: error instanceof Error ? error.message : String(error),
      subscriptionId: subscription.id 
    })
    throw error // Re-throw to ensure webhook returns error status
  }
}