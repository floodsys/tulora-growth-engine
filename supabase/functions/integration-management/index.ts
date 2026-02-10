import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { getCorsHeaders } from '../_shared/cors.ts'

interface IntegrationRequest {
  action: 'key_created' | 'key_revoked' | 'key_updated';
  organizationId: string;
  integration: string;
  keyId?: string;
  keyFingerprint?: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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

    const body: IntegrationRequest = await req.json();
    const { action, organizationId, integration, keyId, keyFingerprint } = body;

    let auditAction;
    let auditMetadata = {
      integration,
      key_id: keyId,
      key_fingerprint: keyFingerprint, // Never store actual secrets
      timestamp: new Date().toISOString()
    };

    switch (action) {
      case 'key_created':
        auditAction = 'integration.key_created';
        auditMetadata = {
          ...auditMetadata,
          key_created_at: new Date().toISOString()
        };
        break;

      case 'key_revoked':
        auditAction = 'integration.key_revoked';
        auditMetadata = {
          ...auditMetadata,
          key_revoked_at: new Date().toISOString()
        };
        break;

      case 'key_updated':
        auditAction = 'integration.key_updated';
        auditMetadata = {
          ...auditMetadata,
          key_updated_at: new Date().toISOString()
        };
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Log the audit event
    await supabase.rpc('log_event', {
      p_org_id: organizationId,
      p_action: auditAction,
      p_target_type: 'integration',
      p_target_id: keyId || integration,
      p_status: 'success',
      p_metadata: auditMetadata
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Integration management error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});