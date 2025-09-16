import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReconcileRequest {
  orgId: string
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-BILLING-RECONCILE] ${step}${detailsStr}`);
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
    logStep('Function started', { corr })

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return fail(500, 'SERVICE_ROLE_MISSING', 'Service role key not configured', 'Configure SUPABASE_SERVICE_ROLE_KEY in environment');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    // Verify admin access
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return fail(401, 'UNAUTHORIZED', 'No authorization header', 'Include Authorization header with Bearer token');
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return fail(401, 'UNAUTHORIZED', 'Invalid or expired token', 'Sign in again with valid credentials');
    }

    let body: ReconcileRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      return fail(400, 'INVALID_JSON', 'Invalid JSON in request body', 'Ensure request body contains valid JSON');
    }

    const { orgId } = body;
    if (!orgId || orgId.trim() === '') {
      return fail(400, 'ORG_ID_MISSING', 'Organization ID is required', 'Provide a valid organization ID');
    }

    logStep('Request data', { corr, orgId })

    // Verify user has admin access to this org or is superadmin
    const { data: superadminCheck } = await supabase
      .from('superadmins')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .single()

    const isSuperadmin = !!superadminCheck

    if (!isSuperadmin) {
      // Check org admin access
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', userData.user.id)
        .single()

      const { data: orgOwnership } = await supabase
        .from('organizations')
        .select('owner_user_id')
        .eq('id', orgId)
        .single()

      const isOrgAdmin = membership?.role === 'admin' || orgOwnership?.owner_user_id === userData.user.id

      if (!isOrgAdmin) {
        return fail(403, 'FORBIDDEN', 'Insufficient permissions', 'Only organization admins or superadmins can reconcile billing');
      }
    }

    logStep('Admin access verified', { corr, userId: userData.user.id, isSuperadmin })

    // Get Stripe key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return fail(500, 'INTERNAL_ERROR', 'STRIPE_SECRET_KEY not configured', 'Configure Stripe secret key in environment');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    // Search for completed checkout sessions with this orgId
    logStep('Searching for checkout sessions', { corr, orgId })
    
    const sessions = await stripe.checkout.sessions.list({
      limit: 10,
      expand: ['data.subscription', 'data.customer']
    })

    // Find sessions that match our orgId
    const matchingSessions = sessions.data.filter(session => 
      session.status === 'complete' &&
      (session.client_reference_id === orgId || 
       session.metadata?.org_id === orgId || 
       session.metadata?.organization_id === orgId)
    )

    if (matchingSessions.length === 0) {
      return fail(404, 'NO_CHECKOUT_SESSIONS', 'No completed checkout sessions found for this organization', `No Stripe checkout sessions found for organization ${orgId}`);
    }

    // Get the most recent session
    const latestSession = matchingSessions.sort((a, b) => b.created - a.created)[0]
    logStep('Found matching session', { 
      corr,
      sessionId: latestSession.id, 
      created: latestSession.created 
    })

    const customer = latestSession.customer as Stripe.Customer
    const subscription = latestSession.subscription as Stripe.Subscription

    if (!customer || !subscription) {
      return fail(400, 'INCOMPLETE_SESSION_DATA', 'Session missing customer or subscription data', 'Checkout session does not contain required customer and subscription information');
    }

    // Extract plan key from subscription metadata or map from price ID
    let planKey = subscription.metadata?.plan_key

    if (!planKey) {
      // Fallback: map price ID to plan key
      const priceId = subscription.items.data[0]?.price?.id
      if (priceId) {
        const { data: planConfig } = await supabase
          .from('plan_configs')
          .select('plan_key')
          .eq('stripe_price_id_monthly', priceId)
          .single()
        
        planKey = planConfig?.plan_key
      }
    }

    if (!planKey) {
      return fail(400, 'PLAN_KEY_MISSING', 'Could not determine plan key from subscription', 'Subscription metadata missing plan_key and no matching plan found for price ID');
    }

    logStep('Reconciliation data', { 
      customerId: customer.id, 
      planKey, 
      subscriptionId: subscription.id 
    })

    // Update organization
    const { error: orgUpdateError } = await supabase
      .from('organizations')
      .update({
        stripe_customer_id: customer.id,
        plan_key: planKey,
        billing_status: subscription.status
      })
      .eq('id', orgId)

    if (orgUpdateError) {
      throw orgUpdateError
    }

    // Upsert org_stripe_subscriptions
    const { error: subUpsertError } = await supabase
      .from('org_stripe_subscriptions')
      .upsert({
        organization_id: orgId,
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        plan_key: planKey,
        product_line: subscription.metadata?.product_line || 'leadgen',
        current_period_start: subscription.current_period_start ? 
          new Date(subscription.current_period_start * 1000).toISOString() : null,
        current_period_end: subscription.current_period_end ? 
          new Date(subscription.current_period_end * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? 
          new Date(subscription.trial_end * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        quantity: subscription.items.data[0]?.quantity || 1
      }, {
        onConflict: 'organization_id,stripe_subscription_id'
      })

    if (subUpsertError) {
      throw subUpsertError
    }

    // Log the reconciliation
    await supabase.rpc('log_event', {
      p_org_id: orgId,
      p_action: 'billing.reconciled',
      p_target_type: 'subscription',
      p_target_id: subscription.id,
      p_actor_user_id: userData.user.id,
      p_actor_role_snapshot: isSuperadmin ? 'superadmin' : 'admin',
      p_metadata: {
        session_id: latestSession.id,
        customer_id: customer.id,
        plan_key: planKey,
        reconciled_by: 'admin_action'
      }
    })

    logStep('Reconciliation complete', { 
      orgId, 
      customerId: customer.id, 
      planKey 
    })

    return new Response(JSON.stringify({ 
      corr,
      updated: true, 
      customerId: customer.id, 
      planKey,
      subscriptionId: subscription.id,
      sessionId: latestSession.id,
      message: `Successfully reconciled billing for organization ${orgId}`,
      details: {
        session_created: new Date(latestSession.created * 1000).toISOString(),
        subscription_status: subscription.status,
        customer_email: customer.email
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // Handle Stripe-specific errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid API Key')) {
        return fail(500, 'INTERNAL_ERROR', 'Invalid Stripe API key', 'Check STRIPE_SECRET_KEY configuration');
      }
      
      if (error.message.includes('restricted')) {
        return fail(403, 'INSUFFICIENT_STRIPE_PERMISSIONS', 'Stripe key has insufficient permissions', 'Use a Stripe key with full access permissions');
      }
    }
    
    return fail(500, 'INTERNAL_ERROR', 'Unexpected server error', 'Check function logs for details', { error: errorMessage });
  }
})