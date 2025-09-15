import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, DollarSign, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BillingOverview {
  total_subscriptions: number;
  total_mrr: number;
  trial_count: number;
  active_count: number;
  past_due_count: number;
  canceled_count: number;
}

interface StripeStatusCardProps {
  refreshing?: boolean;
}

export function StripeStatusCard({ refreshing = false }: StripeStatusCardProps) {
  const { toast } = useToast();
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBillingOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase.functions.invoke('admin-billing-overview', {
        body: { action: 'list_subscriptions' }
      });

      if (error) throw error;

      // Calculate overview from subscription data
      const subscriptions = data.subscriptions || [];
      const overview: BillingOverview = {
        total_subscriptions: subscriptions.length,
        total_mrr: subscriptions.reduce((sum: number, sub: any) => sum + (sub.mrr || 0), 0),
        trial_count: subscriptions.filter((sub: any) => sub.status === 'trialing').length,
        active_count: subscriptions.filter((sub: any) => sub.status === 'active').length,
        past_due_count: subscriptions.filter((sub: any) => sub.status === 'past_due').length,
        canceled_count: subscriptions.filter((sub: any) => sub.status === 'canceled').length,
      };

      setOverview(overview);
    } catch (err) {
      console.error('Error fetching billing overview:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      toast({
        title: "Error",
        description: "Failed to fetch billing overview",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingOverview();
  }, []);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Billing Overview...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error || !overview) {
    return (
      <Card className="border-l-4 border-l-red-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold text-destructive">Billing Overview Error</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchBillingOverview}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const healthStatus = overview.past_due_count === 0 ? 'healthy' : 'issues';
  
  return (
    <Card className={`border-l-4 ${healthStatus === 'healthy' ? 'border-l-green-500' : 'border-l-yellow-500'}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Billing Overview</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchBillingOverview}
          disabled={loading || refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Monthly Recurring Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(overview.total_mrr)}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-secondary/10">
              <Users className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="font-medium">Total Subscriptions</p>
              <p className="text-2xl font-bold">{overview.total_subscriptions}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="font-medium">Active Subscriptions</p>
              <p className="text-2xl font-bold">{overview.active_count}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div className="text-center">
            <Badge variant="secondary" className="text-primary">
              {overview.trial_count} Trial
            </Badge>
          </div>
          <div className="text-center">
            <Badge variant="secondary" className="text-success">
              {overview.active_count} Active
            </Badge>
          </div>
          <div className="text-center">
            <Badge variant={overview.past_due_count > 0 ? "destructive" : "secondary"}>
              {overview.past_due_count} Past Due
            </Badge>
          </div>
          <div className="text-center">
            <Badge variant="secondary" className="text-muted-foreground">
              {overview.canceled_count} Canceled
            </Badge>
          </div>
        </div>
        
        {overview.past_due_count > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Past Due Subscriptions Detected</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {overview.past_due_count} subscription(s) require attention. Check payment methods and retry failed charges.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}