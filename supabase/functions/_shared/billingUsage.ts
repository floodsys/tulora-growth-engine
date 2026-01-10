/**
 * Shared billing usage helper for Edge Functions
 * Enforces monthly usage quotas (calls, minutes, messages)
 * 
 * This is SERVER-SIDE ONLY - do not import into frontend code.
 */

export type UsageResource = 'calls' | 'minutes' | 'messages';

export interface UsageQuotaResult {
  allowed: boolean;
  remaining?: number;
  limit?: number;
  current?: number;
  reason?: string;
}

export interface UsageQuotaError {
  status: 402;
  code: 'BILLING_OVER_LIMIT';
  metric: UsageResource;
  remaining: 0;
  limit: number;
  current: number;
  message: string;
}

export interface UsageQuotaCheckError {
  status: 503;
  code: 'BILLING_QUOTA_CHECK_ERROR';
  metric: UsageResource;
  message: string;
}

// Maps resource types to plan_configs.limits keys
const RESOURCE_TO_LIMIT_KEY: Record<UsageResource, string> = {
  calls: 'calls_per_month',
  minutes: 'minutes_per_month',
  messages: 'messages_per_month',
};

// Maps resource types to usage_rollups column names
const RESOURCE_TO_ROLLUP_COLUMN: Record<UsageResource, string> = {
  calls: 'calls',
  minutes: 'minutes',
  messages: 'messages',
};

/**
 * Get the current month period as a DATE (first day of month)
 * Matches the year_month format used in usage_rollups table
 */
function getCurrentMonthPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Get the start of current month as ISO timestamp for querying raw tables
 */
function getCurrentMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

/**
 * Check if organization has quota available for a usage resource
 * 
 * @param supabase - Supabase client with service_role or appropriate permissions
 * @param orgId - Organization ID
 * @param resource - Resource type: 'calls' | 'minutes' | 'messages'
 * @param corr - Optional correlation ID for logging
 * @returns UsageQuotaResult with allowed status and quota details
 */
export async function checkUsageQuota(
  supabase: any,
  orgId: string,
  resource: UsageResource,
  corr?: string
): Promise<UsageQuotaResult> {
  const correlationId = corr || crypto.randomUUID();
  const limitKey = RESOURCE_TO_LIMIT_KEY[resource];
  const rollupColumn = RESOURCE_TO_ROLLUP_COLUMN[resource];

  console.log(`[${correlationId}] Checking ${resource} quota for org ${orgId}`);

  try {
    // Step 1: Get org's plan and limits
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('plan_key')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      console.error(`[${correlationId}] Organization not found:`, orgError);
      // If org not found, default to allowed (fail-open for missing org)
      return { allowed: true, reason: 'org_not_found' };
    }

    // Step 2: Get plan limits
    const { data: planConfig, error: planError } = await supabase
      .from('plan_configs')
      .select('limits')
      .eq('plan_key', org.plan_key)
      .eq('is_active', true)
      .single();

    if (planError || !planConfig) {
      console.log(`[${correlationId}] No plan config found for ${org.plan_key}, treating as unlimited`);
      return { allowed: true, reason: 'no_plan_config' };
    }

    const limits = planConfig.limits || {};
    const limit = limits[limitKey];

    // Step 3: Check if limit is enforced
    // null or undefined means unlimited/not enforced
    if (limit === null || limit === undefined) {
      console.log(`[${correlationId}] ${resource} limit not enforced for plan ${org.plan_key}`);
      return { allowed: true, reason: 'unlimited' };
    }

    // Step 4: Get current usage from rollups or fallback to raw tables
    const currentUsage = await getCurrentUsage(supabase, orgId, resource, correlationId);

    console.log(`[${correlationId}] ${resource} usage: ${currentUsage}/${limit}`);

    // Step 5: Check if over limit
    if (currentUsage >= limit) {
      return {
        allowed: false,
        remaining: 0,
        limit,
        current: currentUsage,
        reason: 'over_limit',
      };
    }

    return {
      allowed: true,
      remaining: limit - currentUsage,
      limit,
      current: currentUsage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${correlationId}] Error checking ${resource} quota:`, error);
    
    // Log activity event for quota check failure (fire-and-forget, don't await to avoid blocking)
    logQuotaCheckFailure(supabase, orgId, resource, errorMessage, correlationId).catch((logErr) => {
      console.error(`[${correlationId}] Failed to log quota check failure:`, logErr);
    });
    
    // Fail-closed on errors: deny request when quota check fails
    return { 
      allowed: false, 
      reason: 'quota_check_error',
    };
  }
}

/**
 * Log quota check failure to activity_events table
 * This is called once per failed quota check request
 */
async function logQuotaCheckFailure(
  supabase: any,
  orgId: string,
  resource: UsageResource,
  errorMessage: string,
  correlationId: string
): Promise<void> {
  try {
    await supabase.rpc('log_activity_event', {
      p_org_id: orgId,
      p_action: 'billing.quota_check_failed',
      p_target_type: 'usage_quota',
      p_actor_user_id: null,
      p_actor_role_snapshot: 'system',
      p_target_id: null,
      p_status: 'error',
      p_error_code: 'BILLING_QUOTA_CHECK_ERROR',
      p_ip_hash: null,
      p_user_agent: null,
      p_request_id: correlationId,
      p_channel: 'audit',
      p_metadata: {
        resource_type: resource,
        error_message: errorMessage,
        timestamp: new Date().toISOString(),
        source: 'billing_usage_check'
      }
    });
  } catch (logError) {
    // Log to console if activity logging fails, but don't throw
    console.error(`[${correlationId}] Activity logging failed:`, logError);
  }
}

/**
 * Get current month usage for a resource
 * Prefers usage_rollups, falls back to raw tables if rollup doesn't exist
 */
async function getCurrentUsage(
  supabase: any,
  orgId: string,
  resource: UsageResource,
  corr: string
): Promise<number> {
  const rollupColumn = RESOURCE_TO_ROLLUP_COLUMN[resource];
  const currentPeriod = getCurrentMonthPeriod();

  // Try to get from usage_rollups first
  const { data: rollup, error: rollupError } = await supabase
    .from('usage_rollups')
    .select(rollupColumn)
    .eq('organization_id', orgId)
    .eq('year_month', currentPeriod)
    .single();

  if (!rollupError && rollup && rollup[rollupColumn] !== null) {
    console.log(`[${corr}] Got ${resource} from rollups: ${rollup[rollupColumn]}`);
    return rollup[rollupColumn] || 0;
  }

  // Fallback: query raw tables for current month
  console.log(`[${corr}] Rollup not found, falling back to raw tables for ${resource}`);
  return await getFallbackUsage(supabase, orgId, resource, corr);
}

/**
 * Get usage by counting from raw tables (fallback when rollups don't exist)
 */
async function getFallbackUsage(
  supabase: any,
  orgId: string,
  resource: UsageResource,
  corr: string
): Promise<number> {
  const monthStart = getCurrentMonthStart();

  switch (resource) {
    case 'calls': {
      // Count completed calls from retell_calls
      const { count, error } = await supabase
        .from('retell_calls')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('started_at', monthStart)
        .in('status', ['completed', 'ongoing', 'started']);

      if (error) {
        console.error(`[${corr}] Error counting calls:`, error);
        return 0;
      }
      return count || 0;
    }

    case 'minutes': {
      // Sum duration from retell_calls (duration_ms -> minutes)
      const { data, error } = await supabase
        .from('retell_calls')
        .select('duration_ms')
        .eq('organization_id', orgId)
        .gte('started_at', monthStart)
        .not('duration_ms', 'is', null);

      if (error) {
        console.error(`[${corr}] Error summing minutes:`, error);
        return 0;
      }

      // Sum and convert ms to minutes
      const totalMs = (data || []).reduce((sum: number, row: { duration_ms: number }) => {
        return sum + (row.duration_ms || 0);
      }, 0);
      
      // Round up to whole minutes
      return Math.ceil(totalMs / 60000);
    }

    case 'messages': {
      // Count SMS messages from sms_messages table
      // Only count outbound messages for quota purposes (outbound = billable to org)
      const { count, error } = await supabase
        .from('sms_messages')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('direction', 'outbound')
        .gte('created_at', monthStart);

      if (error) {
        console.error(`[${corr}] Error counting messages:`, error);
        return 0;
      }
      return count || 0;
    }

    default:
      return 0;
  }
}

/**
 * Enforce usage quota - throws structured error if over limit
 * 
 * @param supabase - Supabase client
 * @param orgId - Organization ID  
 * @param resource - Resource type: 'calls' | 'minutes' | 'messages'
 * @param corr - Optional correlation ID
 * @returns UsageQuotaResult if allowed
 * @throws UsageQuotaError if over limit
 */
export async function enforceUsageQuota(
  supabase: any,
  orgId: string,
  resource: UsageResource,
  corr?: string
): Promise<UsageQuotaResult> {
  const result = await checkUsageQuota(supabase, orgId, resource, corr);

  if (!result.allowed) {
    if (result.reason === 'over_limit') {
      const error: UsageQuotaError = {
        status: 402,
        code: 'BILLING_OVER_LIMIT',
        metric: resource,
        remaining: 0,
        limit: result.limit!,
        current: result.current!,
        message: `Monthly ${resource} limit exceeded. Current: ${result.current}, Limit: ${result.limit}`,
      };
      throw error;
    }
    
    if (result.reason === 'quota_check_error') {
      const error: UsageQuotaCheckError = {
        status: 503,
        code: 'BILLING_QUOTA_CHECK_ERROR',
        metric: resource,
        message: "We're temporarily unable to verify your usage. Please try again shortly.",
      };
      throw error;
    }
  }

  return result;
}

/**
 * Type guard to check if an error is a UsageQuotaError
 */
export function isUsageQuotaError(error: unknown): error is UsageQuotaError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as any).code === 'BILLING_OVER_LIMIT' &&
    'status' in error &&
    (error as any).status === 402
  );
}

/**
 * Type guard to check if an error is a UsageQuotaCheckError
 */
export function isUsageQuotaCheckError(error: unknown): error is UsageQuotaCheckError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as any).code === 'BILLING_QUOTA_CHECK_ERROR' &&
    'status' in error &&
    (error as any).status === 503
  );
}

/**
 * Create HTTP response from UsageQuotaError
 */
export function usageQuotaErrorResponse(error: UsageQuotaError): Response {
  return new Response(JSON.stringify(error), {
    status: error.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Create HTTP response from UsageQuotaCheckError
 */
export function usageQuotaCheckErrorResponse(error: UsageQuotaCheckError): Response {
  return new Response(JSON.stringify(error), {
    status: error.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Create HTTP response from any billing usage error (UsageQuotaError or UsageQuotaCheckError)
 */
export function billingErrorResponse(error: unknown): Response | null {
  if (isUsageQuotaError(error)) {
    return usageQuotaErrorResponse(error);
  }
  if (isUsageQuotaCheckError(error)) {
    return usageQuotaCheckErrorResponse(error);
  }
  return null;
}
