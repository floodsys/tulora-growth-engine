import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from '../_shared/cors.ts'

interface OverviewRequest {
  action: 'list_subscriptions' | 'list_invoices' | 'list_webhook_events';
  limit?: number;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-BILLING-OVERVIEW] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      headers: { 
        ...corsHeaders, 
        'Access-Control-Allow-Methods': 'POST, OPTIONS' 
      },
      status: 204
    });
  }

  const corr = crypto.randomUUID();

  const fail = (status: number, code: string, message: string, hint?: string, details?: any) => {
    logStep("ERROR", { corr, code, message, hint, details, status });
    return new Response(JSON.stringify({ corr, code, message, hint, details }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  };

  try {
    logStep("Function started", { corr });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return fail(500, "INTERNAL_ERROR", "STRIPE_SECRET_KEY is not set", "Configure Stripe secret key in environment");
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return fail(500, "SERVICE_ROLE_MISSING", "Service role key not configured", "Configure SUPABASE_SERVICE_ROLE_KEY in environment");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return fail(401, "UNAUTHORIZED", "No authorization header", "Include Authorization header with Bearer token");
    }

    // Use service role client for admin operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // Get user info for auth validation
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      return fail(401, "UNAUTHORIZED", "Invalid or expired token", "Sign in again with valid credentials");
    }

    // Check if user is superadmin
    const { data: isSuperadmin, error: superadminError } = await supabaseClient.rpc('is_superadmin', { user_id: userData.user.id });
    if (superadminError) {
      return fail(500, "INTERNAL_ERROR", "Failed to check admin permissions", "Database error during permission check", { error: superadminError.message });
    }
    
    if (!isSuperadmin) {
      return fail(403, "FORBIDDEN", "Superadmin access required", "Only superadmins can access billing overview");
    }

    logStep("Superadmin access verified", { corr, userId: userData.user.id, email: userData.user.email });

    let body: OverviewRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      return fail(400, "INVALID_JSON", "Invalid JSON in request body", "Ensure request body contains valid JSON");
    }

    if (!body.action) {
      return fail(400, "MISSING_ACTION", "Missing required action field", "Include 'action' field with one of: list_subscriptions, list_invoices, list_webhook_events");
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
    
    // Handle Stripe-specific errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid API Key')) {
        return fail(500, "INTERNAL_ERROR", "Invalid Stripe API key", "Check STRIPE_SECRET_KEY configuration");
      }
      
      if (error.message.includes('restricted')) {
        return fail(403, "INSUFFICIENT_STRIPE_PERMISSIONS", "Stripe key has insufficient permissions", "Use a Stripe key with full access permissions");
      }
      
      if (error.message.includes('No such') && error.message.includes('subscription')) {
        return fail(400, "NO_SUCH_SUBSCRIPTION", "Stripe subscription not found", "Subscription may have been deleted from Stripe dashboard");
      }
    }
    
    // Generic server error
    return fail(500, "INTERNAL_ERROR", "Unexpected server error", "Check function logs for details", { error: errorMessage });
  }
});