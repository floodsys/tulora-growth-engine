import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DB-HEALTH-CHECK] ${step}${detailsStr}`);
};

interface DbHealthResult {
  duplicateInvitationUniques: number;
  duplicateOrgMemberUniques: number;
  legacyMembershipsReferences: {
    functions: string[];
    policies: string[];
    views: string[];
    total: number;
  };
  canonicalSubscriptionsTable: {
    exists: boolean;
    name: string;
    isCorrect: boolean;
  };
  orgSubscriptionsView: {
    exists: boolean;
    isView: boolean;
  };
  rlsEnabled: {
    organizations: boolean;
    organization_members: boolean;
  };
  potentiallyUnusedTables: {
    count: number;
    tables: Array<{
      name: string;
      row_count: number;
      last_accessed?: string;
    }>;
  };
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting DB health check");

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
    if (!user) throw new Error("User not authenticated");

    // Check if user is superadmin
    const { data: isSuperadmin, error: superadminError } = await supabaseClient.rpc('is_superadmin', { user_id: user.id });
    if (superadminError || !isSuperadmin) {
      throw new Error("Unauthorized: Superadmin access required");
    }

    logStep("User authenticated as superadmin", { userId: user.id });

    const result: DbHealthResult = {
      duplicateInvitationUniques: 0,
      duplicateOrgMemberUniques: 0,
      legacyMembershipsReferences: {
        functions: [],
        policies: [],
        views: [],
        total: 0
      },
      canonicalSubscriptionsTable: {
        exists: false,
        name: 'org_stripe_subscriptions',
        isCorrect: false
      },
      orgSubscriptionsView: {
        exists: false,
        isView: false
      },
      rlsEnabled: {
        organizations: false,
        organization_members: false
      },
      potentiallyUnusedTables: {
        count: 0,
        tables: []
      },
      timestamp: new Date().toISOString()
    };

    // 1. Check for duplicate unique constraints on invitations (by invite_token)
    logStep("Checking duplicate invitation uniques");
    const { data: inviteDuplicates } = await supabaseClient
      .from('organization_invitations')
      .select('invite_token')
      .groupBy('invite_token')
      .having('count(*) > 1')
      .limit(100);
    
    result.duplicateInvitationUniques = inviteDuplicates?.length || 0;

    // 2. Check for duplicate unique constraints on organization_members (by org_id, user_id)
    logStep("Checking duplicate organization member uniques");
    const { data: memberDuplicatesData } = await supabaseClient.rpc('get_duplicate_org_members');
    result.duplicateOrgMemberUniques = memberDuplicatesData || 0;

    // 3. Check for legacy references to memberships in functions/policies/views
    logStep("Checking legacy memberships references");
    
    // Check functions
    const { data: functionsWithMemberships } = await supabaseClient
      .from('information_schema.routines')
      .select('routine_name')
      .like('routine_definition', '%memberships%')
      .eq('routine_schema', 'public');
    
    // Check policies
    const { data: policiesWithMemberships } = await supabaseClient
      .from('pg_policies')
      .select('policyname, tablename')
      .or('definition.ilike.%memberships%,qual.ilike.%memberships%,with_check.ilike.%memberships%')
      .eq('schemaname', 'public');

    // Check views
    const { data: viewsWithMemberships } = await supabaseClient
      .from('information_schema.views')
      .select('table_name')
      .like('view_definition', '%memberships%')
      .eq('table_schema', 'public');

    result.legacyMembershipsReferences = {
      functions: functionsWithMemberships?.map(f => f.routine_name) || [],
      policies: policiesWithMemberships?.map(p => `${p.tablename}.${p.policyname}`) || [],
      views: viewsWithMemberships?.map(v => v.table_name) || [],
      total: (functionsWithMemberships?.length || 0) + (policiesWithMemberships?.length || 0) + (viewsWithMemberships?.length || 0)
    };

    // 4. Check canonical subscriptions table
    logStep("Checking canonical subscriptions table");
    const { data: canonicalTableExists } = await supabaseClient
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'org_stripe_subscriptions')
      .eq('table_schema', 'public')
      .single();

    result.canonicalSubscriptionsTable = {
      exists: !!canonicalTableExists,
      name: 'org_stripe_subscriptions',
      isCorrect: !!canonicalTableExists
    };

    // 5. Check if org_subscriptions is a view
    logStep("Checking org_subscriptions view");
    const { data: orgSubsView } = await supabaseClient
      .from('information_schema.views')
      .select('table_name')
      .eq('table_name', 'org_subscriptions')
      .eq('table_schema', 'public')
      .single();

    result.orgSubscriptionsView = {
      exists: !!orgSubsView,
      isView: !!orgSubsView
    };

    // 6. Check RLS enabled on key tables
    logStep("Checking RLS status");
    const { data: rlsStatus } = await supabaseClient.rpc('check_table_rls_status', {
      table_names: ['organizations', 'organization_members']
    });

    if (rlsStatus) {
      result.rlsEnabled.organizations = rlsStatus.organizations || false;
      result.rlsEnabled.organization_members = rlsStatus.organization_members || false;
    }

    // 7. Find potentially unused tables
    logStep("Finding potentially unused tables");
    const { data: unusedTables } = await supabaseClient.rpc('find_potentially_unused_tables');
    
    result.potentiallyUnusedTables = {
      count: unusedTables?.length || 0,
      tables: unusedTables || []
    };

    logStep("DB health check completed", { 
      duplicateInvitations: result.duplicateInvitationUniques,
      duplicateMembers: result.duplicateOrgMemberUniques,
      legacyRefs: result.legacyMembershipsReferences.total,
      unusedTables: result.potentiallyUnusedTables.count 
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in DB health check", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});