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

    // Get organization details
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id, billing_status, billing_tier, current_period_end, cancel_at_period_end')
      .eq('id', orgId)
      .single()

    if (!org) throw new Error('Organization not found')

    let billingInfo = {
      billing_status: org.billing_status || 'inactive',
      billing_tier: org.billing_tier || 'free',
      current_period_end: org.current_period_end,
      cancel_at_period_end: org.cancel_at_period_end || false,
      seats: 0,
      active_subscriptions: []
    }

    // If org has Stripe customer, fetch latest data
    if (org.stripe_customer_id) {
      const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
      
      // Get active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: org.stripe_customer_id,
        status: 'active',
        limit: 10,
      })

      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0] // Get first active subscription
        const subscriptionItem = subscription.items.data[0]
        
        billingInfo = {
          billing_status: subscription.status,
          billing_tier: subscription.status === 'active' ? 'pro' : 'free',
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          seats: subscriptionItem?.quantity || 0,
          active_subscriptions: subscriptions.data.map(sub => ({
            id: sub.id,
            status: sub.status,
            quantity: sub.items.data[0]?.quantity || 0,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString()
          }))
        }

        // Update cached billing info in database
        await supabase
          .from('organizations')
          .update({
            billing_status: subscription.status,
            billing_tier: subscription.status === 'active' ? 'pro' : 'free',
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('id', orgId)

        logStep('Updated billing info from Stripe', billingInfo)
      }
    }

    // Get subscription details from database
    const { data: dbSubscriptions } = await supabase
      .from('org_subscriptions')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'active')

    // Get member count
    const { count: memberCount } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('seat_active', true)

    logStep('Retrieved billing info', { 
      ...billingInfo, 
      memberCount,
      dbSubscriptions: dbSubscriptions?.length || 0 
    })

    return new Response(JSON.stringify({
      ...billingInfo,
      member_count: memberCount || 0,
      db_subscriptions: dbSubscriptions || []
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