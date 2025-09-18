import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Local validation utilities for Stripe price IDs (mirroring UsageBilling.tsx)
const isProbablyLivePriceId = (priceId: string | null | undefined): boolean => {
  if (!priceId || typeof priceId !== 'string') return false
  // Live Stripe price IDs typically start with 'price_' and are longer than test IDs
  // Test IDs often contain 'test' or are placeholder values like 'placeholder_xxx'
  return priceId.startsWith('price_') && 
         !priceId.includes('test') && 
         !priceId.includes('placeholder') && 
         !priceId.includes('xxx') &&
         priceId.length > 20 // Live price IDs are typically longer
}

const validatePlanPrices = (planConfig: any): { monthlyValid: boolean; yearlyValid: boolean } => {
  return {
    monthlyValid: isProbablyLivePriceId(planConfig?.stripe_price_id_monthly),
    yearlyValid: isProbablyLivePriceId(planConfig?.stripe_price_id_yearly)
  }
}

interface ManualAccessBannerProps {
  organizationId: string;
  planKey: string;
  endsAt: string;
  isActive: boolean;
}

export function ManualAccessBanner({ organizationId, planKey, endsAt, isActive }: ManualAccessBannerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Compute disabled state for checkout validation
  const selectedPlanConfig = { plan_key: planKey } // Minimal plan config for validation
  const priceStatus = validatePlanPrices(selectedPlanConfig)
  const checkoutDisabled = !(priceStatus.monthlyValid || priceStatus.yearlyValid)

  // Only show if manual activation is active and future-dated
  const isValidManualAccess = isActive && new Date(endsAt) > new Date();
  
  if (!isValidManualAccess) {
    return null;
  }

  const planDisplayName = planKey === 'pro' ? 'Starter' : planKey === 'business' ? 'Business' : planKey;
  const formattedDate = format(new Date(endsAt), 'MMM d, yyyy');

  const handleStartSubscription = async () => {
    // Block checkout if prices are not valid
    if (checkoutDisabled) {
      toast({
        title: "Plan Configuration Error",
        description: "This plan isn't fully configured with live Stripe prices. Please contact support for assistance.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-org-checkout', {
        body: { 
          orgId: organizationId, 
          planKey: planKey 
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: "Redirecting to checkout",
          description: "Opening Stripe checkout in a new tab",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error starting subscription",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('org-customer-portal', {
        body: { orgId: organizationId }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: "Redirecting to billing portal",
          description: "Opening customer portal in a new tab",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error accessing billing portal",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
      <Calendar className="h-4 w-4 text-orange-600" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-orange-800 dark:text-orange-200">
          Manual access to <strong>{planDisplayName}</strong> until <strong>{formattedDate}</strong>. 
          Start Subscription to continue.
        </span>
        <div className="flex gap-2 ml-4">
          <Button
            size="sm"
            onClick={handleStartSubscription}
            disabled={isLoading || checkoutDisabled}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <CreditCard className="h-4 w-4 mr-1" />
            Start Subscription
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleManageBilling}
            disabled={isLoading}
            className="border-orange-300 text-orange-700 hover:bg-orange-100"
          >
            Manage Billing
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}