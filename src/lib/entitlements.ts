import React from "react"
import { supabase } from "@/integrations/supabase/client"

export interface Entitlements {
  plan_key: string
  limit_agents?: number | null
  limit_seats?: number
  features?: string[]
  [key: string]: any // Allow additional metadata fields
}

export interface OrgLimits {
  canCreateAgent: boolean
  canAddSeat: boolean
  maxAgents: number | null
  maxSeats: number
  hasFeature: (feature: string) => boolean
  planName: string
  isActive: boolean
}

/**
 * Get organization entitlements and check limits/gates
 */
export async function getOrgEntitlements(orgId: string): Promise<OrgLimits> {
  try {
    // Get organization data including cached entitlements
    const { data: org, error } = await supabase
      .from('organizations')
      .select('entitlements, billing_status, plan_key')
      .eq('id', orgId)
      .single()

    if (error || !org) {
      console.error('Error fetching org entitlements:', error)
      return getFreePlanLimits()
    }

    // Check for manual activation
    const manualActivation = (org as any).entitlements?.manual_activation
    const isManuallyActive = manualActivation?.active === true && 
      new Date(manualActivation.ends_at) > new Date()

    // Determine if organization is active (either through billing or manual activation)
    const billingStatus = (org as any).billing_status || 'trialing'
    const isPaidActive = billingStatus === 'active' || billingStatus === 'trialing'
    const isActive = isPaidActive || isManuallyActive
    
    // If not active, return free plan limits
    if (!isActive) {
      return getFreePlanLimits()
    }

    // Use actual plan_key from database
    const planKey = (org as any).plan_key || 'trial'
    const entitlements: Entitlements = { 
      plan_key: planKey,
      ...((org as any).entitlements || {})
    }

    // Get current usage counts
    const [agentCount, seatCount] = await Promise.all([
      getCurrentAgentCount(orgId),
      getCurrentSeatCount(orgId)
    ])

    const maxAgents = entitlements.limit_agents
    const maxSeats = entitlements.limit_seats || 1
    
    return {
      canCreateAgent: maxAgents === null || agentCount < maxAgents,
      canAddSeat: seatCount < maxSeats,
      maxAgents,
      maxSeats,
      hasFeature: (feature: string) => {
        const features = entitlements.features || []
        return features.includes(feature)
      },
      planName: getPlanDisplayName(entitlements.plan_key),
      isActive
    }
  } catch (error) {
    console.error('Error in getOrgEntitlements:', error)
    return getFreePlanLimits()
  }
}

function getFreePlanLimits(): OrgLimits {
  return {
    canCreateAgent: false,
    canAddSeat: false,
    maxAgents: 0,
    maxSeats: 1,
    hasFeature: () => false,
    planName: 'Free',
    isActive: false
  }
}

function getPlanDisplayName(planKey?: string): string {
  // Handle standard plan keys first
  if (planKey === 'pro') return 'Starter';
  if (planKey === 'business') return 'Business';
  if (planKey === 'trial') return 'Trial';
  
  // Handle legacy product line plans
  if (planKey?.includes('leadgen')) return 'Lead Generation';
  if (planKey?.includes('support')) return 'Customer Service';
  if (planKey?.includes('enterprise')) return 'Enterprise';
  return 'Free';
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

/**
 * Hook for React components to easily check entitlements
 */
export function useOrgEntitlements(orgId: string | null) {
  const [limits, setLimits] = React.useState<OrgLimits | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!orgId) {
      setLimits(getFreePlanLimits())
      setLoading(false)
      return
    }

    getOrgEntitlements(orgId).then(setLimits).finally(() => setLoading(false))
  }, [orgId])

  return { limits, loading, refresh: () => orgId && getOrgEntitlements(orgId).then(setLimits) }
}