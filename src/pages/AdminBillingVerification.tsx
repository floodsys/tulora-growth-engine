import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AdminGuard } from '@/components/guards/AdminGuard';
import { CheckCircle, XCircle, Loader2, ExternalLink, CreditCard, Eye, Zap, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface BillingStatus {
  organization: any;
  subscription: any;
}

interface StripeEvent {
  id: string;
  type: string;
  created: number;
  object: any;
}

export default function AdminBillingVerification() {
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [stripeEvents, setStripeEvents] = useState<StripeEvent[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check for success/cancel from Stripe redirect
    if (searchParams.get('success') === 'true') {
      toast({
        title: "Test Checkout Complete",
        description: "Stripe test payment completed successfully!",
      });
      // Refresh billing status
      if (orgId) {
        fetchBillingStatus();
      }
    } else if (searchParams.get('canceled') === 'true') {
      toast({
        title: "Test Checkout Canceled",
        description: "Stripe test payment was canceled",
        variant: "destructive"
      });
    }
  }, [searchParams, orgId]);

  const fetchBillingStatus = async () => {
    if (!orgId) return;
    
    setLoading('status');
    try {
      const { data, error } = await supabase.functions.invoke('admin-billing-verification', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: new URLSearchParams({ action: 'status', orgId })
      });

      if (error) throw error;
      setBillingStatus(data);
    } catch (error) {
      console.error('Error fetching billing status:', error);
      toast({
        title: "Error",
        description: "Failed to fetch billing status",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const fetchStripeEvents = async () => {
    setLoading('events');
    try {
      const { data, error } = await supabase.functions.invoke('admin-billing-verification', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: new URLSearchParams({ action: 'events' })
      });

      if (error) throw error;
      setStripeEvents(data.events || []);
    } catch (error) {
      console.error('Error fetching Stripe events:', error);
      toast({
        title: "Error",
        description: "Failed to fetch Stripe events",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const startTestCheckout = async (planKey: string) => {
    if (!orgId) {
      toast({
        title: "Error",
        description: "Please enter an Organization ID first",
        variant: "destructive"
      });
      return;
    }

    setLoading(planKey);
    try {
      const { data, error } = await supabase.functions.invoke('admin-billing-verification', {
        body: { planKey, orgId }
      });

      if (error) throw error;
      
      setCustomerId(data.customerId);
      // Open Stripe checkout in new tab for testing
      window.open(data.url, '_blank');
      
      toast({
        title: "Test Checkout Started",
        description: `Opening Stripe checkout for ${planKey} plan`,
      });
    } catch (error) {
      console.error('Error starting test checkout:', error);
      toast({
        title: "Error",
        description: "Failed to start test checkout",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const openCustomerPortal = async () => {
    if (!customerId) {
      toast({
        title: "Error",
        description: "No customer ID available. Complete a test checkout first.",
        variant: "destructive"
      });
      return;
    }

    setLoading('portal');
    try {
      const { data, error } = await supabase.functions.invoke('admin-billing-verification', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: new URLSearchParams({ action: 'portal', customerId })
      });

      if (error) throw error;
      window.open(data.url, '_blank');
      
      toast({
        title: "Customer Portal Opened",
        description: "Stripe customer portal opened in new tab",
      });
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast({
        title: "Error",
        description: "Failed to open customer portal",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <AdminGuard>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Billing Verification</h1>
          <Badge variant="outline" className="text-yellow-600">
            Test Mode
          </Badge>
        </div>

        {/* Organization Input */}
        <Card>
          <CardHeader>
            <CardTitle>Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Organization ID"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md"
              />
              <Button onClick={fetchBillingStatus} disabled={!orgId || loading === 'status'}>
                {loading === 'status' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Eye className="w-4 h-4 mr-2" />
                Check Status
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Checkouts */}
        <Card>
          <CardHeader>
            <CardTitle>Test Checkouts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => startTestCheckout('leadgen_starter')}
                disabled={!orgId || loading === 'leadgen_starter'}
                variant="outline"
                className="h-20 flex-col"
              >
                {loading === 'leadgen_starter' && <Loader2 className="w-4 h-4 mb-2 animate-spin" />}
                <Zap className="w-6 h-6 mb-2" />
                Lead Gen Starter
                <span className="text-sm text-muted-foreground">Test with 4242 card</span>
              </Button>
              
              <Button
                onClick={() => startTestCheckout('support_business')}
                disabled={!orgId || loading === 'support_business'}
                variant="outline"
                className="h-20 flex-col"
              >
                {loading === 'support_business' && <Loader2 className="w-4 h-4 mb-2 animate-spin" />}
                <Users className="w-6 h-6 mb-2" />
                Customer Service Business
                <span className="text-sm text-muted-foreground">Test with 4242 card</span>
              </Button>
            </div>

            <Button
              onClick={openCustomerPortal}
              disabled={!customerId || loading === 'portal'}
              className="w-full"
            >
              {loading === 'portal' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Customer Portal
            </Button>
          </CardContent>
        </Card>

        {/* Billing Status */}
        {billingStatus && (
          <Card>
            <CardHeader>
              <CardTitle>Current Billing Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Organization</label>
                  <div className="p-2 bg-muted rounded">
                    <div className="font-mono text-sm">{billingStatus.organization?.name}</div>
                    <div className="text-xs text-muted-foreground">{billingStatus.organization?.id}</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plan Key</label>
                  <div className="p-2 bg-muted rounded">
                    <Badge variant="secondary">
                      {billingStatus.organization?.plan_key || 'none'}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Billing Status</label>
                  <div className="p-2 bg-muted rounded">
                    <Badge variant={billingStatus.organization?.billing_status === 'active' ? "default" : "secondary"}>
                      {billingStatus.organization?.billing_status || 'unknown'}
                    </Badge>
                  </div>
                </div>
              </div>

              {billingStatus.subscription && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subscription Details</label>
                  <div className="p-3 bg-muted rounded space-y-1">
                    <div className="text-sm">
                      <strong>Status:</strong> {billingStatus.subscription.status}
                    </div>
                    <div className="text-sm">
                      <strong>Current Period End:</strong> {
                        billingStatus.subscription.current_period_end 
                          ? new Date(billingStatus.subscription.current_period_end).toLocaleDateString()
                          : 'N/A'
                      }
                    </div>
                    <div className="text-sm">
                      <strong>Stripe Customer ID:</strong> {billingStatus.subscription.stripe_customer_id || 'N/A'}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stripe Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent Stripe Events
              <Button onClick={fetchStripeEvents} disabled={loading === 'events'} variant="outline" size="sm">
                {loading === 'events' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stripeEvents.length > 0 ? (
              <div className="space-y-2">
                {stripeEvents.map((event) => (
                  <div key={event.id} className="p-3 border rounded space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{event.type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.created * 1000).toLocaleString()}
                      </span>
                    </div>
                    <div className="font-mono text-xs">{event.id}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Click Refresh to load recent Stripe events
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}