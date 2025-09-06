import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ACSS-INVOICE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw userError;

    const user = userData.user;
    if (!user?.email) throw new Error("User email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { planKey, organizationId, customerName, notes } = await req.json();
    
    if (!planKey || !organizationId) {
      throw new Error("planKey and organizationId are required");
    }

    // Get plan configuration
    const { data: planConfig, error: planError } = await supabaseClient
      .from('plan_configs')
      .select('*')
      .eq('plan_key', planKey)
      .eq('is_active', true)
      .single();

    if (planError || !planConfig) {
      throw new Error(`Plan ${planKey} not found or not active`);
    }

    if (!planConfig.stripe_setup_price_id) {
      throw new Error(`Plan ${planKey} does not have a setup price configured`);
    }

    logStep("Plan config retrieved", { planKey, setupPriceId: planConfig.stripe_setup_price_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const resend = new Resend(resendKey);

    // Get setup price details from Stripe
    const setupPrice = await stripe.prices.retrieve(planConfig.stripe_setup_price_id);
    const setupAmount = setupPrice.unit_amount || 0;
    
    logStep("Setup price retrieved", { amount: setupAmount, currency: setupPrice.currency });

    // Get or create Stripe customer
    const customers = await stripe.customers.list({ 
      email: user.email, 
      limit: 1 
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: customerName || user.user_metadata?.full_name || user.email,
        metadata: {
          organization_id: organizationId,
          plan_key: planKey,
          payment_method: 'acss_debit'
        }
      });
      customerId = customer.id;
      logStep("New customer created", { customerId });
    }

    // Create Stripe Invoice
    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 30,
      currency: 'cad',
      metadata: {
        organization_id: organizationId,
        plan_key: planKey,
        payment_method: 'acss_debit',
        setup_fee: 'true'
      },
      description: `${planConfig.display_name} - Setup Fee`,
      footer: notes || undefined
    });

    // Add invoice item for setup fee
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      price: planConfig.stripe_setup_price_id,
      description: `Setup Fee - ${planConfig.display_name}`
    });

    // Finalize invoice to generate payment link
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id, {
      auto_advance: false // Don't auto-charge, wait for customer action
    });

    logStep("Invoice created and finalized", { 
      invoiceId: finalizedInvoice.id, 
      hostedUrl: finalizedInvoice.hosted_invoice_url 
    });

    // Store invoice request in database
    const { data: salesInvoice, error: invoiceError } = await supabaseClient
      .from('sales_invoices')
      .insert({
        user_id: user.id,
        organization_id: organizationId,
        plan_key: planKey,
        stripe_invoice_id: finalizedInvoice.id,
        invoice_url: finalizedInvoice.hosted_invoice_url,
        amount: setupAmount,
        currency: 'cad',
        status: 'open',
        payment_method: 'acss_debit',
        customer_email: user.email,
        customer_name: customerName || user.user_metadata?.full_name,
        notes: notes
      })
      .select()
      .single();

    if (invoiceError) {
      logStep("Database insert error", invoiceError);
      throw new Error(`Failed to store invoice: ${invoiceError.message}`);
    }

    logStep("Invoice stored in database", { salesInvoiceId: salesInvoice.id });

    // Send email with invoice link
    const emailSubject = `Setup Fee Invoice - ${planConfig.display_name}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Setup Fee Invoice</h2>
        
        <p>Hello ${customerName || user.email},</p>
        
        <p>Thank you for choosing the <strong>${planConfig.display_name}</strong> plan. Your setup fee invoice is ready for payment.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Invoice Details</h3>
          <p><strong>Plan:</strong> ${planConfig.display_name}</p>
          <p><strong>Setup Fee:</strong> $${(setupAmount / 100).toFixed(2)} CAD</p>
          <p><strong>Payment Method:</strong> ACSS (Pre-Authorized Debit)</p>
          <p><strong>Invoice ID:</strong> ${finalizedInvoice.id}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${finalizedInvoice.hosted_invoice_url}" 
             style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Pay Invoice
          </a>
        </div>
        
        <p>You can pay this invoice using your Canadian bank account through ACSS (Pre-Authorized Debits). The payment link will guide you through the secure payment process.</p>
        
        ${notes ? `<p><strong>Additional Notes:</strong><br>${notes}</p>` : ''}
        
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        
        <p>Best regards,<br>The Team</p>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "Billing <billing@yourdomain.com>", // Update with your verified domain
      to: [user.email],
      subject: emailSubject,
      html: emailHtml
    });

    logStep("Email sent", { emailId: emailResponse.data?.id });

    return new Response(JSON.stringify({
      success: true,
      invoiceId: finalizedInvoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url,
      salesInvoiceId: salesInvoice.id,
      emailSent: !!emailResponse.data?.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    logStep("ERROR", { message: error.message });
    console.error("Error in ACSS invoice function:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});