import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

export interface OrgGuardResult {
  ok: boolean;
  status?: number;
  reason?: string;
  organization?: {
    id: string;
    name: string;
    status: string;
    suspension_reason?: string;
  };
}

export interface OrgIpGuardResult {
  ok: boolean;
  status?: number;
  reason?: string;
  clientIp?: string;
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
      .select('id, name, status, suspension_reason, suspended_at, canceled_at')
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
    switch (org.status) {
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
        console.warn('Unknown suspension status:', org.status);
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
 * Extracts client IP address from request headers in order of preference
 */
export function getClientIp(req: Request): string | null {
  const headers = req.headers;

  // Order of preference: cf-connecting-ip → x-real-ip → first of x-forwarded-for → fly-client-ip
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;

  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) return xRealIp;

  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  const flyClientIp = headers.get('fly-client-ip');
  if (flyClientIp) return flyClientIp;

  // Last resort: check for edge runtime IP
  const xForwardedHost = headers.get('x-forwarded-host');
  if (xForwardedHost) {
    // Try to extract from various edge runtime headers
    const edgeIp = headers.get('x-edge-ip') || headers.get('x-client-ip');
    if (edgeIp) return edgeIp;
  }

  return null;
}

/**
 * Checks if an IP matches against an allowlist rule
 * Supports: exact IP, wildcard octet (*.*.*.* or 203.0.113.*), CIDR notation (/24)
 */
export function ipMatchesAllowlist(ip: string, rules: string[]): boolean {
  if (!ip || !rules?.length) return false;

  for (const rule of rules) {
    const trimmedRule = rule.trim();
    if (!trimmedRule) continue;

    // Exact match
    if (trimmedRule === ip) return true;

    // Wildcard match (e.g., 203.0.113.*)
    if (trimmedRule.includes('*')) {
      const regexPattern = trimmedRule
        .replace(/\./g, '\\.')
        .replace(/\*/g, '[0-9]+');
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(ip)) return true;
    }

    // CIDR notation (e.g., 203.0.113.0/24)
    if (trimmedRule.includes('/')) {
      const [network, prefixStr] = trimmedRule.split('/');
      const prefix = parseInt(prefixStr, 10);

      if (prefix >= 0 && prefix <= 32 && network) {
        try {
          const ipParts = ip.split('.').map(p => parseInt(p, 10));
          const networkParts = network.split('.').map(p => parseInt(p, 10));

          if (ipParts.length === 4 && networkParts.length === 4) {
            // Convert to 32-bit integers
            const ipInt = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
            const networkInt = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
            const mask = ~((1 << (32 - prefix)) - 1);

            if ((ipInt & mask) === (networkInt & mask)) return true;
          }
        } catch (e) {
          console.warn(`Invalid CIDR rule: ${trimmedRule}`, e);
        }
      }
    }
  }

  return false;
}

/**
 * Validates if the request IP is allowed based on organization IP allowlist settings
 */
export async function requireOrgIpAllowed(
  req: Request,
  organizationId: string,
  supabase: SupabaseClient
): Promise<OrgIpGuardResult> {
  try {
    const clientIp = getClientIp(req);

    // Fetch organization settings
    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, name, settings')
      .eq('id', organizationId)
      .single();

    if (error || !org) {
      console.error('Failed to fetch organization for IP check:', error);
      return {
        ok: false,
        status: 404,
        reason: 'organization_not_found',
        clientIp: clientIp || 'unknown'
      };
    }

    const settings = org.settings || {};
    const accessSettings = settings.access || {};
    const ipAllowlistEnabled = accessSettings.ip_allowlist_enabled;
    const ipAllowlist = accessSettings.ip_allowlist || [];

    // If IP allowlist is not enabled or empty, allow access
    if (!ipAllowlistEnabled || !Array.isArray(ipAllowlist) || ipAllowlist.length === 0) {
      return {
        ok: true,
        clientIp: clientIp || 'unknown'
      };
    }

    // If we can't determine client IP, deny access when allowlist is active
    if (!clientIp) {
      console.warn(`IP allowlist active but could not determine client IP for org ${organizationId}`);
      return {
        ok: false,
        status: 403,
        reason: 'IP_NOT_ALLOWED',
        clientIp: 'unknown'
      };
    }

    // Check if IP matches allowlist
    const isAllowed = ipMatchesAllowlist(clientIp, ipAllowlist);

    if (!isAllowed) {
      // Log blocked IP attempt
      await supabase.rpc('log_event', {
        p_org_id: organizationId,
        p_action: 'access.ip_blocked',
        p_target_type: 'organization',
        p_target_id: organizationId,
        p_status: 'blocked',
        p_metadata: {
          client_ip: clientIp,
          allowlist_rules: ipAllowlist,
          organization_name: org.name,
          timestamp: new Date().toISOString()
        }
      });

      return {
        ok: false,
        status: 403,
        reason: 'IP_NOT_ALLOWED',
        clientIp
      };
    }

    return {
      ok: true,
      clientIp
    };

  } catch (error) {
    console.error('Error in IP allowlist check:', error);
    return {
      ok: false,
      status: 500,
      reason: 'internal_error',
      clientIp: getClientIp(req) || 'unknown'
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
        rate_limit_applied: (current?.count ?? 0) > 1,
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
      status: result.organization?.status,
      suspended_reason: result.organization?.suspension_reason
    }),
    {
      status: result.status || 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Creates standardized error response for IP blocking
 */
export function createIpBlockedResponse(result: OrgIpGuardResult, corsHeaders: Record<string, string>, corrId?: string): Response {
  const messages = {
    IP_NOT_ALLOWED: "Access denied. Your IP address is not in the organization's allowlist.",
    organization_not_found: "Organization not found.",
    internal_error: "Internal error occurred."
  };

  const message = messages[result.reason as keyof typeof messages] || "Access denied.";

  return new Response(
    JSON.stringify({
      error: message,
      error_code: result.reason,
      client_ip: result.clientIp,
      corr: corrId
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
    ...(action.includes('read') ? [/^\/api\/settings\//] : []),

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

/**
 * Resolve webhook target with precedence: agent.webhook_url → org.settings.webhook_url → null
 */
export function resolveWebhookTarget({ agent, orgSettings }: {
  agent?: { webhook_url?: string },
  orgSettings?: { webhook_url?: string }
}): { url: string | null, target: "agent" | "org" | null } {
  if (agent?.webhook_url?.trim()) {
    return { url: agent.webhook_url.trim(), target: "agent" }
  }

  if (orgSettings?.webhook_url?.trim()) {
    return { url: orgSettings.webhook_url.trim(), target: "org" }
  }

  return { url: null, target: null }
}