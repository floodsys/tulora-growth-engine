import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, DollarSign, Calendar, Download, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface BillingSettingsProps {
  organizationId?: string;
}

interface BillingInfo {
  plan: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  seats_used: number;
  seats_total: number;
  monthly_cost: number;
  usage_this_month: {
    calls: number;
    minutes: number;
    cost: number;
  };
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: string;
  invoice_url?: string;
}

export function BillingSettings({ organizationId }: BillingSettingsProps) {
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (organizationId) {
      loadBillingInfo();
      loadInvoices();
    }
  }, [organizationId]);

  const loadBillingInfo = async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('organizations')
        .select(`
          plan_key,
          billing_status,
          trial_ends_at,
          trial_started_at
        `)
        .eq('id', organizationId)
        .single();

      if (error) throw error;

      // Mock billing info since actual Stripe integration would be more complex
      const mockBillingInfo: BillingInfo = {
        plan: data.plan_key || 'free',
        status: data.billing_status || 'active',
        current_period_start: data.trial_started_at || new Date().toISOString(),
        current_period_end: data.trial_ends_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        seats_used: 1,
        seats_total: 1,
        monthly_cost: data.plan_key === 'pro' ? 99 : 0,
        usage_this_month: {
          calls: 1250,
          minutes: 2840,
          cost: 142.50
        }
      };

      setBillingInfo(mockBillingInfo);
    } catch (error) {
      console.error('Error loading billing info:', error);
      toast({
        title: "Error",
        description: "Failed to load billing information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    // Mock invoices data
    const mockInvoices: Invoice[] = [
      {
        id: 'inv_001',
        date: '2024-12-01',
        amount: 99.00,
        status: 'paid'
      },
      {
        id: 'inv_002',
        date: '2024-11-01',
        amount: 99.00,
        status: 'paid'
      },
      {
        id: 'inv_003',
        date: '2024-10-01',
        amount: 99.00,
        status: 'paid'
      }
    ];

    setInvoices(mockInvoices);
  };

  const handleManageSubscription = async () => {
    if (!organizationId) return;

    setActionLoading('manage');
    try {
      // This would call your Stripe customer portal edge function
      toast({
        title: "Redirecting...",
        description: "Opening Stripe customer portal",
      });
      
      // Mock redirect delay
      setTimeout(() => {
        setActionLoading(null);
        toast({
          title: "Portal access",
          description: "Customer portal would open in a new tab",
        });
      }, 2000);
    } catch (error) {
      console.error('Error accessing customer portal:', error);
      toast({
        title: "Error",
        description: "Failed to access customer portal",
        variant: "destructive",
      });
      setActionLoading(null);
    }
  };

  const handleUpgradePlan = async () => {
    setActionLoading('upgrade');
    try {
      // This would call your Stripe checkout edge function
      toast({
        title: "Redirecting...",
        description: "Opening upgrade checkout",
      });
      
      setTimeout(() => {
        setActionLoading(null);
        toast({
          title: "Checkout ready",
          description: "Upgrade checkout would open in a new tab",
        });
      }, 2000);
    } catch (error) {
      console.error('Error starting upgrade:', error);
      toast({
        title: "Error",
        description: "Failed to start upgrade process",
        variant: "destructive",
      });
      setActionLoading(null);
    }
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'pro': return 'bg-green-100 text-green-800';
      case 'enterprise': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'past_due': return 'bg-red-100 text-red-800';
      case 'canceled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Billing & Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>
            Manage your subscription and billing information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {billingInfo && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Plan:</span>
                    <Badge className={getPlanBadgeColor(billingInfo.plan)}>
                      {billingInfo.plan.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge className={getStatusBadgeColor(billingInfo.status)}>
                      {billingInfo.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Monthly Cost:</span>
                    <span className="font-semibold">${billingInfo.monthly_cost}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Seats Used:</span>
                    <span>{billingInfo.seats_used} / {billingInfo.seats_total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Billing Period:</span>
                    <span className="text-sm">
                      {format(new Date(billingInfo.current_period_start), 'MMM d')} - {format(new Date(billingInfo.current_period_end), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Next Billing:</span>
                    <span className="text-sm">
                      {format(new Date(billingInfo.current_period_end), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex gap-4">
                <Button 
                  onClick={handleManageSubscription}
                  disabled={actionLoading === 'manage'}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {actionLoading === 'manage' ? 'Loading...' : 'Manage Subscription'}
                </Button>
                {billingInfo.plan === 'free' && (
                  <Button 
                    variant="outline"
                    onClick={handleUpgradePlan}
                    disabled={actionLoading === 'upgrade'}
                  >
                    {actionLoading === 'upgrade' ? 'Loading...' : 'Upgrade Plan'}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Usage This Month */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Usage This Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          {billingInfo && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{billingInfo.usage_this_month.calls.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Calls</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{billingInfo.usage_this_month.minutes.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Minutes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">${billingInfo.usage_this_month.cost}</div>
                <div className="text-sm text-muted-foreground">Total Cost</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Invoice History
          </CardTitle>
          <CardDescription>
            Download and view your past invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-medium">
                      Invoice for {format(new Date(invoice.date), 'MMMM yyyy')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(invoice.date), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <Badge className={invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                    {invoice.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold">${invoice.amount.toFixed(2)}</span>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}