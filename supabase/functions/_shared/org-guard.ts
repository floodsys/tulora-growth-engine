import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

export interface OrgGuardResult {
  ok: boolean;
  status?: number;
  reason?: string;
  organization?: {
    id: string;
    name: string;
    suspension_status: string;
    suspension_reason?: string;
  };
}

export interface OrgGuardContext {
  organizationId: string;
  action: string;
  path: string;
  method: string;
  actorUserId?: string;
  ipAddress?: string;
  supabase: SupabaseClient;
}

/**
 * Validates if an organization is in active state and can perform the requested action.
 * Blocks operations when org is suspended/canceled, logs audit events for blocked attempts.
 */
export async function requireOrgActive(context: OrgGuardContext): Promise<OrgGuardResult> {
  const { organizationId, action, path, method, actorUserId, ipAddress, supabase } = context;

  try {
    // Fetch organization status
    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, name, suspension_status, suspension_reason, suspended_at, canceled_at')
      .eq('id', organizationId)
      .single();

    if (error || !org) {
      console.error('Failed to fetch organization:', error);
      return {
        ok: false,
        status: 404,
        reason: 'organization_not_found'
      };
    }

    // Check organization status
    switch (org.suspension_status) {
      case 'active':
        return {
          ok: true,
          organization: org
        };

      case 'suspended':
        // Log blocked operation
        await logBlockedOperation(supabase, {
          organizationId,
          action,
          path,
          method,
          reason: 'ORG_SUSPENDED',
          actorUserId,
          organizationName: org.name,
          suspensionReason: org.suspension_reason,
          ipAddress
        });

        return {
          ok: false,
          status: 423, // Locked
          reason: 'ORG_SUSPENDED',
          organization: org
        };

      case 'canceled':
        // Log blocked operation
        await logBlockedOperation(supabase, {
          organizationId,
          action,
          path,
          method,
          reason: 'ORG_CANCELED',
          actorUserId,
          organizationName: org.name,
          suspensionReason: org.suspension_reason,
          ipAddress
        });

        return {
          ok: false,
          status: 410, // Gone
          reason: 'ORG_CANCELED',
          organization: org
        };

      default:
        console.warn('Unknown suspension status:', org.suspension_status);
        return {
          ok: false,
          status: 500,
          reason: 'unknown_status'
        };
    }

  } catch (error) {
    console.error('Error in org guard:', error);
    return {
      ok: false,
      status: 500,
      reason: 'internal_error'
    };
  }
}

/**
 * Rate limiting tracker for blocked operations
 */
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

/**
 * Logs blocked operations to audit log for tracking and compliance
 * Includes rate limiting to prevent log spam
 */
async function logBlockedOperation(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    action: string;
    path: string;
    method: string;
    reason: string;
    actorUserId?: string;
    organizationName: string;
    suspensionReason?: string;
    ipAddress?: string;
  }
) {
  try {
    // Extract IP from request or use provided IP
    const clientIP = params.ipAddress;
    const rateLimitKey = `${params.organizationId}:${clientIP || 'unknown'}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 50; // Max 50 blocked operations per minute per org/IP
    
    // Check rate limit
    const current = rateLimitCache.get(rateLimitKey);
    if (current && current.resetTime > now) {
      if (current.count >= maxRequests) {
        console.log(`Rate limit exceeded for ${rateLimitKey}, skipping log`);
        return;
      }
      current.count++;
    } else {
      rateLimitCache.set(rateLimitKey, { count: 1, resetTime: now + windowMs });
    }
    
    // Clean up expired entries
    for (const [key, value] of rateLimitCache.entries()) {
      if (value.resetTime <= now) {
        rateLimitCache.delete(key);
      }
    }

    // Track blocked operation for observability and alerting
    const trackingResult = await supabase.rpc('track_blocked_operation', {
      p_org_id: params.organizationId,
      p_ip_address: clientIP
    });

    console.log('Blocked operation tracking result:', trackingResult);

    // Log the blocked operation
    await supabase.rpc('log_event', {
      p_org_id: params.organizationId,
      p_action: 'org.blocked_operation',
      p_target_type: 'organization',
      p_target_id: params.organizationId,
      p_status: 'blocked',
      p_metadata: {
        blocked_action: params.action,
        request_path: params.path,
        request_method: params.method,
        block_reason: params.reason,
        organization_name: params.organizationName,
        suspension_reason: params.suspensionReason,
        ip_address: clientIP,
        rate_limit_applied: current?.count > 1,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to log blocked operation:', error);
    // Don't throw - we don't want audit logging failures to break the guard
  }
}

/**
 * Creates standardized error response for blocked operations
 */
export function createBlockedResponse(result: OrgGuardResult, corsHeaders: Record<string, string>): Response {
  const messages = {
    ORG_SUSPENDED: "Your organization's service has been temporarily suspended. Please contact your organization owner or admin for assistance.",
    ORG_CANCELED: "Your organization's service has been canceled. Please contact support for assistance.",
    organization_not_found: "Organization not found.",
    unknown_status: "Organization status is unknown.",
    internal_error: "Internal error occurred."
  };

  const message = messages[result.reason as keyof typeof messages] || "Access denied.";

  return new Response(
    JSON.stringify({
      error: message,
      code: result.reason,
      status: result.organization?.suspension_status,
      suspended_reason: result.organization?.suspension_reason
    }),
    {
      status: result.status || 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Checks if a path/action should be exempted from org status checks
 * Billing, auth, and settings (read-only) operations are generally allowed
 */
export function isExemptedPath(path: string, action: string): boolean {
  const exemptedPatterns = [
    // Billing and portal access
    /^\/api\/billing\//,
    /^\/api\/stripe\//,
    /^\/api\/portal\//,
    
    // Auth operations
    /^\/api\/auth\//,
    /^\/api\/me$/,
    
    // Read-only settings (but not updates)
    /^\/api\/settings\// && action.includes('read'),
    
    // Support and contact
    /^\/api\/support\//,
    /^\/api\/contact\//,
    
    // Health checks
    /^\/api\/health$/,
    /^\/api\/status$/
  ];

  return exemptedPatterns.some(pattern => 
    typeof pattern === 'object' && 'test' in pattern 
      ? pattern.test(path)
      : false
  );
}