import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckoutRequest {
  orgId: string
  planKey: string
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-ORG-CHECKOUT] ${step}${detailsStr}`);
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
  let isLiveKey = false;
  let orgId: string | undefined;
  let planKey: string | undefined;
  let priceId: string | undefined;

  const fail = (status: number, code: string, hint?: string) => {
    const message = hint ?? "Checkout failed";
    console.log("[checkout:fail]", { corr, code, message, isLiveKey, orgId, planKey, priceId, status });
    return new Response(JSON.stringify({ corr, code, message, isLiveKey, orgId, planKey, priceId }), {
      status,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  };

  try {
    const corr = crypto.randomUUID();
    console.log("[checkout:start]", { corr });
    
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return fail(500, 'INTERNAL_ERROR', 'STRIPE_SECRET_KEY is not set')

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) return fail(500, 'SERVICE_ROLE_MISSING', 'Service role key not configured')

    // Detect Stripe key mode
    isLiveKey = stripeKey.startsWith('sk_live_')
    console.log('[checkout:start]', { corr, isLiveKey })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return fail(401, 'UNAUTHORIZED', 'No authorization header provided')

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) return fail(401, 'UNAUTHORIZED', 'User not authenticated')

    let checkoutRequest: CheckoutRequest = await req.json()
    orgId = checkoutRequest.orgId
    planKey = checkoutRequest.planKey
    
    // Early capture of key context for debugging
    console.log('[checkout:request]', { corr, orgId, planKey })

    // Require non-empty orgId with fallback
    if (!orgId || orgId.trim() === '') {
      // Try to get user's default organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_org_id')
        .eq('user_id', userData.user.id)
        .single()
      
      if (profile?.current_org_id) {
        orgId = profile.current_org_id
        logStep('Using fallback orgId from profile', { orgId })
      } else {
        // Check if user has any org memberships
        const { data: memberships } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', userData.user.id)
          .eq('seat_active', true)
          .limit(1)
        
        if (memberships?.[0]?.organization_id) {
          orgId = memberships[0].organization_id
          logStep('Using fallback orgId from membership', { orgId })
        } else {
          return fail(400, 'ORG_ID_MISSING', 'Select an organization before checkout.')
        }
      }
    }

    // Verify user has admin access to this org
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userData.user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return fail(401, 'UNAUTHORIZED', 'Insufficient permissions')
    }

    // Get organization details
    const { data: org } = await supabase
      .from('organizations')
      .select('name, stripe_customer_id')
      .eq('id', orgId)
      .single()

    if (!org) return fail(400, 'ORG_NOT_FOUND', 'Organization not found')

    // Create Stripe instance for customer validation
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    // Validate and normalize stored customer ID
    let customerId = org?.stripe_customer_id ?? null;
    try {
      if (customerId) {
        const existing = await stripe.customers.retrieve(customerId as string);
        // If deleted/flagged, treat as missing
        // @ts-ignore
        if ((existing as any)?.deleted === true) customerId = null;
      }
    } catch (err: any) {
      // Stripe "No such customer" → treat as missing
      if (err?.statusCode === 404 || err?.code === "resource_missing") {
        customerId = null;
      } else {
        console.log("[checkout:customer_retrieve_error]", { corr, code: err?.code, msg: err?.message });
        // fall through; we'll let checkout continue if we can
      }
    }

    // Get plan configuration
    const { data: planConfig, error: planError } = await supabase
      .from('plan_configs')
      .select('*')
      .eq('plan_key', planKey)
      .eq('is_active', true)
      .single()

    if (planError || !planConfig) {
      return fail(400, 'PLAN_NOT_FOUND', `Plan ${planKey} not found or inactive`)
    }

    logStep('Found plan config', { 
      planKey, 
      productLine: planConfig.product_line
    })

    // Use monthly subscription price
    priceId = planConfig.stripe_price_id_monthly
    console.log('[checkout:plan-resolved]', { corr, orgId, planKey, priceId, productLine: planConfig.product_line })
    const isDevelopment = Deno.env.get('NODE_ENV') !== 'production'
    
    // Verify plan & price mapping before creating a Session
    if (!priceId && !isDevelopment) {
      return fail(400, 'PRICE_NOT_CONFIGURED', 'Configure live Price ID in Admin → Stripe Configuration.')
    }

    // Stripe instance already created above for customer validation

    // Verify price exists in Stripe if we have a priceId
    if (priceId) {
      try {
        await stripe.prices.retrieve(priceId)
        logStep('Verified price exists in Stripe', { priceId })
      } catch (stripeError: any) {
        if (stripeError.code === 'resource_missing') {
          return fail(400, 'NO_SUCH_PRICE', 'Price ID and Stripe key are in different modes (test vs live).')
        }
        return fail(502, 'STRIPE_ERROR', `Stripe API error: ${stripeError.message}`)
      }
    }

    // Create or get Stripe customer (using validated customerId from above)
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: { org_id: orgId }
      })
      customerId = customer.id
      
      // Update org with customer ID
      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', orgId)
      
      logStep('Created new Stripe customer', { customerId })
    }

    // Prepare line items - subscription + optional setup fee
    let lineItems;
    
    if (priceId) {
      // Use configured Stripe Price ID
      logStep('Using configured subscription price ID', { planKey, priceId })
      lineItems = [{
        price: priceId,
        quantity: 1, // Default to 1 seat, can be adjusted later via Stripe portal
      }];
    } else if (isDevelopment) {
      // Dev-only fallback: create dynamic test price
      logStep('Using dynamic test price for dev environment', { planKey })
      lineItems = [{
        price_data: {
          currency: 'usd',
          unit_amount: 1000, // $10.00 test price
          recurring: {
            interval: 'month'
          },
          product_data: {
            name: `${planKey} (Test)`
          }
        },
        quantity: 1
      }];
    }

    // Add setup fee if enabled and configured
    if (planConfig.bill_setup_fee_in_stripe && planConfig.stripe_setup_price_id) {
      logStep('Adding setup fee to checkout', { setupPriceId: planConfig.stripe_setup_price_id });
      lineItems.push({
        price: planConfig.stripe_setup_price_id,
        quantity: 1
      });
    } else if (planConfig.bill_setup_fee_in_stripe && !planConfig.stripe_setup_price_id) {
      logStep('Setup fee billing enabled but no setup price ID configured', { planKey });
    }

    // Get APP_ORIGIN for success/cancel URLs
    const appOrigin = Deno.env.get('APP_ORIGIN') || req.headers.get('origin') || 'http://localhost:3000'
    
    // Consistent metadata for reconciliation
    const metadata = {
      org_id: orgId,
      plan_key: planKey,
      product_line: planConfig.product_line,
      organization_id: orgId // Keep both for compatibility
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: orgId, // For reliable org mapping
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${appOrigin}/dashboard?checkout_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin}/dashboard?checkout_canceled=true`,
      metadata,
      subscription_data: {
        metadata
      }
    })

    console.log('[checkout:ok]', { corr, isLiveKey, orgId, planKey, priceId, sessionId: session.id })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    // Handle Stripe SDK errors
    if (error.type && error.type.startsWith('Stripe')) {
      return fail(502, 'STRIPE_ERROR', `Stripe API error: ${error.message}`)
    }
    
    // Generic internal error fallback
    return fail(500, 'INTERNAL_ERROR', error.message || 'Unknown error occurred')
  }
})