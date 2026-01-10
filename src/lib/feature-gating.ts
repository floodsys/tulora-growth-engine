/**
 * @deprecated This module is now a compatibility wrapper over src/lib/entitlements/ssot.ts
 * Please migrate to useEntitlements from the entitlements SSOT for new code.
 */
import React from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useEntitlements, type Entitlements } from './entitlements/ssot'

export interface PlanLimits {
  agents: number | null
  seats: number | null
  calls_per_month: number | null
  storage_gb: number | null
  // Usage quotas (optional - null/undefined = unlimited/not enforced)
  minutes_per_month?: number | null
  messages_per_month?: number | null
}

export interface FeatureFlags {
  hasFeature: (feature: string) => boolean
  canCreateAgent: boolean
  canAddSeat: boolean
  planLimits: PlanLimits
  planName: string
  isActive: boolean
  loading: boolean
}

// Feature name mapping for backwards compatibility
const LEGACY_FEATURE_MAP: Record<string, keyof Entitlements['features']> = {
  basic_calendar: 'scheduling',
  appointment_scheduling: 'scheduling',
  advanced_analytics: 'advancedAnalytics',
  voice_sms: 'sms',
  messaging: 'sms',
  crm_integrations: 'widgets',
  email_support: 'scheduling', // Map to a basic feature
  white_label: 'advancedAnalytics',
  api_access: 'advancedAnalytics',
  account_manager: 'advancedAnalytics',
  priority_support: 'advancedAnalytics'
}

let hasShownDeprecationWarning = false

export async function getOrgFeatureFlags(orgId: string): Promise<FeatureFlags> {
  if (!hasShownDeprecationWarning) {
    console.warn('getOrgFeatureFlags is deprecated. Please use useEntitlements from src/lib/entitlements/ssot.ts')
    hasShownDeprecationWarning = true
  }

  try {
    // This is a simplified version that matches the hook behavior
    // For a full async implementation, you'd need to replicate the SSOT logic
    const { data: org } = await supabase
      .from('organizations')
      .select('plan_key, billing_status')
      .eq('id', orgId)
      .maybeSingle()

    if (!org) {
      return getTrialPlanFlags()
    }

    const isActive = org.billing_status === 'active' || org.billing_status === 'trialing'
    
    // Get usage counts
    const [agentCount, seatCount] = await Promise.all([
      getCurrentAgentCount(orgId),
      getCurrentSeatCount(orgId)
    ])

    // Map basic plan data to legacy format
    const planKey = org.plan_key || 'trial'
    let limits, planName
    
    if (planKey === 'pro' || planKey === 'leadgen_starter') {
      limits = { agents: 10, seats: 20, calls_per_month: 5000, storage_gb: 100 }
      planName = 'Starter'
    } else if (planKey === 'business' || planKey === 'leadgen_business') {
      limits = { agents: null, seats: null, calls_per_month: null, storage_gb: 500 }
      planName = 'Business'
    } else {
      limits = { agents: 1, seats: 1, calls_per_month: 100, storage_gb: 5 }
      planName = 'Trial'
    }

    return {
      hasFeature: (feature: string) => {
        // Basic feature mapping for compatibility
        if (feature === 'basic_calendar' || feature === 'email_support') return true
        if (planKey === 'business' || planKey === 'leadgen_business') return true
        if (planKey === 'pro' || planKey === 'leadgen_starter') {
          return ['advanced_analytics', 'voice_sms', 'crm_integrations'].includes(feature)
        }
        return false
      },
      canCreateAgent: limits.agents === null || agentCount < limits.agents,
      canAddSeat: limits.seats === null || seatCount < limits.seats,
      planLimits: limits,
      planName,
      isActive,
      loading: false
    }
  } catch (error) {
    console.error('Error in getOrgFeatureFlags:', error)
    return getTrialPlanFlags()
  }
}

function getTrialPlanFlags(): FeatureFlags {
  return {
    hasFeature: (feature: string) => ['basic_calendar', 'email_support'].includes(feature),
    canCreateAgent: false,
    canAddSeat: false,
    planLimits: {
      agents: 1,
      seats: 1,
      calls_per_month: 100,
      storage_gb: 5
    },
    planName: 'Trial',
    isActive: false,
    loading: false
  }
}

async function getCurrentAgentCount(orgId: string): Promise<number> {
  const { count } = await supabase
    .from('agent_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'active')

  return count || 0
}

async function getCurrentSeatCount(orgId: string): Promise<number> {
  const { count } = await supabase
    .from('organization_members')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('seat_active', true)

  return count || 0
}

// React hook that delegates to SSOT
export function useOrgFeatureFlags(orgId: string | null) {
  if (!hasShownDeprecationWarning) {
    console.warn('useOrgFeatureFlags is deprecated. Please use useEntitlements from src/lib/entitlements/ssot.ts')
    hasShownDeprecationWarning = true
  }

  const { entitlements, isLoading } = useEntitlements(orgId)
  const [agentCount, setAgentCount] = React.useState(0)
  const [seatCount, setSeatCount] = React.useState(0)
  const [countsLoading, setCountsLoading] = React.useState(true)

  React.useEffect(() => {
    if (!orgId) {
      setAgentCount(0)
      setSeatCount(0)
      setCountsLoading(false)
      return
    }

    Promise.all([
      getCurrentAgentCount(orgId),
      getCurrentSeatCount(orgId)
    ]).then(([agents, seats]) => {
      setAgentCount(agents)
      setSeatCount(seats)
      setCountsLoading(false)
    })
  }, [orgId])

  const flags: FeatureFlags = React.useMemo(() => {
    if (!orgId) {
      return getTrialPlanFlags()
    }

    // Map SSOT limits to legacy format
    const planLimits: PlanLimits = {
      agents: entitlements.limits.agents,
      seats: entitlements.limits.agents, // Use agents as seats for backwards compatibility
      calls_per_month: null, // Not tracked in SSOT
      storage_gb: null // Not tracked in SSOT
    }

    return {
      hasFeature: (feature: string) => {
        const canonicalFeature = LEGACY_FEATURE_MAP[feature]
        if (canonicalFeature) {
          return entitlements.features[canonicalFeature]
        }
        // Fallback to basic features
        return ['basic_calendar', 'email_support'].includes(feature)
      },
      canCreateAgent: entitlements.limits.agents === null || agentCount < entitlements.limits.agents,
      canAddSeat: entitlements.limits.agents === null || seatCount < entitlements.limits.agents,
      planLimits,
      planName: entitlements.planName,
      isActive: entitlements.isActive,
      loading: isLoading || countsLoading
    }
  }, [entitlements, agentCount, seatCount, isLoading, countsLoading, orgId])

  const refresh = React.useCallback(async () => {
    if (orgId) {
      setCountsLoading(true)
      const [agents, seats] = await Promise.all([
        getCurrentAgentCount(orgId),
        getCurrentSeatCount(orgId)
      ])
      setAgentCount(agents)
      setSeatCount(seats)
      setCountsLoading(false)
    }
  }, [orgId])

  return { flags, loading: flags.loading, refresh }
}
