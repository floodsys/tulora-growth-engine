import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { getCorsHeaders } from '../_shared/cors.ts'

interface AuthLogRequest {
  action: 'login_success' | 'login_failure' | 'mfa_enabled' | 'mfa_disabled';
  userId?: string;
  email?: string;
  organizationId?: string;
  metadata?: any;
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

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: AuthLogRequest = await req.json();
    const { action, userId, email, organizationId, metadata = {} } = body;

    let auditMetadata = {
      user_agent: req.headers.get('user-agent')?.substring(0, 100),
      ip_hash: await hashIP(req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'),
      timestamp: new Date().toISOString(),
      ...metadata
    };

    // For login failures, only store minimal context (no PII)
    if (action === 'login_failure') {
      auditMetadata = {
        attempt_time: new Date().toISOString(),
      };
    }

    // Get user's organizations if userId is provided
    let userOrgs = [];
    if (userId) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_user_id', userId);

      const { data: memberOrgs } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .eq('seat_active', true);

      userOrgs = [
        ...(orgs || []).map(o => o.id),
        ...(memberOrgs || []).map(m => m.organization_id)
      ];
    }

    // Log to all user's organizations, or specified org
    const targetOrgs = organizationId ? [organizationId] : userOrgs;

    for (const orgId of targetOrgs) {
      await supabase.rpc('log_event', {
        p_org_id: orgId,
        p_action: action,
        p_target_type: 'other',
        p_target_id: userId,
        p_status: action.includes('failure') ? 'error' : 'success',
        p_channel: 'audit',
        p_metadata: auditMetadata
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Auth logging error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Simple IP hashing function
async function hashIP(ip: string): Promise<string> {
  if (!ip || ip === 'unknown') return 'unknown';

  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 8); // First 8 characters
}