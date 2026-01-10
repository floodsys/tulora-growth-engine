import React from "react"
import { supabase } from "@/integrations/supabase/client"

export interface EntitlementFeatures {
  scheduling: boolean
  numbers: boolean
  sms: boolean
  widgets: boolean
  advancedAnalytics: boolean
}

export interface EntitlementLimits {
  agents: number | null
  numbers: number | null
  widgets: number | null
  // Usage quotas (optional - null/undefined = unlimited/not enforced)
  calls_per_month?: number | null
  minutes_per_month?: number | null
  messages_per_month?: number | null
}

export interface Entitlements {
  features: EntitlementFeatures
  limits: EntitlementLimits
  planName: string
  isActive: boolean
}

// Feature alias normalization for plan_configs DB features
const FEATURE_ALIASES: Record<string, keyof EntitlementFeatures> = {
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

// Fallback plan definitions when plan_configs unavailable
const PLAN_FALLBACKS: Record<string, Entitlements> = {
  // Legacy plans
  trial: {
    features: { scheduling: false, numbers: false, sms: false, widgets: false, advancedAnalytics: false },
    limits: { agents: 1, numbers: 0, widgets: 0 },
    planName: 'Trial',
    isActive: true
  },
  pro: {
    features: { scheduling: true, numbers: true, sms: false, widgets: true, advancedAnalytics: false },
    limits: { agents: 5, numbers: 2, widgets: 3 },
    planName: 'Starter',
    isActive: true
  },
  business: {
    features: { scheduling: true, numbers: true, sms: true, widgets: true, advancedAnalytics: true },
    limits: { agents: null, numbers: null, widgets: null },
    planName: 'Business',
    isActive: true
  },

  // Lead Generation plans
  leadgen_starter: {
    features: { scheduling: true, numbers: true, sms: false, widgets: true, advancedAnalytics: false },
    limits: { agents: 3, numbers: 1, widgets: 2 },
    planName: 'Lead Gen Starter',
    isActive: true
  },
  leadgen_business: {
    features: { scheduling: true, numbers: true, sms: true, widgets: true, advancedAnalytics: true },
    limits: { agents: 10, numbers: 5, widgets: 10 },
    planName: 'Lead Gen Business',
    isActive: true
  },
  leadgen_enterprise: {
    features: { scheduling: true, numbers: true, sms: true, widgets: true, advancedAnalytics: true },
    limits: { agents: null, numbers: null, widgets: null },
    planName: 'Lead Gen Enterprise',
    isActive: true
  },

  // Customer Service plans
  support_starter: {
    features: { scheduling: false, numbers: true, sms: false, widgets: false, advancedAnalytics: false },
    limits: { agents: 2, numbers: 1, widgets: 1 },
    planName: 'Support Starter',
    isActive: true
  },
  support_business: {
    features: { scheduling: true, numbers: true, sms: true, widgets: true, advancedAnalytics: true },
    limits: { agents: 8, numbers: 3, widgets: 5 },
    planName: 'Support Business',
    isActive: true
  },
  support_enterprise: {
    features: { scheduling: true, numbers: true, sms: true, widgets: true, advancedAnalytics: true },
    limits: { agents: null, numbers: null, widgets: null },
    planName: 'Support Enterprise',
    isActive: true
  }
}

const FREE_PLAN: Entitlements = {
  features: { scheduling: false, numbers: false, sms: false, widgets: false, advancedAnalytics: false },
  limits: { agents: 0, numbers: 0, widgets: 0 },
  planName: 'Free',
  isActive: false
}

// Helper to get display name for a plan
export function getPlanDisplayName(planKey?: string, planConfigRow?: any): string {
  if (planConfigRow?.display_name) {
    return planConfigRow.display_name
  }
  if (planKey && PLAN_FALLBACKS[planKey]) {
    return PLAN_FALLBACKS[planKey].planName
  }
  if (planKey) {
    // Title case the plan key as fallback
    return planKey.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }
  return 'Unknown Plan'
}

export function computeEntitlements(
  planKey?: string, 
  planConfigRow?: any
): Entitlements {
  if (!planKey) {
    return FREE_PLAN
  }

  // Use plan_configs data if available
  if (planConfigRow) {
    const rawFeatures = planConfigRow.features || []
    const rawLimits = planConfigRow.limits || {}
    
    // Map DB feature names to canonical features using aliases
    const canonicalFeatures: EntitlementFeatures = {
      scheduling: false,
      numbers: false,
      sms: false,
      widgets: false,
      advancedAnalytics: false
    }
    
    // Check each raw feature and map to canonical
    rawFeatures.forEach((feature: string) => {
      const canonicalKey = FEATURE_ALIASES[feature] || feature
      if (canonicalKey in canonicalFeatures) {
        canonicalFeatures[canonicalKey as keyof EntitlementFeatures] = true
      }
    })
    
    return {
      features: canonicalFeatures,
      limits: {
        agents: rawLimits.agents === 0 ? 0 : (rawLimits.agents || null), // 0 means zero, null means unlimited
        numbers: rawLimits.numbers === 0 ? 0 : (rawLimits.numbers || null),
        widgets: rawLimits.widgets === 0 ? 0 : (rawLimits.widgets || null),
        // Usage quotas - undefined/null means unlimited/not enforced
        calls_per_month: rawLimits.calls_per_month ?? undefined,
        minutes_per_month: rawLimits.minutes_per_month ?? undefined,
        messages_per_month: rawLimits.messages_per_month ?? undefined,
      },
      planName: getPlanDisplayName(planKey, planConfigRow),
      isActive: true
    }
  }

  // Fall back to hardcoded plan definitions
  return PLAN_FALLBACKS[planKey] || FREE_PLAN
}

export function useEntitlements(orgId: string | null) {
  const [entitlements, setEntitlements] = React.useState<Entitlements>(FREE_PLAN)
  const [isLoading, setIsLoading] = React.useState(true)

  const loadEntitlements = React.useCallback(async () => {
    if (!orgId) {
      setEntitlements(FREE_PLAN)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      // Get organization data
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('plan_key, billing_status')
        .eq('id', orgId)
        .single()

      if (orgError || !org) {
        console.error('Error fetching organization:', orgError)
        setEntitlements(FREE_PLAN)
        setIsLoading(false)
        return
      }

      // Check if billing is active
      const isActive = org.billing_status === 'active' || org.billing_status === 'trialing'
      
      if (!isActive) {
        setEntitlements(FREE_PLAN)
        setIsLoading(false)
        return
      }

      // Try to get plan config
      let planConfigRow = null
      if (org.plan_key) {
        const { data: planConfig } = await supabase
          .from('plan_configs')
          .select('*')
          .eq('plan_key', org.plan_key)
          .eq('is_active', true)
          .single()
        
        planConfigRow = planConfig
      }

      const computed = computeEntitlements(org.plan_key, planConfigRow)
      computed.isActive = isActive
      
      setEntitlements(computed)
    } catch (error) {
      console.error('Error loading entitlements:', error)
      setEntitlements(FREE_PLAN)
    } finally {
      setIsLoading(false)
    }
  }, [orgId])

  React.useEffect(() => {
    loadEntitlements()
  }, [loadEntitlements])

  return {
    entitlements,
    isLoading,
    refresh: loadEntitlements
  }
}
