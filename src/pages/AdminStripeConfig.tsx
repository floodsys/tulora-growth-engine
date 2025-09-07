import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_ANON } from '@/config/publicConfig';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AdminGuard } from '@/components/guards/AdminGuard';
import { Loader2, Settings, HelpCircle } from 'lucide-react';
import { StripeStatusCard } from '@/components/admin/StripeStatusCard';
import { PlanConfigCard } from '@/components/admin/PlanConfigCard';
import { StripeSetupInstructions } from '@/components/admin/StripeSetupInstructions';
import { ReadinessBanner } from '@/components/admin/ReadinessBanner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PlanConfig {
  plan_key: string;
  display_name: string;
  stripe_price_id_monthly: string | null;
  stripe_setup_price_id: string | null;
}

interface Status {
  portalEnabled: boolean;
  webhookReachable: boolean;
  allPaidPlansConfigured: boolean;
  isLiveReady: boolean;
}

export default function AdminStripeConfig() {
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [status, setStatus] = useState<Status>({ portalEnabled: false, webhookReachable: false, allPaidPlansConfigured: false, isLiveReady: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-stripe-config`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'apikey': SUPABASE_ANON,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setPlans(data.plans || []);
      setStatus(data.status || { portalEnabled: false, webhookReachable: false, allPaidPlansConfigured: false, isLiveReady: false });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load Stripe configuration",
        variant: "destructive"
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast({
      title: "Refreshed",
      description: "Stripe configuration status updated"
    });
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    loadData();
  }, []);

  const handleSave = async (plan: PlanConfig) => {
    setSaving(plan.plan_key);
    try {
      const { error } = await supabase.functions.invoke('admin-stripe-config', {
        body: {
          plan_key: plan.plan_key,
          stripe_price_id_monthly: plan.stripe_price_id_monthly,
          stripe_setup_price_id: plan.stripe_setup_price_id
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Updated ${plan.display_name} pricing configuration`
      });
    } catch (error) {
      console.error('Error saving plan:', error);
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive"
      });
    } finally {
      setSaving(null);
    }
  };

  const updatePlan = (planKey: string, field: string, value: string) => {
    setPlans(prev => prev.map(plan => 
      plan.plan_key === planKey 
        ? { ...plan, [field]: value }
        : plan
    ));
  };

  // Group plans by product line, hide legacy "Core" plans
  const groupedPlans = plans.reduce((acc, plan) => {
    let category = '';
    if (plan.plan_key.includes('leadgen')) category = 'Lead Generation';
    else if (plan.plan_key.includes('support')) category = 'Phone Support';
    else return acc; // Skip legacy/core plans
    
    if (!acc[category]) acc[category] = [];
    acc[category].push(plan);
    return acc;
  }, {} as Record<string, PlanConfig[]>);

  if (loading) {
    return (
      <AdminGuard>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Settings className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">Stripe Configuration</h1>
              <p className="text-muted-foreground">Manage pricing plans and billing integration</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowInstructions(!showInstructions)}
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Setup Guide
          </Button>
        </div>

        {/* Live Mode Readiness Banner */}
        <ReadinessBanner status={status} />

        {/* Status Overview */}
        <StripeStatusCard 
          status={status} 
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />

        {/* Setup Instructions */}
        <Collapsible open={showInstructions} onOpenChange={setShowInstructions}>
          <CollapsibleContent>
            <StripeSetupInstructions />
          </CollapsibleContent>
        </Collapsible>

        {/* Plan Configurations */}
        <div className="space-y-6">
          {Object.entries(groupedPlans).map(([category, categoryPlans]) => (
            <div key={category} className="space-y-4">
              <div className="border-b pb-2">
                <h2 className="text-xl font-semibold">{category}</h2>
                <p className="text-sm text-muted-foreground">
                  {categoryPlans.length} plan{categoryPlans.length !== 1 ? 's' : ''} in this category
                </p>
              </div>
              <div className="grid gap-4">
                {categoryPlans.map((plan) => (
                  <PlanConfigCard
                    key={plan.plan_key}
                    plan={plan}
                    onUpdate={updatePlan}
                    onSave={handleSave}
                    saving={saving === plan.plan_key}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminGuard>
  );
}