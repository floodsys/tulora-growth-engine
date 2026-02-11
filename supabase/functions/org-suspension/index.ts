import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from '../_shared/cors.ts'

interface SuspensionRequest {
  action: 'suspend' | 'reinstate' | 'cancel';
  org_id: string;
  reason: string;
  confirmation_phrase: string;
  notify_owner?: boolean;
  dry_run?: boolean;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ORG-SUSPENSION] ${step}${detailsStr}`);
};

// Helper function to validate UUID format
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Check required environment variables
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY', 
      'SUPABASE_SERVICE_ROLE_KEY'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(varName => !Deno.env.get(varName));
    if (missingEnvVars.length > 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Missing required environment variables",
        hint: `Configure the following environment variables: ${missingEnvVars.join(', ')}`,
        cause: "env_config_missing",
        requirements: {
          environment_variables: requiredEnvVars,
          missing: missingEnvVars
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Use ANON client with user's auth header for authorization checks
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
      logStep("Superadmin check failed", { error: superadminError?.message, isSuperadmin });
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

    // Parse and validate request body
    let body: SuspensionRequest;
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
        status: 200,
      });
    }

    // Validate required fields
    const { action, org_id, reason, confirmation_phrase, notify_owner, dry_run } = body;

    if (!action) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Missing required field: action",
        hint: "Include 'action' field with one of: suspend, reinstate, cancel",
        cause: "missing_action"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!['suspend', 'reinstate', 'cancel'].includes(action)) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Invalid action",
        hint: "Use one of: suspend, reinstate, cancel",
        cause: "invalid_action",
        supported_actions: ['suspend', 'reinstate', 'cancel']
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!org_id) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Missing required field: org_id",
        hint: "Include organization ID to be modified",
        cause: "missing_org_id"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!isValidUUID(org_id)) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Invalid organization ID format",
        hint: "Organization ID must be a valid UUID",
        cause: "invalid_org_id_format"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!reason || reason.trim().length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Missing required field: reason",
        hint: "Include reason for the action",
        cause: "missing_reason"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (reason.length > 500) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Reason too long",
        hint: "Reason must be 500 characters or less",
        cause: "reason_too_long"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!confirmation_phrase) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Missing required field: confirmation_phrase",
        hint: "Include confirmation phrase for safety",
        cause: "missing_confirmation"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Validate confirmation phrase
    const expectedPhrase = action === 'suspend' ? 
      `SUSPEND ORG ${org_id}` : 
      action === 'cancel' ?
      `CANCEL ORG ${org_id}` :
      `REINSTATE ORG ${org_id}`;
    
    if (confirmation_phrase !== expectedPhrase) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Invalid confirmation phrase",
        hint: `Expected: "${expectedPhrase}"`,
        cause: "invalid_confirmation",
        expected_phrase: expectedPhrase
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep(`Processing ${action}`, { orgId: org_id, reason, dryRun: dry_run });

    // Check if organization exists and get current status
    const { data: orgData, error: orgError } = await supabaseClient
      .from('organizations')
      .select('id, name, status, billing_status, owner_user_id, profiles!inner(email)')
      .eq('id', org_id)
      .single();

    if (orgError || !orgData) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Organization not found",
        hint: "Check that the organization ID exists in the database",
        cause: "org_not_found",
        org_id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Validate state transition
    const currentStatus = orgData.status || 'active';
    let validTransition = true;
    let transitionError = '';

    if (action === 'suspend' && currentStatus === 'suspended') {
      validTransition = false;
      transitionError = 'Organization is already suspended';
    } else if (action === 'reinstate' && currentStatus !== 'suspended') {
      validTransition = false;
      transitionError = 'Organization is not currently suspended';
    } else if (action === 'cancel' && currentStatus === 'canceled') {
      validTransition = false;
      transitionError = 'Organization is already canceled';
    }

    if (!validTransition) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Invalid state transition",
        hint: transitionError,
        cause: "invalid_state",
        current_status: currentStatus,
        requested_action: action
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // If this is a dry run, return what would be changed
    if (dry_run) {
      const wouldChange = [
        `Organization status: ${currentStatus} → ${action === 'suspend' ? 'suspended' : action === 'cancel' ? 'canceled' : 'active'}`,
        `Suspension reason: "${reason}"`,
        `Action performed by: ${user.email}`,
        `Timestamp: ${new Date().toISOString()}`
      ];

      if (notify_owner && Deno.env.get("ENVIRONMENT") === "production") {
        wouldChange.push(`Email notification sent to: ${orgData.profiles.email}`);
      }

      return new Response(JSON.stringify({
        ok: true,
        dry_run: true,
        action,
        org_id,
        organization_name: orgData.name,
        current_status: currentStatus,
        would_change: wouldChange,
        requirements: {
          environment_variables: requiredEnvVars,
          database_functions: [
            action === 'suspend' ? 'suspend_organization' : 
            action === 'cancel' ? 'cancel_organization' : 'reinstate_organization'
          ]
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Perform the actual operation using service role for database writes
    const serviceRoleClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { 
        auth: { persistSession: false }
      }
    );

    let result;
    try {
      if (action === 'suspend') {
        const { data, error } = await serviceRoleClient.rpc('suspend_organization', {
          p_org_id: org_id,
          p_reason: reason,
          p_suspended_by: user.id
        });
        if (error) throw error;
        result = data;
      } else if (action === 'cancel') {
        // For cancel, we'll update the status directly since cancel_organization function might not exist
        const { data, error } = await serviceRoleClient
          .from('organizations')
          .update({ 
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            suspension_reason: reason
          })
          .eq('id', org_id)
          .select()
          .single();
        if (error) throw error;
        result = { success: true, organization_id: org_id };
      } else if (action === 'reinstate') {
        const { data, error } = await serviceRoleClient.rpc('reinstate_organization', {
          p_org_id: org_id,
          p_reason: reason,
          p_reinstated_by: user.id
        });
        if (error) throw error;
        result = data;
      }
    } catch (dbError) {
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      logStep("Database operation failed", { error: errorMessage });
      
      return new Response(JSON.stringify({
        ok: false,
        error: "Database operation failed",
        hint: "Check if the required database functions exist and user has permissions",
        cause: "database_error",
        details: errorMessage
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Send email notification if requested and in production
    if (notify_owner && Deno.env.get("ENVIRONMENT") === "production") {
      try {
        logStep("Email notification would be sent", { 
          to: orgData.profiles.email,
          action,
          orgName: orgData.name
        });
        
        // TODO: Implement actual email sending service
        // For now, just log that it would be sent
      } catch (emailError) {
        const emailErrorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        logStep("Email notification failed", { error: emailErrorMessage });
        // Don't fail the main operation if email fails
      }
    }

    logStep(`${action} completed successfully`, result);

    return new Response(JSON.stringify({
      ok: true,
      action,
      org_id,
      organization_name: orgData.name,
      previous_status: currentStatus,
      new_status: action === 'suspend' ? 'suspended' : action === 'cancel' ? 'canceled' : 'active',
      reason,
      performed_by: user.email,
      timestamp: new Date().toISOString(),
      result,
      requirements: {
        environment_variables: requiredEnvVars,
        database_functions: [
          action === 'suspend' ? 'suspend_organization' : 
          action === 'cancel' ? 'cancel_organization' : 'reinstate_organization'
        ]
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    
    // Always return 200 with structured error
    return new Response(JSON.stringify({
      ok: false,
      error: "Unexpected server error",
      hint: "Check function logs for details",
      cause: "server_error",
      details: errorMessage,
      requirements: {
        environment_variables: [
          'SUPABASE_URL',
          'SUPABASE_ANON_KEY', 
          'SUPABASE_SERVICE_ROLE_KEY'
        ]
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});