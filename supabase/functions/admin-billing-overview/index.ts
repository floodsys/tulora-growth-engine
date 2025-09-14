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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Use ANON client with user's auth header
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { 
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Check if user is superadmin using USER context (not service role)
    const { data: isSuperadmin, error: superadminError } = await supabaseClient.rpc('is_superadmin', { user_id: userData.user.id });
    if (superadminError || !isSuperadmin) {
      logStep("Superadmin check failed", { error: superadminError, isSuperadmin });
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Get user info for logging
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    logStep("Superadmin access verified", { userId: user.id, email: user.email });

    let body: OverviewRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Invalid JSON in request body",
        hint: "Ensure request body contains valid JSON",
        cause: "parse_error"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!body.action) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Missing required action field",
        hint: "Include 'action' field with one of: list_subscriptions, list_invoices, list_webhook_events",
        cause: "missing_action"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    switch (body.action) {
      case 'list_subscriptions': {
        logStep("Listing subscriptions");
        
        try {
          // First, test Stripe connectivity with a simple call
          const account = await stripe.accounts.retrieve();
          logStep("Stripe account verified", { 
            id: account.id, 
            livemode: account.livemode, 
            type: account.type 
          });
          
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

          if (subsError) {
            logStep("Database error retrieving subscriptions", { error: subsError });
            return new Response(JSON.stringify({
              ok: false,
              error: "Database query failed",
              hint: "Check org_stripe_subscriptions table structure",
              cause: "database_error",
              meta: {
                stripe_account: account.id,
                stripe_mode: account.livemode ? 'live' : 'test'
              }
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }

          if (!subscriptions || subscriptions.length === 0) {
            logStep("No subscriptions found in database");
            return new Response(JSON.stringify({
              ok: true,
              data: [],
              meta: {
                stripe_account: account.id,
                stripe_mode: account.livemode ? 'live' : 'test',
                total_subscriptions: 0
              }
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }

          // Test Stripe subscriptions access with first record
          const testSub = subscriptions[0];
          let stripeTestResult = null;
          try {
            const testStripeSub = await stripe.subscriptions.retrieve(testSub.stripe_subscription_id);
            stripeTestResult = {
              subscription_id: testStripeSub.id,
              status: testStripeSub.status,
              customer_id: testStripeSub.customer
            };
            logStep("Stripe subscription test successful", stripeTestResult);
          } catch (stripeError) {
            logStep("Stripe subscription test failed", { error: stripeError.message });
            return new Response(JSON.stringify({
              ok: false,
              error: "Stripe subscription access failed",
              hint: "Check if subscription IDs in database match Stripe records",
              cause: "stripe_subscription_error",
              meta: {
                stripe_account: account.id,
                stripe_mode: account.livemode ? 'live' : 'test',
                test_subscription_id: testSub.stripe_subscription_id,
                stripe_error: stripeError.message
              }
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }

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
                let priceInfo = null;
                if (sub.status === 'active' && stripeSub.items.data[0]) {
                  const price = stripeSub.items.data[0].price;
                  priceInfo = {
                    price_id: price.id,
                    unit_amount: price.unit_amount,
                    currency: price.currency,
                    interval: price.recurring?.interval
                  };
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
                  mrr,
                  price_info: priceInfo
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
                  mrr: 0,
                  price_info: null,
                  enrichment_error: error.message
                };
              }
            })
          );

          return new Response(JSON.stringify({
            ok: true,
            data: enrichedSubscriptions,
            meta: {
              stripe_account: account.id,
              stripe_mode: account.livemode ? 'live' : 'test',
              total_subscriptions: enrichedSubscriptions.length,
              stripe_test_result: stripeTestResult
            }
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
          
        } catch (stripeError) {
          logStep("Stripe connectivity failed", { error: stripeError.message });
          return new Response(JSON.stringify({
            ok: false,
            error: "Stripe API connectivity failed",
            hint: "Check STRIPE_SECRET_KEY configuration and network connectivity",
            cause: "stripe_connectivity_error",
            meta: {
              stripe_error: stripeError.message,
              timestamp: new Date().toISOString()
            }
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
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
        return new Response(JSON.stringify({
          ok: false,
          error: `Unsupported action: ${body.action}`,
          hint: "Use one of: list_subscriptions, list_invoices, list_webhook_events",
          cause: "invalid_action"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    // Categorize error types
    if (error instanceof Error) {
      if (error.message.includes('STRIPE_SECRET_KEY')) {
        return new Response(JSON.stringify({
          ok: false,
          error: "Stripe configuration missing",
          hint: "Configure STRIPE_SECRET_KEY in edge function secrets",
          cause: "stripe_config_missing"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }
      
      if (error.message.includes('No such') && error.message.includes('subscription')) {
        return new Response(JSON.stringify({
          ok: false,
          error: "Stripe subscription not found",
          hint: "Subscription may have been deleted from Stripe dashboard",
          cause: "stripe_subscription_missing"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }
    
    // Generic server error
    return new Response(JSON.stringify({
      ok: false,
      error: "Unexpected server error",
      hint: "Check function logs for details",
      cause: "server_error"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});