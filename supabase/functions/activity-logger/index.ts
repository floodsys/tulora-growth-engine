import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ActivityLogRequest {
  organizationId: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
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

    const body: ActivityLogRequest = await req.json();

    // Validate required fields
    if (!body.organizationId || !body.action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: organizationId and action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract IP and User Agent from request headers if not provided
    const ipAddress = body.ipAddress || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = body.userAgent || req.headers.get('user-agent') || 'unknown';

    // Enhanced details with request context
    const enhancedDetails = {
      ...body.details,
      timestamp: new Date().toISOString(),
      source: 'edge_function',
      request_id: crypto.randomUUID(),
      ...(body.details?.metadata && { metadata: body.details.metadata })
    };

    // Log to server console for monitoring
    console.log(JSON.stringify({
      level: 'info',
      message: 'Activity logged',
      organizationId: body.organizationId,
      userId: body.userId,
      action: body.action,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString()
    }));

    // Store in database using the log_activity function
    const { data, error } = await supabase.rpc('log_activity', {
      p_org_id: body.organizationId,
      p_user_id: body.userId || null,
      p_action: body.action,
      p_resource_type: body.resourceType || null,
      p_resource_id: body.resourceId || null,
      p_details: enhancedDetails
    });

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to log activity', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For sensitive actions, also log to dedicated security audit stream
    const sensitiveActions = [
      'organization_deleted',
      'member_removed', 
      'agent_deleted',
      'billing_updated',
      'subscription_cancelled',
      'password_changed'
    ];

    if (sensitiveActions.includes(body.action)) {
      console.log(JSON.stringify({
        level: 'security_audit',
        message: 'Sensitive action performed',
        organizationId: body.organizationId,
        userId: body.userId,
        action: body.action,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString(),
        details: enhancedDetails
      }));
    }

    return new Response(
      JSON.stringify({ success: true, logId: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Activity logger error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});