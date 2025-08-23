import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlanLimits {
  agents: number | null;
  seats: number | null;
  calls_per_month: number | null;
  storage_gb: number | null;
  integrations: string[];
}

export interface FeatureAccess {
  hasFeature: (feature: string) => boolean;
  canPerformAction: (action: string) => boolean;
  planLimits: PlanLimits | null;
  planName: string;
  loading: boolean;
  refresh: () => void;
}

export function useFeatureGating(organizationId: string | null): FeatureAccess {
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [planName, setPlanName] = useState('Trial');
  const [loading, setLoading] = useState(true);

  const checkFeatureAccess = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      // Get organization plan and limits
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select(`
          plan_key,
          billing_status,
          entitlements,
          plan_configs!inner(
            display_name,
            limits,
            features
          )
        `)
        .eq('id', organizationId)
        .single();

      if (orgError) {
        console.error('Error fetching organization plan:', orgError);
        setLoading(false);
        return;
      }

      if (org) {
        setPlanName(org.plan_configs.display_name);
        setPlanLimits(org.plan_configs.limits as unknown as PlanLimits);
      }
    } catch (error) {
      console.error('Error in feature gating check:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkFeatureAccess();
  }, [organizationId]);

  const hasFeature = (feature: string): boolean => {
    if (!organizationId) return false;
    
    // For demo purposes, we'll implement basic feature checking
    // In production, this would call the has_feature database function
    const basicFeatures = ['basic_calendar', 'email_support', 'knowledge_base'];
    const premiumFeatures = ['advanced_analytics', 'white_label', 'api_access', 'account_manager'];
    
    if (planName === 'Trial') {
      return basicFeatures.includes(feature);
    } else if (planName === 'Starter') {
      return basicFeatures.includes(feature) || ['voice_sms', 'basic_analytics', 'crm_basic'].includes(feature);
    } else if (planName === 'Business') {
      return true; // Business plan has all features
    }
    
    return false;
  };

  const canPerformAction = (action: string): boolean => {
    if (!organizationId || !planLimits) return false;
    
    // This would typically call the can_perform_action database function
    // For now, we'll implement basic limits checking
    switch (action) {
      case 'create_agent':
        return planLimits.agents === null || true; // Simplified for demo
      case 'add_seat':
        return planLimits.seats === null || true; // Simplified for demo
      case 'make_call':
        return planLimits.calls_per_month === null || true; // Simplified for demo
      default:
        return true;
    }
  };

  return {
    hasFeature,
    canPerformAction,
    planLimits,
    planName,
    loading,
    refresh: checkFeatureAccess
  };
}