import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutRequest {
  planKey: string;
  interval: 'monthly' | 'yearly';
  organizationId: string;
  quantity?: number;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-STRIPE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    logStep("Stripe key verified");

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      throw new Error(`Authentication error: ${userError.message}`);
    }
    const user = userData.user;
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const body: CheckoutRequest = await req.json();
    logStep("Request parsed", body);

    // Verify user is admin of the organization
    const { data: membership, error: memberError } = await supabaseClient
      .from('organization_members')
      .select('role')
      .eq('organization_id', body.organizationId)
      .eq('user_id', user.id)
      .eq('seat_active', true)
      .single();

    if (memberError || membership?.role !== 'admin') {
      throw new Error("User is not an admin of this organization");
    }
    logStep("User admin role verified");

    // Get plan configuration
    const { data: planConfig, error: planError } = await supabaseClient
      .from('plan_configs')
      .select('*')
      .eq('plan_key', body.planKey)
      .single();

    if (planError || !planConfig) {
      throw new Error(`Plan not found: ${body.planKey}`);
    }
    logStep("Plan config retrieved", { planKey: body.planKey });

    // Get or create Stripe customer
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
          organization_id: body.organizationId
        }
      });
      customerId = customer.id;
      logStep("New customer created", { customerId });
    }

    // Determine price ID
    const priceId = body.interval === 'yearly' 
      ? planConfig.stripe_price_id_yearly 
      : planConfig.stripe_price_id_monthly;

    if (!priceId) {
      throw new Error(`No Stripe price ID configured for ${body.planKey} ${body.interval}`);
    }
    logStep("Price ID determined", { priceId, interval: body.interval });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{
        price: priceId,
        quantity: body.quantity || 1,
      }],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/dashboard?checkout_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/dashboard?checkout_canceled=true`,
      metadata: {
        organization_id: body.organizationId,
        plan_key: body.planKey,
        user_id: user.id
      },
      subscription_data: {
        metadata: {
          organization_id: body.organizationId,
          plan_key: body.planKey,
          user_id: user.id
        }
      }
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});