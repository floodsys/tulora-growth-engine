import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from '../_shared/cors.ts'

interface MigrationMapping {
  organization_id: string;
  new_plan_key: string;
  migration_action: 'migrate' | 'contact_sales' | 'trial';
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-CORE-MIGRATION] ${step}${detailsStr}`);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  logStep('Function started', { method: req.method });
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw userError;

    // Check if user is superadmin
    const { data: isSuperadmin } = await supabaseClient.rpc('is_superadmin', { user_id: userData.user.id });
    if (!isSuperadmin) {
      throw new Error("Access denied - superadmin required");
    }

    if (req.method === 'GET') {
      logStep('Processing GET request - fetching core organizations');
      
      // Find organizations with Core plan references
      const { data: coreOrgs, error: coreOrgsError } = await supabaseClient
        .from('organizations')
        .select('id, name, plan_key, billing_status, stripe_customer_id, owner_user_id')
        .or('plan_key.like.%core%,plan_key.like.%pro_%')
        .order('name');

      if (coreOrgsError) {
        logStep('Error fetching core organizations', coreOrgsError);
        throw coreOrgsError;
      }

      logStep('Found core organizations', { count: coreOrgs?.length });

      return new Response(JSON.stringify({
        coreOrganizations: coreOrgs || []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      logStep('Processing POST request', { action: body.action });
      
      if (body.action === 'migrate') {
        const mappings: MigrationMapping[] = body.mappings;
        let migratedCount = 0;

        logStep('Starting migration', { mappingCount: mappings.length });

        for (const mapping of mappings) {
          const { organization_id, new_plan_key, migration_action } = mapping;
          
          logStep('Processing organization', { organization_id, new_plan_key, migration_action });

          try {
            // Get organization details
            const { data: org } = await supabaseClient
              .from('organizations')
              .select('name, plan_key, stripe_customer_id, billing_status')
              .eq('id', organization_id)
              .single();

            if (!org) {
              logStep('Organization not found', { organization_id });
              continue;
            }

            if (migration_action === 'migrate') {
              // Update organization plan_key to new plan
              const { error: updateError } = await supabaseClient
                .from('organizations')
                .update({
                  plan_key: new_plan_key,
                  billing_status: 'trialing', // Reset to trial initially
                  updated_at: new Date().toISOString()
                })
                .eq('id', organization_id);

              if (updateError) {
                logStep('Error updating organization', { organization_id, error: updateError });
                continue;
              }

              // If organization has Stripe customer, create a subscription record for tracking
              if (org.stripe_customer_id) {
                const { error: subError } = await supabaseClient
                  .from('org_stripe_subscriptions')
                  .upsert({
                    organization_id,
                    stripe_customer_id: org.stripe_customer_id,
                    plan_key: new_plan_key,
                    status: 'needs_migration', // Flag for manual Stripe setup
                    quantity: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'organization_id'
                  });

                if (subError) {
                  logStep('Error creating subscription record', { organization_id, error: subError });
                }
              }

            } else if (migration_action === 'contact_sales') {
              // Mark as enterprise/contact sales
              const enterprisePlan = new_plan_key.includes('leadgen') ? 'leadgen_enterprise' : 'support_enterprise';
              
              const { error: updateError } = await supabaseClient
                .from('organizations')
                .update({
                  plan_key: enterprisePlan,
                  billing_status: 'contact_sales',
                  updated_at: new Date().toISOString()
                })
                .eq('id', organization_id);

              if (updateError) {
                logStep('Error updating organization to contact sales', { organization_id, error: updateError });
                continue;
              }

            } else if (migration_action === 'trial') {
              // Convert to trial
              const { error: updateError } = await supabaseClient
                .from('organizations')
                .update({
                  plan_key: 'trial',
                  billing_status: 'trialing',
                  trial_started_at: new Date().toISOString(),
                  trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
                  updated_at: new Date().toISOString()
                })
                .eq('id', organization_id);

              if (updateError) {
                logStep('Error updating organization to trial', { organization_id, error: updateError });
                continue;
              }
            }

            // Log the migration in audit log
            await supabaseClient
              .from('audit_log')
              .insert({
                organization_id,
                actor_user_id: userData.user.id,
                actor_role_snapshot: 'superadmin',
                action: 'core_plan.migrated',
                target_type: 'organization',
                target_id: organization_id,
                status: 'success',
                channel: 'audit',
                metadata: {
                  old_plan_key: org.plan_key,
                  new_plan_key: migration_action === 'trial' ? 'trial' : new_plan_key,
                  migration_action,
                  organization_name: org.name,
                  migration_timestamp: new Date().toISOString()
                }
              });

            migratedCount++;
            logStep('Successfully migrated organization', { organization_id, old_plan: org.plan_key, new_plan: new_plan_key });

          } catch (orgError) {
            logStep('Error processing organization', { organization_id, error: orgError });
            continue;
          }
        }

        logStep('Migration completed', { migratedCount, totalCount: mappings.length });

        return new Response(JSON.stringify({
          success: true,
          migratedCount,
          totalCount: mappings.length
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    throw new Error("Method not allowed");

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});