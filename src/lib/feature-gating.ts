import React from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface PlanLimits {
  agents: number | null
  seats: number | null
  calls_per_month: number | null
  storage_gb: number | null
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

export async function getOrgFeatureFlags(orgId: string): Promise<FeatureFlags> {
  try {
    // Get organization data with plan info
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle()

    if (orgError) {
      console.error('Error fetching organization plan:', orgError)
      return getTrialPlanFlags()
    }

    if (!org) {
      return getTrialPlanFlags()
    }

    // Check for manual activation first
    const manualActivation = (org as any).entitlements?.manual_activation
    const isManuallyActive = manualActivation?.active === true && 
      new Date(manualActivation.ends_at) > new Date()

    // Use billing_status and plan_key, considering manual activation
    const planKey = (org as any).plan_key || 'trial'
    const billingStatus = (org as any).billing_status || 'trialing'
    const isPaidActive = billingStatus === 'active' || billingStatus === 'trialing'
    
    let limits, features, planName, isActive
    
    if (planKey === 'pro') {
      limits = { agents: 10, seats: 20, calls_per_month: 5000, storage_gb: 100 }
      features = ['advanced_analytics', 'voice_sms', 'crm_integrations', 'email_support']
      planName = 'Starter' // Changed from 'Pro' to 'Starter'
      isActive = isPaidActive || isManuallyActive
    } else if (planKey === 'business') {
      limits = { agents: null, seats: null, calls_per_month: null, storage_gb: 500 }
      features = ['advanced_analytics', 'voice_sms', 'crm_integrations', 'email_support', 'white_label', 'api_access', 'account_manager', 'priority_support']
      planName = 'Business'
      isActive = isPaidActive || isManuallyActive
    } else {
      limits = { agents: 1, seats: 1, calls_per_month: 100, storage_gb: 5 }
      features = ['basic_calendar', 'email_support']
      planName = 'Trial'
      isActive = false
    }

    // Get current usage counts
    const [agentCount, seatCount] = await Promise.all([
      getCurrentAgentCount(orgId),
      getCurrentSeatCount(orgId)
    ])

    const planLimits: PlanLimits = {
      agents: limits.agents,
      seats: limits.seats,
      calls_per_month: limits.calls_per_month,
      storage_gb: limits.storage_gb
    }

    return {
      hasFeature: (feature: string) => features.includes(feature),
      canCreateAgent: limits.agents === null || agentCount < limits.agents,
      canAddSeat: limits.seats === null || seatCount < limits.seats,
      planLimits,
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

// React hook for easier component usage
export function useOrgFeatureFlags(orgId: string | null) {
  const [flags, setFlags] = React.useState<FeatureFlags | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!orgId) {
      setFlags(getTrialPlanFlags())
      setLoading(false)
      return
    }

    getOrgFeatureFlags(orgId).then(setFlags).finally(() => setLoading(false))
  }, [orgId])

  const refresh = React.useCallback(() => {
    if (orgId) {
      setLoading(true)
      getOrgFeatureFlags(orgId).then(setFlags).finally(() => setLoading(false))
    }
  }, [orgId])

  return { flags, loading, refresh }
}