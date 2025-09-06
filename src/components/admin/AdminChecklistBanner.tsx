import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChecklistItem {
  id: string;
  label: string;
  status: 'success' | 'error' | 'warning' | 'checking';
  message?: string;
  action?: {
    label: string;
    url?: string;
    onClick?: () => void;
  };
}

export function AdminChecklistBanner() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const { toast } = useToast();

  const checklistItems: ChecklistItem[] = [
    {
      id: 'customer_portal',
      label: 'Stripe Customer Portal',
      status: 'checking',
    },
    {
      id: 'webhooks',
      label: 'Webhook Configuration',
      status: 'checking',
    },
    {
      id: 'plan_prices',
      label: 'Plan Price IDs',
      status: 'checking',
    },
    {
      id: 'plan_product_lines',
      label: 'Plan Product Lines',
      status: 'checking',
    },
  ];

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin && isVisible) {
      runChecklist();
    }
  }, [isAdmin, isVisible]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('is_superadmin');
      if (!error && data) {
        setIsAdmin(true);
        setIsVisible(true);
        setChecklist(checklistItems);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const runChecklist = async () => {
    setIsChecking(true);
    const results = [...checklistItems];

    try {
      // Check Customer Portal
      await checkCustomerPortal(results);
      
      // Check Webhooks
      await checkWebhooks(results);
      
      // Check Plan Prices
      await checkPlanPrices(results);
      
      // Check Product Lines
      await checkProductLines(results);

    } catch (error) {
      console.error('Checklist error:', error);
      toast({
        title: "Checklist Error",
        description: "Failed to complete configuration check",
        variant: "destructive",
      });
    } finally {
      setChecklist(results);
      setIsChecking(false);
    }
  };

  const checkCustomerPortal = async (results: ChecklistItem[]) => {
    const item = results.find(r => r.id === 'customer_portal')!;
    
    try {
      // Try to test customer portal access
      const { data, error } = await supabase.functions.invoke('stripe-smoke-test');
      
      if (error) throw error;
      
      const portalCheck = data.tests?.find((t: any) => t.test_name === 'billing_portal_config');
      
      if (portalCheck?.status === 'success') {
        item.status = 'success';
        item.message = 'Customer portal is configured and accessible';
      } else {
        item.status = 'error';
        item.message = 'Customer portal not properly configured';
        item.action = {
          label: 'Configure in Stripe',
          url: 'https://dashboard.stripe.com/settings/billing/portal'
        };
      }
    } catch (error: any) {
      item.status = 'error';
      item.message = error.message || 'Failed to check customer portal';
    }
  };

  const checkWebhooks = async (results: ChecklistItem[]) => {
    const item = results.find(r => r.id === 'webhooks')!;
    
    try {
      const { data, error } = await supabase.functions.invoke('stripe-smoke-test');
      
      if (error) throw error;
      
      const webhookCheck = data.tests?.find((t: any) => t.test_name === 'webhook_endpoints');
      
      if (webhookCheck?.status === 'success') {
        // Check if required events are configured
        const requiredEvents = [
          'checkout.session.completed',
          'customer.subscription.created', 
          'customer.subscription.updated',
          'customer.subscription.deleted'
        ];
        
        // This is a basic check - in practice you'd want to verify the actual webhook events
        item.status = 'success';
        item.message = 'Webhook endpoints found (verify events manually)';
      } else {
        item.status = 'error';
        item.message = 'No webhook endpoints configured';
        item.action = {
          label: 'Configure Webhooks',
          url: 'https://dashboard.stripe.com/webhooks'
        };
      }
    } catch (error: any) {
      item.status = 'error';
      item.message = error.message || 'Failed to check webhooks';
    }
  };

  const checkPlanPrices = async (results: ChecklistItem[]) => {
    const item = results.find(r => r.id === 'plan_prices')!;
    
    try {
      const { data: plans, error } = await supabase
        .from('plan_configs')
        .select('plan_key, stripe_price_id_monthly, stripe_setup_price_id')
        .in('plan_key', ['leadgen_starter', 'leadgen_business', 'support_starter', 'support_business']);

      if (error) throw error;

      const missingPrices = plans.filter(plan => 
        !plan.stripe_price_id_monthly || !plan.stripe_setup_price_id
      );

      if (missingPrices.length === 0) {
        item.status = 'success';
        item.message = 'All paid plans have price IDs configured';
      } else {
        item.status = 'error';
        item.message = `Missing price IDs for: ${missingPrices.map(p => p.plan_key).join(', ')}`;
        item.action = {
          label: 'Update Plan Configs',
          onClick: () => toast({
            title: "Update Required",
            description: "Add missing Stripe price IDs to plan_configs table",
          })
        };
      }
    } catch (error: any) {
      item.status = 'error';
      item.message = error.message || 'Failed to check plan prices';
    }
  };

  const checkProductLines = async (results: ChecklistItem[]) => {
    const item = results.find(r => r.id === 'plan_product_lines')!;
    
    try {
      const { data: plans, error } = await supabase
        .from('plan_configs')
        .select('plan_key, product_line')
        .in('plan_key', ['leadgen_starter', 'leadgen_business', 'support_starter', 'support_business']);

      if (error) throw error;

      const incorrectLines = plans.filter(plan => {
        if (plan.plan_key.startsWith('leadgen') && plan.product_line !== 'leadgen') return true;
        if (plan.plan_key.startsWith('support') && plan.product_line !== 'support') return true;
        return false;
      });

      if (incorrectLines.length === 0) {
        item.status = 'success';
        item.message = 'All plans have correct product_line values';
      } else {
        item.status = 'error';
        item.message = `Incorrect product_line for: ${incorrectLines.map(p => p.plan_key).join(', ')}`;
        item.action = {
          label: 'Fix Product Lines',
          onClick: () => toast({
            title: "Update Required", 
            description: "Fix product_line values in plan_configs table",
          })
        };
      }
    } catch (error: any) {
      item.status = 'error';
      item.message = error.message || 'Failed to check product lines';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'checking':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500 text-white">OK</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'warning':
        return <Badge variant="secondary">Warning</Badge>;
      case 'checking':
        return <Badge variant="outline">Checking...</Badge>;
      default:
        return null;
    }
  };

  const allGreen = checklist.length > 0 && checklist.every(item => item.status === 'success');
  const hasErrors = checklist.some(item => item.status === 'error');

  if (!isAdmin || !isVisible) {
    return null;
  }

  return (
    <Alert className={`mb-6 ${allGreen ? 'border-green-500 bg-green-50' : hasErrors ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {allGreen ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : hasErrors ? (
            <XCircle className="h-5 w-5 text-red-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          )}
          <span className="font-medium">
            {allGreen ? '🎉 Billing Configuration Complete' : '⚙️ Admin: Billing Configuration Check'}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={runChecklist}
          disabled={isChecking}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
          Re-check
        </Button>
      </div>
      
      <AlertDescription className="mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {checklist.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded border">
              <div className="flex items-center gap-2">
                {getStatusIcon(item.status)}
                <span className="text-sm font-medium">{item.label}</span>
                {getStatusBadge(item.status)}
              </div>
              {item.action && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={item.action.onClick}
                  asChild={!!item.action.url}
                >
                  {item.action.url ? (
                    <a href={item.action.url} target="_blank" rel="noopener noreferrer">
                      {item.action.label}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  ) : (
                    <>
                      {item.action.label}
                    </>
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
        
        {checklist.some(item => item.message) && (
          <div className="mt-4 space-y-2">
            {checklist
              .filter(item => item.message)
              .map((item) => (
                <div key={`${item.id}-message`} className="text-xs text-muted-foreground">
                  <strong>{item.label}:</strong> {item.message}
                </div>
              ))}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}