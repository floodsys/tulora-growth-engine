import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_ANON } from '@/config/publicConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AdminGuard } from '@/components/guards/AdminGuard';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface PlanConfig {
  plan_key: string;
  display_name: string;
  stripe_price_id_monthly: string | null;
  stripe_setup_price_id: string | null;
}

interface Status {
  portalEnabled: boolean;
  webhookReachable: boolean;
}

export default function AdminStripeConfig() {
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [status, setStatus] = useState<Status>({ portalEnabled: false, webhookReachable: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      // Use fetch for GET request since supabase.functions.invoke defaults to POST
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
      setStatus(data.status || { portalEnabled: false, webhookReachable: false });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load Stripe configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Stripe Configuration</h1>
          <div className="flex gap-2">
            <Badge variant={status.portalEnabled ? "default" : "destructive"}>
              {status.portalEnabled ? <CheckCircle className="w-4 h-4 mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
              Portal {status.portalEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
            <Badge variant={status.webhookReachable ? "default" : "destructive"}>
              {status.webhookReachable ? <CheckCircle className="w-4 h-4 mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
              Webhook {status.webhookReachable ? 'Reachable' : 'Unreachable'}
            </Badge>
          </div>
        </div>

        <div className="grid gap-4">
          {plans.map((plan) => (
            <Card key={plan.plan_key}>
              <CardHeader>
                <CardTitle className="text-lg">{plan.display_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`monthly-${plan.plan_key}`}>Monthly Price ID</Label>
                    <Input
                      id={`monthly-${plan.plan_key}`}
                      value={plan.stripe_price_id_monthly || ''}
                      onChange={(e) => updatePlan(plan.plan_key, 'stripe_price_id_monthly', e.target.value)}
                      placeholder="price_..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`setup-${plan.plan_key}`}>Setup Price ID</Label>
                    <Input
                      id={`setup-${plan.plan_key}`}
                      value={plan.stripe_setup_price_id || ''}
                      onChange={(e) => updatePlan(plan.plan_key, 'stripe_setup_price_id', e.target.value)}
                      placeholder="price_..."
                    />
                  </div>
                </div>
                <Button 
                  onClick={() => handleSave(plan)}
                  disabled={saving === plan.plan_key}
                  className="w-full md:w-auto"
                >
                  {saving === plan.plan_key && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save {plan.display_name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminGuard>
  );
}