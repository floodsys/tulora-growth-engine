import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_ANON } from '@/config/publicConfig';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AdminGuard } from '@/components/guards/AdminGuard';
import { Loader2, Settings, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { StripeStatusCard } from '@/components/admin/StripeStatusCard';
import { PlanConfigCard } from '@/components/admin/PlanConfigCard';
import { StripeSetupInstructions } from '@/components/admin/StripeSetupInstructions';
import { ReadinessBanner } from '@/components/admin/ReadinessBanner';
import { CorePlanMigration } from '@/components/admin/CorePlanMigration';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PlanConfig {
  plan_key: string;
  display_name: string;
  stripe_price_id_monthly: string | null;
  stripe_setup_price_id: string | null;
  product_line?: string;
}

interface Status {
  portalEnabled: boolean;
  webhookReachable: boolean;
  allPaidPlansConfigured: boolean;
  isLiveReady: boolean;
}

interface HealthCheck {
  coreWarning?: {
    message: string;
    corePlans: Array<{ plan_key: string; display_name: string }>;
  } | null;
}

export default function AdminStripeConfig() {
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [status, setStatus] = useState<Status>({ portalEnabled: false, webhookReachable: false, allPaidPlansConfigured: false, isLiveReady: false });
  const [healthCheck, setHealthCheck] = useState<HealthCheck>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
      setHealthCheck(data.healthCheck || {});
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

  // Filter to show only the four paid plans plus enterprise plans
  const allowedPlans = [
    'leadgen_starter', 'leadgen_business', 'leadgen_enterprise',
    'support_starter', 'support_business', 'support_enterprise'
  ];
  
  const filteredPlans = plans.filter(plan => allowedPlans.includes(plan.plan_key));
  
  // Group plans by product line
  const groupedPlans = filteredPlans.reduce((acc, plan) => {
    let category = '';
    if (plan.plan_key.includes('leadgen')) category = 'AI Lead Generation';
    else if (plan.plan_key.includes('support')) category = 'AI Phone Support';
    else return acc;
    
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
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
              Advanced
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowInstructions(!showInstructions)}
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Setup Guide
            </Button>
          </div>
        </div>

        {/* Health Check Warning */}
        {healthCheck.coreWarning && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="bg-destructive/20 p-1 rounded">
                <HelpCircle className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-1">Configuration Issue Detected</h3>
                <p className="text-sm text-destructive/80 mb-2">{healthCheck.coreWarning.message}</p>
                <div className="text-xs text-destructive/60">
                  Core plans found: {healthCheck.coreWarning.corePlans.map(p => p.plan_key).join(', ')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Mode Readiness Banner */}
        <ReadinessBanner status={status} />

        {/* Status Overview */}
        <StripeStatusCard 
          status={status} 
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />

        {/* Advanced Features */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleContent>
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h2 className="text-xl font-semibold">Advanced Migration Tools</h2>
                <p className="text-sm text-muted-foreground">
                  One-time migration utilities for transitioning from legacy plan structures
                </p>
              </div>
              <CorePlanMigration />
            </div>
          </CollapsibleContent>
        </Collapsible>

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