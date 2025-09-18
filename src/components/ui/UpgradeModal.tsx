import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Building2, Users, CreditCard, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

const validatePlanPrices = (planConfig: any): { monthlyOk: boolean; yearlyOk: boolean } => {
  return {
    monthlyOk: isProbablyLivePriceId(planConfig?.stripe_price_id_monthly),
    yearlyOk: isProbablyLivePriceId(planConfig?.stripe_price_id_yearly)
  }
}

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitType: 'org_cap' | 'team_cap';
  hasPendingBilling?: boolean;
}

export function UpgradeModal({ open, onOpenChange, limitType, hasPendingBilling = false }: UpgradeModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // Fetch plan configs on mount
  useEffect(() => {
    const fetchPlanConfigs = async () => {
      try {
        const { data, error } = await supabase
          .from('plan_configs')
          .select('plan_key, display_name, stripe_price_id_monthly, stripe_price_id_yearly')
          .eq('is_active', true);

        if (error) {
          console.error('Error fetching plan configs:', { 
            error: error.message, 
            correlationId: crypto.randomUUID() 
          });
          toast({
            title: "Configuration Error",
            description: "Unable to load plan configurations. Please contact support.",
            variant: "destructive",
          });
          return;
        }

        setPlans(data || []);
      } catch (error: any) {
        console.error('Unexpected error fetching plan configs:', { 
          error: error.message, 
          correlationId: crypto.randomUUID() 
        });
        toast({
          title: "Configuration Error", 
          description: "Unable to load plan configurations. Please contact support.",
          variant: "destructive",
        });
      } finally {
        setPlansLoading(false);
      }
    };

    fetchPlanConfigs();
  }, [toast]);

  // Compute disabled state for checkout validation (assuming starter plan)
  const selectedPlanConfig = plans.find(p => p.plan_key === 'starter') || plans.find(p => p.plan_key === 'pro');
  const priceStatus = validatePlanPrices(selectedPlanConfig);
  const checkoutDisabled = plansLoading || !selectedPlanConfig || !(priceStatus.monthlyOk || priceStatus.yearlyOk);

  const handleViewPlans = () => {
    onOpenChange(false);
    navigate('/pricing');
  };

  const handleUpgradeNow = () => {
    // Block checkout if prices are not valid
    if (checkoutDisabled) {
      toast({
        title: "Plan Configuration Error",
        description: "This plan isn't fully configured with live Stripe prices. Please contact support for assistance.",
        variant: "destructive",
      });
      return;
    }
    
    onOpenChange(false);
    // Navigate to billing with recommended plan preselected
    navigate('/settings/organization?tab=billing&plan=starter');
  };

  const handleContactSales = () => {
    window.location.href = 'mailto:sales@yourcompany.com?subject=Enterprise Plan Inquiry';
  };

  const handleResumeCheckout = () => {
    // Block checkout if prices are not valid
    if (checkoutDisabled) {
      toast({
        title: "Plan Configuration Error",
        description: "This plan isn't fully configured with live Stripe prices. Please contact support for assistance.",
        variant: "destructive",
      });
      return;
    }
    
    onOpenChange(false);
    navigate('/settings/organization?tab=billing&resume=true');
  };

  const getContent = () => {
    switch (limitType) {
      case 'org_cap':
        return {
          icon: <Building2 className="h-6 w-6 text-primary" />,
          title: "Add more organizations",
          description: "Free accounts include 1 organization. To add more, choose a paid plan."
        };
      case 'team_cap':
        return {
          icon: <Users className="h-6 w-6 text-primary" />,
          title: "Add more team members",
          description: "Free accounts include 1 team member. To add more, choose a paid plan."
        };
      default:
        return {
          icon: <Crown className="h-6 w-6 text-primary" />,
          title: "Upgrade Required",
          description: "Your current plan doesn't support this feature."
        };
    }
  };

  const content = getContent();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            {content.icon}
          </div>
          <DialogTitle className="text-xl">{content.title}</DialogTitle>
          <DialogDescription className="text-base">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {/* Plan Comparison */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-2">
              <CardContent className="p-4">
                <div className="text-center space-y-2">
                  <Badge variant="outline">Current Plan</Badge>
                  <h3 className="font-semibold">Free</h3>
                  <p className="text-2xl font-bold">$0</p>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>1 Organization</div>
                    <div>1 Team Member</div>
                    <div>Basic Features</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary bg-primary/5">
              <CardContent className="p-4">
                <div className="text-center space-y-2">
                  <Badge className="bg-primary text-primary-foreground">Recommended</Badge>
                  <h3 className="font-semibold">Starter</h3>
                  <p className="text-2xl font-bold">$29</p>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>5 Organizations</div>
                    <div>25 Team Members</div>
                    <div>All Features</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {hasPendingBilling && (
              <Button 
                onClick={handleResumeCheckout}
                disabled={checkoutDisabled || plansLoading}
                className="w-full"
                size="lg"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Resume Checkout
              </Button>
            )}
            
            <Button 
              onClick={handleUpgradeNow}
              disabled={checkoutDisabled || plansLoading}
              className="w-full"
              size="lg"
              variant={hasPendingBilling ? "outline" : "default"}
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade Now
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={handleViewPlans}
                variant="outline"
                className="w-full"
              >
                View All Plans
              </Button>
              
              <Button 
                onClick={handleContactSales}
                variant="outline"
                className="w-full"
              >
                <Mail className="h-4 w-4 mr-2" />
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}