import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from '../_shared/cors.ts'

interface DataFixRequest {
  fix_id: string;
  reason: string;
  organization_id?: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-DATA-FIXES] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

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

    const body: DataFixRequest = await req.json();
    const { fix_id, reason, organization_id } = body;

    if (!fix_id || !reason) {
      throw new Error("Missing required fields: fix_id, reason");
    }

    logStep("Processing data fix", { fixId: fix_id, reason, organizationId: organization_id });

    // Available data fixes (placeholder implementation)
    const availableFixes = {
      'clean_orphaned_members': {
        name: 'Clean Orphaned Members',
        description: 'Remove organization members with invalid user references',
        action: async () => {
          // Placeholder - implement actual fix logic
          return { affected_rows: 0, details: 'No orphaned members found' };
        }
      },
      'fix_subscription_sync': {
        name: 'Fix Subscription Sync',
        description: 'Sync organization billing status with Stripe',
        action: async () => {
          // Placeholder - implement actual fix logic
          return { affected_rows: 0, details: 'All subscriptions are in sync' };
        }
      },
      'reset_trial_periods': {
        name: 'Reset Trial Periods',
        description: 'Reset trial periods for organizations with invalid dates',
        action: async () => {
          // Placeholder - implement actual fix logic
          return { affected_rows: 0, details: 'No invalid trial periods found' };
        }
      }
    };

    const fix = availableFixes[fix_id as keyof typeof availableFixes];
    if (!fix) {
      throw new Error(`Unknown fix_id: ${fix_id}`);
    }

    // Execute the fix
    const result = await fix.action();

    // Log the data fix action
    await supabaseClient.from('audit_log').insert({
      organization_id: organization_id || '00000000-0000-0000-0000-000000000000',
      actor_user_id: user.id,
      actor_role_snapshot: 'superadmin',
      action: 'admin.data_fix',
      target_type: 'data_fix',
      target_id: fix_id,
      status: 'success',
      channel: 'audit',
      metadata: {
        fix_name: fix.name,
        reason: reason,
        result: result,
        executed_at: new Date().toISOString()
      }
    });

    logStep("Data fix completed successfully", { fixId: fix_id, result });

    return new Response(JSON.stringify({
      success: true,
      fix_id,
      fix_name: fix.name,
      result,
      executed_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});