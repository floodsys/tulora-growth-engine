import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ActivityEventRequest {
  organizationId: string;
  actorUserId?: string;
  actorRoleSnapshot?: string;
  action: string;
  targetType: string;
  targetId?: string;
  status?: 'success' | 'error';
  errorCode?: string;
  channel?: 'audit' | 'internal' | 'test_invites';
  metadata?: any;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    const body: ActivityEventRequest = await req.json();

    // Validate required fields
    if (!body.organizationId || !body.action || !body.targetType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: organizationId, action, and targetType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract and hash IP address for privacy
    const rawIP = req.headers.get('x-forwarded-for') || 
                  req.headers.get('x-real-ip') || 
                  req.headers.get('cf-connecting-ip') ||
                  'unknown';
    
    // Hash IP using built-in function
    const { data: ipHash } = await supabase.rpc('hash_ip', { ip_address: rawIP });
    
    // Trim and sanitize user agent
    const rawUserAgent = req.headers.get('user-agent') || 'unknown';
    const { data: trimmedUserAgent } = await supabase.rpc('trim_user_agent', { 
      user_agent_string: rawUserAgent 
    });

    // Generate request ID for tracing
    const requestId = crypto.randomUUID();

    // Enhanced metadata with request context
    const enhancedMetadata = {
      ...body.metadata,
      timestamp: new Date().toISOString(),
      source: 'edge_function',
      request_id: requestId,
      raw_ip_available: rawIP !== 'unknown',
      user_agent_available: rawUserAgent !== 'unknown'
    };

    // Determine log level for structured logging
    const logLevel = body.status === 'error' ? 'error' : 'info';
    const isSecurityEvent = isSecurityRelevantAction(body.action);
    const isSensitiveAction = isSensitiveAction(body.action);

    // Log to server console with structured format
    const logEntry = {
      level: logLevel,
      message: `Activity event: ${body.action}`,
      organizationId: body.organizationId,
      actorUserId: body.actorUserId,
      action: body.action,
      targetType: body.targetType,
      targetId: body.targetId,
      status: body.status || 'success',
      channel: body.channel || 'audit',
      ipHash,
      requestId,
      timestamp: new Date().toISOString(),
      security_event: isSecurityEvent,
      sensitive_action: isSensitiveAction
    };

    console.log(JSON.stringify(logEntry));

    // For security events, also log to dedicated security audit stream
    if (isSecurityEvent) {
      console.log(JSON.stringify({
        ...logEntry,
        level: 'security_audit',
        message: `Security event: ${body.action}`
      }));
    }

    // Store in database using enhanced logging function
    const { data, error } = await supabase.rpc('log_activity_event', {
      p_org_id: body.organizationId,
      p_action: body.action,
      p_target_type: body.targetType,
      p_actor_user_id: body.actorUserId || null,
      p_actor_role_snapshot: body.actorRoleSnapshot || 'user',
      p_target_id: body.targetId || null,
      p_status: body.status || 'success',
      p_error_code: body.errorCode || null,
      p_ip_hash: ipHash,
      p_user_agent: trimmedUserAgent,
      p_request_id: requestId,
      p_channel: body.channel || 'audit',
      p_metadata: enhancedMetadata
    });

    if (error) {
      console.error('Database error:', JSON.stringify({
        level: 'error',
        message: 'Failed to log activity event',
        error: error.message,
        requestId,
        organizationId: body.organizationId,
        action: body.action
      }));
      
      return new Response(
        JSON.stringify({ error: 'Failed to log activity event', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        logId: data,
        requestId,
        ipHash: ipHash ? ipHash.substring(0, 4) + '****' : null // Partial hash for confirmation
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Activity logger error:', JSON.stringify({
      level: 'error',
      message: 'Edge function error',
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper functions to classify actions
function isSecurityRelevantAction(action: string): boolean {
  const securityActions = [
    'auth.login',
    'auth.logout', 
    'auth.password_changed',
    'auth.mfa_enabled',
    'auth.mfa_disabled',
    'member.role_changed',
    'member.removed',
    'api_key.created',
    'api_key.deleted',
    'api_key.rotated',
    'billing.plan_updated',
    'org.deleted',
    'integration.connected',
    'integration.disconnected'
  ];
  
  return securityActions.includes(action);
}

function isSensitiveAction(action: string): boolean {
  const sensitiveActions = [
    'org.deleted',
    'member.removed',
    'agent.deleted',
    'billing.plan_updated',
    'subscription.cancelled',
    'api_key.deleted',
    'file.deleted'
  ];
  
  return sensitiveActions.includes(action);
}