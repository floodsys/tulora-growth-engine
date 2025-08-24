import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrgSettingsRequest {
  organizationId: string;
  updates: {
    name?: string;
    [key: string]: any;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get authenticated user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: OrgSettingsRequest = await req.json();
    const { organizationId, updates } = body;

    // Get current organization settings for diff
    const { data: currentOrg, error: fetchError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (fetchError || !currentOrg) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate diff for audit logging
    const changes = {};
    for (const [key, newValue] of Object.entries(updates)) {
      const oldValue = currentOrg[key];
      if (oldValue !== newValue) {
        changes[key] = {
          from: oldValue,
          to: newValue
        };
      }
    }

    // Update organization
    const { error: updateError } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', organizationId);

    let auditStatus = 'success';
    let auditMetadata = { changes };

    if (updateError) {
      auditStatus = 'error';
      auditMetadata = { 
        changes, 
        error: updateError.message 
      };
    }

    // Log the audit event
    await supabase.rpc('log_event', {
      p_org_id: organizationId,
      p_action: 'org.settings_updated',
      p_target_type: 'org',
      p_target_id: organizationId,
      p_status: auditStatus,
      p_metadata: auditMetadata
    });

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, changes }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Organization settings error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});