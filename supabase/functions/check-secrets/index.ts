import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SecretCheck {
  name: string;
  present: boolean;
  category: string;
  required: boolean;
  description?: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SECRETS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }
    
    const user = userData.user;
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Check if user is superadmin
    const { data: isSuperadmin, error: superadminError } = await supabaseClient.rpc('is_superadmin');
    if (superadminError || !isSuperadmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    logStep("Superadmin access verified", { userId: user.id, email: user.email });

    // Define all secrets to check
    const secretsToCheck = [
      // Stripe secrets
      { name: "STRIPE_SECRET_KEY", category: "Stripe", required: true, description: "Required for all Stripe operations" },
      { name: "STRIPE_WEBHOOK_SECRET", category: "Stripe", required: false, description: "Required for webhook verification" },
      { name: "STRIPE_PORTAL_RETURN_URL", category: "Stripe", required: false, description: "Custom return URL for billing portal" },
      { name: "STRIPE_PRICE_IDS", category: "Stripe", required: false, description: "Specific price IDs for plans" },
      
      // Supabase secrets
      { name: "SUPABASE_URL", category: "Supabase", required: true, description: "Supabase project URL" },
      { name: "SUPABASE_SERVICE_ROLE_KEY", category: "Supabase", required: true, description: "Service role key for admin operations" },
      { name: "SUPABASE_ANON_KEY", category: "Supabase", required: true, description: "Anonymous key for client operations" },
      
      // Email secrets (multiple providers)
      { name: "SMTP_HOST", category: "Email", required: false, description: "SMTP server hostname" },
      { name: "SMTP_PORT", category: "Email", required: false, description: "SMTP server port" },
      { name: "SMTP_USER", category: "Email", required: false, description: "SMTP username" },
      { name: "SMTP_PASS", category: "Email", required: false, description: "SMTP password" },
      { name: "SENDGRID_API_KEY", category: "Email", required: false, description: "SendGrid API key" },
      { name: "RESEND_API_KEY", category: "Email", required: false, description: "Resend API key" },
      
      // Admin/Org specific secrets
      { name: "ADMIN_SESSION_SECRET", category: "Admin", required: false, description: "Secret for admin session management" },
      { name: "MFA_SECRET_KEY", category: "Admin", required: false, description: "Secret for MFA operations" },
      { name: "STEP_UP_AUTH_SECRET", category: "Admin", required: false, description: "Secret for step-up authentication" },
      
      // External integrations
      { name: "OPENAI_API_KEY", category: "External", required: false, description: "OpenAI API integration" },
      { name: "ANTHROPIC_API_KEY", category: "External", required: false, description: "Anthropic API integration" },
      
      // Environment specific
      { name: "ENVIRONMENT", category: "Environment", required: false, description: "Current environment (production, staging, dev)" },
      { name: "JWT_SECRET", category: "Security", required: false, description: "JWT signing secret" },
    ];

    logStep("Checking secrets presence");

    const results: SecretCheck[] = secretsToCheck.map(secret => {
      const value = Deno.env.get(secret.name);
      const present = value !== undefined && value !== null && value.trim() !== "";
      
      return {
        name: secret.name,
        present,
        category: secret.category,
        required: secret.required,
        description: secret.description,
      };
    });

    // Group results by category
    const categorized = results.reduce((acc, result) => {
      if (!acc[result.category]) {
        acc[result.category] = [];
      }
      acc[result.category].push(result);
      return acc;
    }, {} as Record<string, SecretCheck[]>);

    // Find missing required secrets
    const missingRequired = results.filter(r => r.required && !r.present);
    const missingOptional = results.filter(r => !r.required && !r.present);

    logStep("Secrets check completed", { 
      totalChecked: results.length,
      missingRequired: missingRequired.length,
      missingOptional: missingOptional.length
    });

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_checked: results.length,
        present: results.filter(r => r.present).length,
        missing_required: missingRequired.length,
        missing_optional: missingOptional.length,
      },
      categorized,
      missing_required: missingRequired,
      missing_optional: missingOptional,
      blocking_for_admin_apis: missingRequired.filter(r => 
        r.category === 'Stripe' || r.category === 'Supabase'
      ),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});