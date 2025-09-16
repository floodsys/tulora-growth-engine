/**
 * Shared entitlement helper for Edge Functions
 * Enforces plan-based feature and limit checks
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface EntitlementError {
  code: string
  message: string
  hint: string
}

export interface EntitlementCheck {
  feature?: string
  limitKey?: string
  currentCount?: number
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
  check: EntitlementCheck
): Promise<{ success: true } | { success: false; error: EntitlementError }> {
  try {
    // Get organization plan
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('plan_key, billing_status')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return {
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: ERROR_MESSAGES.PLAN_NOT_FOUND,
          hint: UPGRADE_HINTS.PLAN_NOT_FOUND
        }
      }
    }

    // Inactive billing blocks premium features
    if (org.billing_status !== 'active' && org.billing_status !== 'trialing') {
      if (check.feature) {
        const errorCode = check.feature === 'sms' ? 'FEATURE_NOT_ENABLED_SMS' : 'FEATURE_NOT_ENABLED'
        return {
          success: false,
          error: {
            code: errorCode,
            message: ERROR_MESSAGES[errorCode],
            hint: UPGRADE_HINTS[errorCode]
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
      const errorCode = check.feature === 'sms' ? 'FEATURE_NOT_ENABLED_SMS' : 'FEATURE_NOT_ENABLED'
      return {
        success: false,
        error: {
          code: errorCode,
          message: ERROR_MESSAGES[errorCode],
          hint: UPGRADE_HINTS[errorCode]
        }
      }
    }

    // Check feature entitlement
    if (check.feature && planConfig) {
      const features = planConfig.features || []
      if (!features.includes(check.feature)) {
        const errorCode = check.feature === 'sms' ? 'FEATURE_NOT_ENABLED_SMS' : 
                         check.feature === 'widgets' ? 'FEATURE_NOT_ENABLED_WIDGETS' : 
                         'FEATURE_NOT_ENABLED'
        return {
          success: false,
          error: {
            code: errorCode,
            message: ERROR_MESSAGES[errorCode],
            hint: UPGRADE_HINTS[errorCode]
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
        return {
          success: false,
          error: {
            code: errorCode,
            message: ERROR_MESSAGES[errorCode],
            hint: UPGRADE_HINTS[errorCode]
          }
        }
      }
    }

    return { success: true }

  } catch (error) {
    console.error('Entitlement check error:', error)
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check entitlements',
        hint: 'Please try again or contact support'
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