import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireOrgIpAllowed, createIpBlockedResponse } from '../_shared/org-guard.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PortalRequest {
  orgId: string
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ORG-CUSTOMER-PORTAL] ${step}${detailsStr}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return fail(500, 'INTERNAL_ERROR', 'STRIPE_SECRET_KEY not configured', 'Configure Stripe secret key in environment');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return fail(401, 'UNAUTHORIZED', 'No authorization header provided', 'Include Authorization header with Bearer token');
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return fail(401, 'UNAUTHORIZED', 'User not authenticated', 'Invalid or expired token');
    }

    const { orgId }: PortalRequest = await req.json()
    if (!orgId) {
      return fail(400, 'ORG_ID_MISSING', 'Organization ID is required', 'Include orgId in request body');
    }
    
    logStep('Request data', { corr, orgId, userId: userData.user.id })

    // Verify user has admin access to this org
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userData.user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return fail(401, 'UNAUTHORIZED', 'Insufficient permissions', 'User must be organization owner or admin');
    }

    // Check IP allowlist
    const ipGuardResult = await requireOrgIpAllowed(req, orgId, supabase)
    if (!ipGuardResult.ok) {
      const ipCorr = crypto.randomUUID()
      console.log(`[${ipCorr}] IP blocked for org ${orgId}: ${ipGuardResult.clientIp}`)
      return createIpBlockedResponse(ipGuardResult, corsHeaders, ipCorr)
    }

    // Get organization with Stripe customer ID
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', orgId)
      .single()

    if (!org || !org.stripe_customer_id) {
      return fail(400, 'NO_CUSTOMER', 'Organization has no Stripe customer ID', 'Complete a checkout session first to create Stripe customer');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    // Create customer portal session
    const origin = req.headers.get('origin') || 'http://localhost:3000'
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${origin}/dashboard/billing`,
    })

    logStep('Customer portal session created', { 
      corr,
      sessionId: portalSession.id, 
      url: portalSession.url,
      customerId: org.stripe_customer_id
    })

    return new Response(JSON.stringify({ 
      corr,
      url: portalSession.url,
      customerId: org.stripe_customer_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logStep('ERROR', { corr, message: errorMessage })
    return fail(500, 'INTERNAL_ERROR', errorMessage, 'Unexpected error occurred');
  }
})