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
}

export interface Entitlements {
  features: EntitlementFeatures
  limits: EntitlementLimits
  planName: string
  isActive: boolean
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

export function computeEntitlements(
  planKey?: string, 
  planConfigRow?: any
): Entitlements {
  if (!planKey) {
    return FREE_PLAN
  }

  // Use plan_configs data if available
  if (planConfigRow) {
    const features = planConfigRow.features || []
    const limits = planConfigRow.limits || {}
    
    return {
      features: {
        scheduling: features.includes('scheduling'),
        numbers: features.includes('numbers'),
        sms: features.includes('sms'),
        widgets: features.includes('widgets'),
        advancedAnalytics: features.includes('advanced_analytics')
      },
      limits: {
        agents: limits.agents || null,
        numbers: limits.numbers || null,
        widgets: limits.widgets || null
      },
      planName: planConfigRow.display_name || planKey,
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