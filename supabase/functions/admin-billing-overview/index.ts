import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OverviewRequest {
  action: 'list_subscriptions' | 'list_invoices' | 'list_webhook_events';
  limit?: number;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-BILLING-OVERVIEW] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    // TODO: Add proper admin role check
    logStep("User authenticated", { userId: user.id, email: user.email });

    const body: OverviewRequest = await req.json();
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    switch (body.action) {
      case 'list_subscriptions': {
        logStep("Listing subscriptions");
        
        // Get all subscriptions from Supabase
        const { data: subscriptions, error: subsError } = await supabaseClient
          .from('org_stripe_subscriptions')
          .select(`
            *,
            organizations!inner(
              id,
              name,
              owner_user_id,
              profiles!inner(email)
            )
          `)
          .order('created_at', { ascending: false });

        if (subsError) throw subsError;

        // Enhance with Stripe data
        const enrichedSubscriptions = await Promise.all(
          subscriptions.map(async (sub) => {
            try {
              // Get Stripe subscription details
              const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
              
              // Get customer payment methods
              const paymentMethods = await stripe.paymentMethods.list({
                customer: sub.stripe_customer_id,
                type: 'card',
              });

              // Calculate MRR based on plan
              let mrr = 0;
              if (sub.status === 'active' && stripeSub.items.data[0]) {
                const price = stripeSub.items.data[0].price;
                if (price.recurring?.interval === 'month') {
                  mrr = (price.unit_amount || 0) / 100;
                } else if (price.recurring?.interval === 'year') {
                  mrr = ((price.unit_amount || 0) / 100) / 12;
                }
              }

              return {
                id: sub.id,
                organization_id: sub.organization_id,
                organization_name: sub.organizations.name,
                owner_email: sub.organizations.profiles.email,
                plan_key: sub.plan_key,
                status: sub.status,
                current_period_start: stripeSub.current_period_start ? 
                  new Date(stripeSub.current_period_start * 1000).toISOString() : null,
                current_period_end: stripeSub.current_period_end ? 
                  new Date(stripeSub.current_period_end * 1000).toISOString() : null,
                quantity: sub.quantity,
                payment_method_exists: paymentMethods.data.length > 0,
                past_due: stripeSub.status === 'past_due',
                stripe_customer_id: sub.stripe_customer_id,
                stripe_subscription_id: sub.stripe_subscription_id,
                mrr
              };
            } catch (error) {
              logStep("Error enriching subscription", { subId: sub.id, error: error.message });
              return {
                id: sub.id,
                organization_id: sub.organization_id,
                organization_name: sub.organizations.name,
                owner_email: sub.organizations.profiles.email,
                plan_key: sub.plan_key,
                status: sub.status,
                current_period_start: null,
                current_period_end: null,
                quantity: sub.quantity,
                payment_method_exists: false,
                past_due: false,
                stripe_customer_id: sub.stripe_customer_id,
                stripe_subscription_id: sub.stripe_subscription_id,
                mrr: 0
              };
            }
          })
        );

        return new Response(JSON.stringify(enrichedSubscriptions), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case 'list_invoices': {
        logStep("Listing invoices");
        
        const invoices = await stripe.invoices.list({
          limit: body.limit || 50,
          expand: ['data.subscription']
        });

        const formattedInvoices = invoices.data.map(invoice => ({
          id: invoice.id,
          amount_paid: invoice.amount_paid,
          currency: invoice.currency,
          status: invoice.status,
          created: invoice.created,
          period_start: invoice.period_start,
          period_end: invoice.period_end,
          hosted_invoice_url: invoice.hosted_invoice_url,
          customer_email: invoice.customer_email
        }));

        return new Response(JSON.stringify(formattedInvoices), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case 'list_webhook_events': {
        logStep("Listing webhook events");
        
        const events = await stripe.events.list({
          limit: body.limit || 20,
          types: [
            'customer.subscription.created',
            'customer.subscription.updated',
            'customer.subscription.deleted',
            'invoice.paid',
            'invoice.payment_failed',
            'checkout.session.completed'
          ]
        });

        const formattedEvents = events.data.map(event => ({
          id: event.id,
          type: event.type,
          created: event.created,
          livemode: event.livemode,
          api_version: event.api_version
        }));

        return new Response(JSON.stringify(formattedEvents), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});