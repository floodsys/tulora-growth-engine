import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Types for product-line entitlements
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

/**
 * Hook for product-line aware feature gating
 * Provides access to entitlements grouped by product line (leadgen/support)
 */
export function useProductLineGating(orgId: string | null): ProductLineGating {
  const [entitlements, setEntitlements] = useState<OrgEntitlements>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntitlements = async () => {
    if (!orgId) {
      setEntitlements({});
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Call the server-side entitlements aggregator
      const { data, error: rpcError } = await supabase
        .rpc('get_org_entitlements', { p_org_id: orgId });

      if (rpcError) {
        throw rpcError;
      }

      // Type guard for the response data
      const typedData = data as unknown;
      if (typedData && typeof typedData === 'object' && !Array.isArray(typedData)) {
        setEntitlements(typedData as OrgEntitlements);
      } else {
        setEntitlements({});
      }
    } catch (err) {
      console.error('Error fetching entitlements:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setEntitlements({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntitlements();
  }, [orgId]);

  // Helper functions for product-line aware gating
  const isSubscribed = (productLine: 'leadgen' | 'support'): boolean => {
    return !!entitlements[productLine];
  };

  const hasFeature = (productLine: 'leadgen' | 'support', feature: string): boolean => {
    const productEntitlements = entitlements[productLine];
    if (!productEntitlements) return false;
    
    return productEntitlements.features.includes(feature);
  };

  const getLimits = (productLine: 'leadgen' | 'support'): Record<string, any> => {
    const productEntitlements = entitlements[productLine];
    return productEntitlements?.limits || {};
  };

  const getPlanKey = (productLine: 'leadgen' | 'support'): string | null => {
    return entitlements[productLine]?.plan_key || null;
  };

  const getPlanName = (productLine: 'leadgen' | 'support'): string | null => {
    return entitlements[productLine]?.plan_name || null;
  };

  const refresh = async () => {
    setLoading(true);
    await fetchEntitlements();
  };

  return {
    entitlements,
    loading,
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