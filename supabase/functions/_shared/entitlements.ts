/**
 * Shared entitlement helper for Edge Functions
 * Enforces plan-based feature and limit checks
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface EntitlementError {
  code: string
  message: string
  hint: string
  corr?: string
}

export interface EntitlementCheck {
  feature?: string
  limitKey?: string
  currentCount?: number
}

// Feature aliases mapping (mirrors frontend SSOT)
const FEATURE_ALIASES: Record<string, string> = {
  appointment_scheduling: "scheduling",
  voice_numbers: "numbers",
  telephony_numbers: "numbers", 
  messaging: "sms",
  voice_sms: "sms",
  site_widgets: "widgets",
  web_widgets: "widgets",
  analytics_advanced: "advancedAnalytics",
  advanced_analytics: "advancedAnalytics",
}

function toCanonicalFeature(raw: string): string {
  return FEATURE_ALIASES[raw] ?? raw
}

const ERROR_MESSAGES = {
  FEATURE_NOT_ENABLED: 'Feature not available on your plan',
  FEATURE_NOT_ENABLED_SMS: 'SMS features not available on your plan',
  LIMIT_REACHED_AGENTS: 'Agent limit reached for your plan',
  LIMIT_REACHED_NUMBERS: 'Phone number limit reached for your plan',
  LIMIT_REACHED_WIDGETS: 'Widget limit reached for your plan',
  FEATURE_NOT_ENABLED_WIDGETS: 'Widget features not available on your plan',
  PLAN_NOT_FOUND: 'Organization plan configuration not found'
}

const UPGRADE_HINTS = {
  FEATURE_NOT_ENABLED: 'Upgrade to a higher plan to unlock this feature',
  FEATURE_NOT_ENABLED_SMS: 'Upgrade to Support Business or higher to unlock SMS',
  LIMIT_REACHED_AGENTS: 'Upgrade your plan to create more agents',
  LIMIT_REACHED_NUMBERS: 'Upgrade your plan to purchase more numbers',
  LIMIT_REACHED_WIDGETS: 'Upgrade your plan to create more widgets',
  FEATURE_NOT_ENABLED_WIDGETS: 'Upgrade to unlock widget capabilities',
  PLAN_NOT_FOUND: 'Contact support to resolve your plan configuration'
}

/**
 * Check if organization has required entitlements
 */
export async function requireEntitlement(
  supabase: any,
  orgId: string,
  check: EntitlementCheck,
  corr?: string
): Promise<{ success: true } | { success: false; error: EntitlementError; status: number }> {
  const correlationId = corr || crypto.randomUUID()
  
  console.log(`[${correlationId}] Checking entitlements for org ${orgId}:`, check)
  try {
    // Get organization plan
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('plan_key, billing_status')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      console.log(`[${correlationId}] Organization not found:`, orgError)
      return {
        success: false,
        status: 403,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: ERROR_MESSAGES.PLAN_NOT_FOUND,
          hint: UPGRADE_HINTS.PLAN_NOT_FOUND,
          corr: correlationId
        }
      }
    }

    // Inactive billing blocks premium features
    if (org.billing_status !== 'active' && org.billing_status !== 'trialing') {
      if (check.feature) {
        const canonicalFeature = toCanonicalFeature(check.feature)
        const errorCode = canonicalFeature === 'sms' ? 'FEATURE_NOT_ENABLED_SMS' : 'FEATURE_NOT_ENABLED'
        console.log(`[${correlationId}] Billing inactive, denying feature:`, canonicalFeature)
        return {
          success: false,
          status: 403,
          error: {
            code: errorCode,
            message: ERROR_MESSAGES[errorCode],
            hint: UPGRADE_HINTS[errorCode],
            corr: correlationId
          }
        }
      }
    }

    // Get plan configuration
    const { data: planConfig } = await supabase
      .from('plan_configs')
      .select('features, limits')
      .eq('plan_key', org.plan_key)
      .eq('is_active', true)
      .single()

    if (!planConfig && check.feature) {
      // No plan config found, deny premium features
      const canonicalFeature = toCanonicalFeature(check.feature)
      const errorCode = canonicalFeature === 'sms' ? 'FEATURE_NOT_ENABLED_SMS' : 'FEATURE_NOT_ENABLED'
      console.log(`[${correlationId}] No plan config found, denying feature:`, canonicalFeature)
      return {
        success: false,
        status: 403,
        error: {
          code: errorCode,
          message: ERROR_MESSAGES[errorCode],
          hint: UPGRADE_HINTS[errorCode],
          corr: correlationId
        }
      }
    }

    // Check feature entitlement
    if (check.feature && planConfig) {
      const rawFeatures = planConfig.features || []
      const canonical = new Set<string>()
      rawFeatures.forEach((f: string) => canonical.add(toCanonicalFeature(f)))
      
      const wanted = toCanonicalFeature(check.feature)
      const hasFeature = canonical.has(wanted)
      
      if (!hasFeature) {
        const errorCode = wanted === 'sms' ? 'FEATURE_NOT_ENABLED_SMS' : 
                         wanted === 'widgets' ? 'FEATURE_NOT_ENABLED_WIDGETS' : 
                         'FEATURE_NOT_ENABLED'
        console.log(`[${correlationId}] Feature not enabled:`, wanted, 'Available:', Array.from(canonical))
        return {
          success: false,
          status: 403,
          error: {
            code: errorCode,
            message: ERROR_MESSAGES[errorCode],
            hint: UPGRADE_HINTS[errorCode],
            corr: correlationId
          }
        }
      }
    }

    // Check limit entitlement
    if (check.limitKey && check.currentCount !== undefined && planConfig) {
      const limits = planConfig.limits || {}
      const limit = limits[check.limitKey]
      
      // null or undefined means unlimited
      if (limit !== null && limit !== undefined && check.currentCount >= limit) {
        const errorCode = `LIMIT_REACHED_${check.limitKey.toUpperCase()}` as keyof typeof ERROR_MESSAGES
        console.log(`[${correlationId}] Limit reached:`, check.limitKey, `${check.currentCount}/${limit}`)
        return {
          success: false,
          status: 409,
          error: {
            code: errorCode,
            message: ERROR_MESSAGES[errorCode],
            hint: UPGRADE_HINTS[errorCode],
            corr: correlationId
          }
        }
      }
    }

    return { success: true }

  } catch (error) {
    console.error(`[${correlationId}] Entitlement check error:`, error)
    return {
      success: false,
      status: 500,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check entitlements',
        hint: 'Please try again or contact support',
        corr: correlationId
      }
    }
  }
}

/**
 * Get current resource count for limit checks
 */
export async function getCurrentCount(
  supabase: any,
  orgId: string,
  resourceType: string
): Promise<number> {
  try {
    let query
    
    switch (resourceType) {
      case 'agents':
        query = supabase
          .from('retell_agents')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('is_active', true)
        break
      
      case 'numbers':
        query = supabase
          .from('retell_numbers')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('is_active', true)
        break
        
      case 'widgets':
        query = supabase
          .from('widget_configs')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('is_active', true)
        break
        
      default:
        return 0
    }
    
    const { count } = await query
    return count || 0
    
  } catch (error) {
    console.error(`Failed to get ${resourceType} count:`, error)
    return 0
  }
}