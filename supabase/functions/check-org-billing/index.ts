import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckBillingRequest {
  orgId: string
}

interface BillingStatus {
  billing_status: string
  current_period_end: string | null
  price_id: string | null
  quantity: number
  plan_key: string | null
  billing_tier: string
  entitlements: Record<string, any>
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-ORG-BILLING] ${step}${detailsStr}`);
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

    const { orgId }: CheckBillingRequest = await req.json()
    logStep('Request data', { orgId })

    // Verify user has access to this org
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userData.user.id)
      .single()

    if (!membership) {
      throw new Error('No access to organization')
    }

    // Get organization details including cached billing info and entitlements
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id, billing_status, billing_tier, current_period_end, cancel_at_period_end, entitlements')
      .eq('id', orgId)
      .single()

    if (!org) throw new Error('Organization not found')

    // Get most recent subscription from database
    const { data: dbSubscription } = await supabase
      .from('org_subscriptions')
      .select('*')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    // Initialize billing status with defaults
    let billingStatus: BillingStatus = {
      billing_status: 'inactive',
      current_period_end: null,
      price_id: null,
      quantity: 0,
      plan_key: null,
      billing_tier: org.billing_tier || 'free',
      entitlements: org.entitlements || {}
    }

    // If we have a subscription in the database, use it as base
    if (dbSubscription) {
      billingStatus = {
        billing_status: dbSubscription.status,
        current_period_end: dbSubscription.current_period_end,
        price_id: dbSubscription.price_id,
        quantity: dbSubscription.quantity || 0,
        plan_key: null, // Will fetch from Stripe
        billing_tier: org.billing_tier || 'free',
        entitlements: org.entitlements || {}
      }
      
      logStep('Using database subscription data', {
        subscriptionId: dbSubscription.stripe_subscription_id,
        status: dbSubscription.status,
        quantity: dbSubscription.quantity
      })
    }

    // Fetch fresh data from Stripe if we have a customer ID
    if (org.stripe_customer_id && dbSubscription?.stripe_subscription_id) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
        
        // Get the specific subscription
        const subscription = await stripe.subscriptions.retrieve(dbSubscription.stripe_subscription_id)
        const subscriptionItem = subscription.items.data[0]
        
        if (subscriptionItem?.price?.id) {
          // Get price details including metadata
          const price = await stripe.prices.retrieve(subscriptionItem.price.id)
          
          // Build fresh entitlements from price metadata
          const entitlements = {
            plan_key: price.metadata?.plan_key || 'free',
            limit_agents: parseInt(price.metadata?.limit_agents || '0') || null,
            limit_seats: parseInt(price.metadata?.limit_seats || '1') || 1,
            features: price.metadata?.features ? JSON.parse(price.metadata.features) : [],
            ...price.metadata // Include any other metadata fields
          }
          
          billingStatus = {
            billing_status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            price_id: price.id,
            quantity: subscriptionItem.quantity || 0,
            plan_key: price.metadata?.plan_key || null,
            billing_tier: entitlements.plan_key || 'free',
            entitlements
          }
          
          logStep('Updated from Stripe with plan metadata', {
            subscriptionId: subscription.id,
            status: subscription.status,
            priceId: price.id,
            planKey: price.metadata?.plan_key,
            quantity: subscriptionItem.quantity
          })
        }
      } catch (stripeError) {
        logStep('Error fetching from Stripe, using cached data', { 
          error: stripeError instanceof Error ? stripeError.message : String(stripeError) 
        })
        // Continue with database/cached data
      }
    }

    logStep('Final billing status', billingStatus)

    return new Response(JSON.stringify(billingStatus), {
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