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
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
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

    // Get org ID - prefer subscription metadata, fallback to customer mapping
    let orgId = subscription.metadata.org_id
    
    if (!orgId && subscription.customer) {
      logStep('No org_id in subscription metadata, looking up via customer')
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('stripe_customer_id', subscription.customer)
        .single()
      
      if (org) {
        orgId = org.id
        logStep('Found org via customer mapping', { orgId, customerId: subscription.customer })
      }
    }

    if (!orgId) {
      logStep('ERROR: Cannot map subscription to organization', { 
        subscriptionId: subscription.id,
        customerId: subscription.customer 
      })
      return
    }

    // Get subscription item (first one - assuming single line item for seats)
    const subscriptionItem = subscription.items.data[0]
    const quantity = subscriptionItem?.quantity || 1

    logStep('Processing subscription data', {
      orgId,
      subscriptionId: subscription.id,
      status: subscription.status,
      quantity,
      priceId: subscriptionItem?.price?.id
    })

    // Update organizations table (cache for UI)
    const { error: orgUpdateError } = await supabase
      .from('organizations')
      .update({
        billing_status: subscription.status,
        billing_tier: subscription.status === 'active' ? 'pro' : 'free',
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString()
      })
      .eq('id', orgId)

    if (orgUpdateError) {
      logStep('ERROR updating organizations table', { error: orgUpdateError })
    }

    // Upsert subscription record with idempotency
    const subscriptionData = {
      org_id: orgId,
      stripe_subscription_id: subscription.id,
      product_id: subscriptionItem?.price?.product as string,
      price_id: subscriptionItem?.price?.id,
      subscription_item_id: subscriptionItem?.id,
      status: subscription.status,
      quantity: quantity,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString()
    }

    const { error: subUpdateError } = await supabase
      .from('org_subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'stripe_subscription_id'
      })

    if (subUpdateError) {
      logStep('ERROR updating org_subscriptions table', { error: subUpdateError })
    } else {
      logStep('Successfully updated subscription in database', { 
        orgId, 
        status: subscription.status, 
        quantity 
      })
    }

  } catch (error) {
    logStep('ERROR in handleSubscriptionUpdate', { 
      error: error instanceof Error ? error.message : String(error),
      subscriptionId: subscription.id 
    })
  }
}