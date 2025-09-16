/**
 * @deprecated This module is now a compatibility wrapper over src/lib/entitlements/ssot.ts
 * Please migrate to useEntitlements from the entitlements SSOT for new code.
 * 
 * This file maintains the original API for backwards compatibility while
 * delegating to the new Single Source of Truth implementation.
 */
import { useState, useEffect } from 'react';
import { useEntitlements } from '@/lib/entitlements/ssot';

// Types for product-line entitlements (kept for API compatibility)
export interface ProductEntitlements {
  plan_key: string;
  plan_name: string;
  status: string;
  quantity: number;
  current_period_end?: string;
  features: string[];
  limits: Record<string, any>;
}

export interface OrgEntitlements {
  leadgen?: ProductEntitlements;
  support?: ProductEntitlements;
  [key: string]: ProductEntitlements | undefined;
}

export interface ProductLineGating {
  entitlements: OrgEntitlements;
  loading: boolean;
  error: string | null;
  isSubscribed: (productLine: 'leadgen' | 'support') => boolean;
  hasFeature: (productLine: 'leadgen' | 'support', feature: string) => boolean;
  getLimits: (productLine: 'leadgen' | 'support') => Record<string, any>;
  getPlanKey: (productLine: 'leadgen' | 'support') => string | null;
  getPlanName: (productLine: 'leadgen' | 'support') => string | null;
  refresh: () => Promise<void>;
}

let hasShownDeprecationWarning = false;

/**
 * Hook for product-line aware feature gating
 * Now delegates to the SSOT entitlements system
 */
export function useProductLineGating(orgId: string | null): ProductLineGating {
  const { entitlements, isLoading, refresh: refreshSSoT } = useEntitlements(orgId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasShownDeprecationWarning) {
      console.warn('useProductLineGating is deprecated. Please use useEntitlements from src/lib/entitlements/ssot.ts');
      hasShownDeprecationWarning = true;
    }
  }, []);

  // Map SSOT entitlements to product-line format
  const mappedEntitlements: OrgEntitlements = {
    // Assume leadgen as the primary product line for backwards compatibility
    leadgen: entitlements.isActive ? {
      plan_key: 'leadgen_starter', // Default mapping
      plan_name: entitlements.planName,
      status: 'active',
      quantity: 1,
      features: Object.entries(entitlements.features)
        .filter(([_, enabled]) => enabled)
        .map(([feature]) => feature),
      limits: entitlements.limits
    } : undefined
  };

  // Helper functions for product-line aware gating
  const isSubscribed = (productLine: 'leadgen' | 'support'): boolean => {
    if (productLine === 'leadgen') {
      return entitlements.isActive;
    }
    return false; // Support not implemented in SSOT yet
  };

  const hasFeature = (productLine: 'leadgen' | 'support', feature: string): boolean => {
    if (productLine === 'leadgen' && entitlements.isActive) {
      // Map feature names to SSOT features
      switch (feature) {
        case 'scheduling':
        case 'appointment_scheduling':
          return entitlements.features.scheduling;
        case 'numbers':
        case 'voice_numbers':
          return entitlements.features.numbers;
        case 'sms':
        case 'messaging':
          return entitlements.features.sms;
        case 'widgets':
        case 'site_widgets':
          return entitlements.features.widgets;
        case 'advanced_analytics':
          return entitlements.features.advancedAnalytics;
        default:
          return false;
      }
    }
    return false;
  };

  const getLimits = (productLine: 'leadgen' | 'support'): Record<string, any> => {
    if (productLine === 'leadgen') {
      return entitlements.limits;
    }
    return {};
  };

  const getPlanKey = (productLine: 'leadgen' | 'support'): string | null => {
    if (productLine === 'leadgen' && entitlements.isActive) {
      // Map based on features to determine plan tier
      if (entitlements.features.advancedAnalytics) {
        return 'leadgen_business';
      }
      if (entitlements.features.scheduling) {
        return 'leadgen_starter';
      }
      return 'leadgen_trial';
    }
    return null;
  };

  const getPlanName = (productLine: 'leadgen' | 'support'): string | null => {
    if (productLine === 'leadgen' && entitlements.isActive) {
      return entitlements.planName;
    }
    return null;
  };

  const refresh = async () => {
    try {
      setError(null);
      await refreshSSoT();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return {
    entitlements: mappedEntitlements,
    loading: isLoading,
    error,
    isSubscribed,
    hasFeature,
    getLimits,
    getPlanKey,
    getPlanName,
    refresh
  };
}

/**
 * Hook for simplified subscription checking
 * Returns whether the org has any active subscriptions
 */
export function useSubscriptionStatus(orgId: string | null) {
  const { entitlements, loading } = useProductLineGating(orgId);
  
  const hasActiveSubscription = Object.keys(entitlements).length > 0;
  const subscribedProducts = Object.keys(entitlements) as ('leadgen' | 'support')[];
  
  return {
    hasActiveSubscription,
    subscribedProducts,
    loading
  };
}

/**
 * Hook for checking specific feature access across all product lines
 */
export function useFeatureAccess(orgId: string | null, feature: string) {
  const { entitlements, loading } = useProductLineGating(orgId);
  
  // Check if feature is available in any subscribed product line
  const hasFeatureAccess = Object.values(entitlements).some(
    productEntitlements => productEntitlements?.features.includes(feature)
  );
  
  // Get which product lines have this feature
  const productLinesWithFeature = Object.entries(entitlements)
    .filter(([, productEntitlements]) => 
      productEntitlements?.features.includes(feature)
    )
    .map(([productLine]) => productLine);
  
  return {
    hasFeatureAccess,
    productLinesWithFeature,
    loading
  };
}