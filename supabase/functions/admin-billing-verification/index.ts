import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw userError;

    // Check if user is superadmin
    const { data: isSuperadmin } = await supabaseClient.rpc('is_superadmin', { user_id: userData.user.id });
    if (!isSuperadmin) throw new Error("Access denied - superadmin required");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');

      if (action === 'status') {
        // Get org billing status
        const orgId = url.searchParams.get('orgId');
        if (!orgId) throw new Error("orgId required");

        const { data: org } = await supabaseClient
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single();

        const { data: subscription } = await supabaseClient
          .from('org_stripe_subscriptions')
          .select('*')
          .eq('organization_id', orgId)
          .maybeSingle();

        return new Response(JSON.stringify({
          organization: org,
          subscription: subscription
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (action === 'events') {
        // Get recent Stripe events
        const events = await stripe.events.list({ limit: 5 });
        
        return new Response(JSON.stringify({
          events: events.data.map(event => ({
            id: event.id,
            type: event.type,
            created: event.created,
            object: event.data.object
          }))
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (action === 'portal') {
        // Create customer portal session
        const customerId = url.searchParams.get('customerId');
        if (!customerId) throw new Error("customerId required");

        const portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${req.headers.get("origin")}/admin/billing-verification`,
        });

        return new Response(JSON.stringify({ url: portalSession.url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    if (req.method === 'POST') {
      const { planKey, orgId } = await req.json();

      // Get plan configuration
      const { data: planConfig } = await supabaseClient
        .from('plan_configs')
        .select('*')
        .eq('plan_key', planKey)
        .eq('is_active', true)
        .single();

      if (!planConfig || !planConfig.stripe_price_id_monthly) {
        throw new Error(`Plan ${planKey} not configured with Stripe price ID`);
      }

      // Get or create customer
      const customers = await stripe.customers.list({ 
        email: userData.user.email, 
        limit: 1 
      });

      let customerId;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: userData.user.email,
          name: userData.user.user_metadata?.full_name || userData.user.email,
        });
        customerId = customer.id;
      }

      // Create test checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [
          {
            price: planConfig.stripe_price_id_monthly,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${req.headers.get("origin")}/admin/billing-verification?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${req.headers.get("origin")}/admin/billing-verification?canceled=true`,
        metadata: {
          organization_id: orgId,
          plan_key: planKey,
          test_mode: "true"
        }
      });

      return new Response(JSON.stringify({ 
        url: session.url,
        customerId: customerId 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    throw new Error("Method not allowed");

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});