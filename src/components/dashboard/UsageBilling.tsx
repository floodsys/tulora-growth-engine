import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarIcon, Clock, Phone, MessageSquare, Database, CreditCard, ExternalLink, Users, RefreshCw, Zap, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AdminChecklistBanner } from "@/components/admin/AdminChecklistBanner";
import { BillingTestPanel } from "@/components/dashboard/BillingTestPanel";
import { useUsageData } from "@/hooks/useUsageData";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { ConcurrencyCard } from "@/components/dashboard/widgets/ConcurrencyCard";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";

interface UsageData {
  minutes: { used: number; limit: number };
  calls: { used: number; limit: number };
  tokens: { used: number; limit: number };
  plan: {
    name: string;
    billing_cycle: string;
    next_billing_date: string;
  };
  spend: { current: number; limit: number };
}

interface UsageEvent {
  date: string;
  type: string;
  description: string;
  cost: number;
  details: any;
}

interface BillingStatus {
  status: string;
  plan_name: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end?: string;
  last_payment_error?: string;
}

interface UsageBillingProps {
  organizationId: string;
}

export function UsageBilling({ organizationId }: UsageBillingProps) {
  const { toast } = useToast();
  const { dateRange, setDateRange } = useDashboardDateRange();
  const { isAdmin } = useOrganizationRole(organizationId);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [isLoadingBilling, setIsLoadingBilling] = useState(true);
  const [checkoutError, setCheckoutError] = useState<any>(null);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [preflightResults, setPreflightResults] = useState<any>(null);
  const [isRunningPreflight, setIsRunningPreflight] = useState(false);

  // Use real usage data instead of mocks
  const { 
    currentUsage, 
    usageEvents, 
    concurrency, 
    loading: usageLoading, 
    error: usageError,
    refreshUsage,
    refreshConcurrency 
  } = useUsageData(organizationId);

  // Convert usage rollup to expected format
  const usageData: UsageData | null = currentUsage ? {
    minutes: { 
      used: currentUsage.minutes, 
      limit: 5000 // Get from entitlements
    },
    calls: { 
      used: currentUsage.calls, 
      limit: 1000 // Get from entitlements
    },
    tokens: { 
      used: currentUsage.messages * 100, // Estimate tokens from messages
      limit: 250000 // Get from entitlements
    },
    plan: {
      name: "Professional", // Get from billing status
      billing_cycle: "monthly",
      next_billing_date: "2024-02-15" // Get from billing status
    },
    spend: { 
      current: (currentUsage.calls * 0.12) + (currentUsage.minutes * 0.05), // Calculate from usage
      limit: 150 // Get from entitlements
    }
  } : null;

  useEffect(() => {
    if (organizationId) {
      fetchBillingStatus();
    }
  }, [organizationId]);

  const fetchBillingStatus = async () => {
    try {
      setIsLoadingBilling(true);
      const { data, error } = await supabase.functions.invoke('check-org-billing', {
        body: { orgId: organizationId }
      });

      if (error) throw error;

      setBillingStatus(data);
    } catch (error) {
      console.error('Error fetching billing status:', error);
      toast({
        title: "Error",
        description: "Failed to fetch billing status",
        variant: "destructive",
      });
    } finally {
      setIsLoadingBilling(false);
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    return limit > 0 ? Math.round((used / limit) * 100) : 0;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-destructive";
    if (percentage >= 80) return "bg-warning";
    return "bg-primary";
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'ai_tokens':
      case 'ai_generation':
        return <MessageSquare className="h-4 w-4" />;
      case 'kb_operation':
        return <Database className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatEventDetails = (details: any) => {
    if (!details) return '';
    
    if (typeof details === 'string') return details;
    
    const entries = Object.entries(details);
    if (entries.length === 0) return '';
    
    return entries.map(([key, value]) => `${key}: ${value}`).join(', ');
  };

  const getBillingStatusBadge = () => {
    if (isLoadingBilling) {
      return <Badge variant="secondary">Loading...</Badge>;
    }
    
    if (!billingStatus) {
      return <Badge variant="secondary">Unknown</Badge>;
    }

    switch (billingStatus.status) {
      case 'active':
        return <Badge variant="secondary" className="text-success">Active</Badge>;
      case 'trialing':
        return <Badge variant="secondary" className="text-primary">Trial</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Past Due</Badge>;
      case 'canceled':
        return <Badge variant="secondary">Canceled</Badge>;
      default:
        return <Badge variant="secondary">{billingStatus.status}</Badge>;
    }
  };

  const shouldShowUpgradeCTA = () => {
    return billingStatus?.status !== 'active' && billingStatus?.status !== 'trialing';
  };

  const runPreflightCheck = async () => {
    if (!organizationId) return null;
    
    try {
      setIsRunningPreflight(true);
      const { data, error } = await supabase.functions.invoke('billing-preflight', {
        body: { 
          orgId: organizationId,
          planKey: 'leadgen_starter'
        }
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Preflight check failed:', error);
      return {
        success: false,
        overallStatus: 'fail',
        canProceed: false,
        error: error.message
      };
    } finally {
      setIsRunningPreflight(false);
    }
  };

  const handleUpgrade = async () => {
    try {
      setIsUpgrading(true);
      setCheckoutError(null);
      setPreflightResults(null);
      
      // Run preflight check first
      const preflightResult = await runPreflightCheck();
      setPreflightResults(preflightResult);
      
      if (!preflightResult?.canProceed) {
        toast({
          title: "Checkout Blocked",
          description: "Please fix the issues below before proceeding",
          variant: "destructive",
        });
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('create-org-checkout', {
        body: { 
          orgId: organizationId,
          planKey: 'leadgen_starter'
        }
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      
      // Try to parse structured error response
      let parsedError = null;
      try {
        if (error?.message && typeof error.message === 'string') {
          parsedError = JSON.parse(error.message);
        } else if (error && typeof error === 'object') {
          parsedError = error;
        }
      } catch (parseError) {
        parsedError = { message: error?.message || "Failed to start upgrade process" };
      }
      
      setCheckoutError(parsedError);
      setDebugPanelOpen(true);
      
      const errorMsg = parsedError?.message || error?.message || "Failed to start upgrade process";
      toast({
        title: "Checkout Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      setIsOpeningPortal(true);
      const { data, error } = await supabase.functions.invoke('org-customer-portal', {
        body: { orgId: organizationId }
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      toast({
        title: "Error",
        description: "Failed to open billing portal",
        variant: "destructive",
      });
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const handleSyncSeats = async () => {
    try {
      setIsSyncing(true);
      const { data, error } = await supabase.functions.invoke('org-update-seats', {
        body: { orgId: organizationId }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Seat count synchronized successfully",
      });
      
      // Refresh billing status
      await fetchBillingStatus();
    } catch (error) {
      console.error('Error syncing seats:', error);
      toast({
        title: "Error",
        description: "Failed to sync seat count",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReconcileBilling = async () => {
    try {
      setIsReconciling(true);
      const { data, error } = await supabase.functions.invoke('admin-billing-reconcile', {
        body: { orgId: organizationId }
      });

      if (error) throw error;

      toast({
        title: "Billing Reconciled",
        description: `Updated billing status for plan: ${data.planKey}`,
      });
      
      // Refresh billing status and usage data
      await fetchBillingStatus();
      await refreshUsage();
    } catch (error) {
      console.error('Error reconciling billing:', error);
      toast({
        title: "Error",
        description: "Failed to reconcile billing status",
        variant: "destructive",
      });
    } finally {
      setIsReconciling(false);
    }
  };

  const getErrorHint = (code: string) => {
    switch (code) {
      case 'ORG_ID_MISSING':
        return 'Select an organization first.';
      case 'NO_SUCH_PRICE':
        return 'Mode mismatch or bad Price ID. Check Admin → Stripe Configuration.';
      case 'PRICE_NOT_CONFIGURED':
        return 'Set stripe_price_id_monthly for this plan in Admin → Stripe Configuration.';
      case 'UNAUTHORIZED':
        return 'Sign in again / auth header missing.';
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'fail':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'fail':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Correlation ID copied to clipboard",
    });
  };

  return (
    <div className="space-y-8">
      <AdminChecklistBanner />
      <BillingTestPanel 
        currentOrgId={organizationId}
        billingStatus={billingStatus}
        onRefresh={fetchBillingStatus}
      />
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Usage & Billing</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Billing Status:</span>
              {getBillingStatusBadge()}
            </div>
            <Button variant="outline" size="sm" onClick={refreshUsage}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {dateRange?.from && dateRange?.to ? `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}` : "Select date range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Current Plan */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Current Plan</h2>
              <p className="text-muted-foreground">
                {billingStatus?.plan_name || 'Loading...'}
                {billingStatus?.status === 'trialing' && billingStatus.trial_end && (
                  <span className="ml-2 text-warning">
                    (Trial ends {format(new Date(billingStatus.trial_end), "MMM dd, yyyy")})
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleSyncSeats}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    Sync Seats
                  </>
                )}
              </Button>

              {/* Reconcile Billing Button - Admin Only */}
              {isAdmin && (
                <Button 
                  variant="outline" 
                  onClick={handleReconcileBilling}
                  disabled={isReconciling}
                  className="text-warning hover:text-warning-foreground"
                >
                  {isReconciling ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Reconciling...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Reconcile Billing
                    </>
                  )}
                </Button>
              )}
              
              {billingStatus?.status === 'active' ? (
                <Button 
                  variant="outline" 
                  onClick={handleManageBilling}
                  disabled={isOpeningPortal}
                >
                  {isOpeningPortal ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Opening...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Manage Subscription
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-4">
                  {!organizationId ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Select an organization before starting checkout.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  
                  {/* Billing Preflight Results */}
                  {preflightResults && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Checkout Readiness Check</h4>
                        <Badge variant={
                          preflightResults.overallStatus === 'pass' ? 'secondary' :
                          preflightResults.overallStatus === 'warning' ? 'secondary' : 'destructive'
                        }>
                          {getStatusIcon(preflightResults.overallStatus)} {preflightResults.overallStatus}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        {preflightResults.checks?.map((check: any, index: number) => (
                          <div key={check.id || index} className="flex items-start gap-3 p-3 border rounded-lg">
                            <span className="text-lg">{getStatusIcon(check.status)}</span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{check.name}</span>
                                <Badge variant="outline" className={getStatusColor(check.status)}>
                                  {check.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{check.message}</p>
                              {check.hint && (
                                <p className="text-sm text-orange-600 mt-1">💡 {check.hint}</p>
                              )}
                              {check.details && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {Object.entries(check.details).map(([key, value]) => (
                                    <span key={key} className="mr-3">
                                      {key}: {String(value)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {!preflightResults.canProceed && (
                        <Alert variant="destructive">
                          <AlertDescription>
                            Fix the issues above before proceeding with checkout.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                  
                  {/* Checkout Debug Panel */}
                  {checkoutError && (
                    <div className="space-y-2">
                      {/* Inline Error Hint */}
                      {checkoutError.code && getErrorHint(checkoutError.code) && (
                        <Alert variant="destructive">
                          <AlertDescription>
                            {getErrorHint(checkoutError.code)}
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {/* Collapsible Debug Panel */}
                      <Collapsible open={debugPanelOpen} onOpenChange={setDebugPanelOpen}>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-between">
                            <span>Checkout Debug Info</span>
                            {debugPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 mt-2 p-4 border rounded-lg bg-muted/50">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {checkoutError.code && (
                              <div>
                                <label className="font-medium text-muted-foreground">Error Code</label>
                                <div className="mt-1">
                                  <Badge variant="destructive">{checkoutError.code}</Badge>
                                </div>
                              </div>
                            )}
                            
                            {checkoutError.corr && (
                              <div>
                                <label className="font-medium text-muted-foreground">Correlation ID</label>
                                <div className="mt-1 flex items-center gap-2">
                                  <code className="text-xs bg-background px-2 py-1 rounded border">{checkoutError.corr}</code>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copyToClipboard(checkoutError.corr)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {typeof checkoutError.isLiveKey === 'boolean' && (
                              <div>
                                <label className="font-medium text-muted-foreground">Stripe Mode</label>
                                <div className="mt-1">
                                  <Badge variant={checkoutError.isLiveKey ? "default" : "secondary"}>
                                    {checkoutError.isLiveKey ? "Live" : "Test"}
                                  </Badge>
                                </div>
                              </div>
                            )}
                            
                            {checkoutError.orgId && (
                              <div>
                                <label className="font-medium text-muted-foreground">Org ID</label>
                                <div className="mt-1">
                                  <code className="text-xs bg-background px-2 py-1 rounded border">{checkoutError.orgId}</code>
                                </div>
                              </div>
                            )}
                            
                            {checkoutError.planKey && (
                              <div>
                                <label className="font-medium text-muted-foreground">Plan Key</label>
                                <div className="mt-1">
                                  <code className="text-xs bg-background px-2 py-1 rounded border">{checkoutError.planKey}</code>
                                </div>
                              </div>
                            )}
                            
                            {checkoutError.priceId && (
                              <div>
                                <label className="font-medium text-muted-foreground">Price ID</label>
                                <div className="mt-1">
                                  <code className="text-xs bg-background px-2 py-1 rounded border">{checkoutError.priceId}</code>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {checkoutError.message && (
                            <div>
                              <label className="font-medium text-muted-foreground">Error Message</label>
                              <div className="mt-1 p-3 bg-background border rounded text-sm">
                                {checkoutError.message}
                              </div>
                            </div>
                          )}
                          
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setCheckoutError(null)}
                            className="w-full"
                          >
                            Dismiss Debug Info
                          </Button>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      onClick={runPreflightCheck}
                      disabled={isRunningPreflight || !organizationId}
                    >
                      {isRunningPreflight ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Run Preflight Check
                        </>
                      )}
                    </Button>
                    
                    <Button 
                      onClick={handleUpgrade}
                      disabled={isUpgrading || !organizationId || (preflightResults && !preflightResults.canProceed)}
                      className="flex-1"
                    >
                      {isUpgrading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Upgrade Now
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Upgrade Required Banner */}
        {shouldShowUpgradeCTA() && (
          <Card className="p-6 border-warning bg-warning/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-warning/10">
                  <CreditCard className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-warning">Upgrade Required</h3>
                  <p className="text-sm text-muted-foreground">
                    Your subscription needs attention to continue using all features.
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleUpgrade} 
                disabled={isUpgrading || !organizationId}
              >
                Resolve Now
              </Button>
            </div>
          </Card>
        )}

        {/* Usage Overview */}
        <div className="grid gap-6 md:grid-cols-4">
          {usageData && (
            <>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-medium">Call Minutes</h3>
                  </div>
                  <Badge variant={getUsagePercentage(usageData.minutes.used, usageData.minutes.limit) > 80 ? "destructive" : "secondary"}>
                    {getUsagePercentage(usageData.minutes.used, usageData.minutes.limit)}%
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Used: {usageData.minutes.used.toLocaleString()}</span>
                    <span className="text-muted-foreground">Limit: {usageData.minutes.limit.toLocaleString()}</span>
                  </div>
                  <Progress 
                    value={getUsagePercentage(usageData.minutes.used, usageData.minutes.limit)} 
                    className={cn("h-2", getProgressColor(getUsagePercentage(usageData.minutes.used, usageData.minutes.limit)))}
                  />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-medium">Total Calls</h3>
                  </div>
                  <Badge variant={getUsagePercentage(usageData.calls.used, usageData.calls.limit) > 80 ? "destructive" : "secondary"}>
                    {getUsagePercentage(usageData.calls.used, usageData.calls.limit)}%
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Used: {usageData.calls.used.toLocaleString()}</span>
                    <span className="text-muted-foreground">Limit: {usageData.calls.limit.toLocaleString()}</span>
                  </div>
                  <Progress 
                    value={getUsagePercentage(usageData.calls.used, usageData.calls.limit)} 
                    className={cn("h-2", getProgressColor(getUsagePercentage(usageData.calls.used, usageData.calls.limit)))}
                  />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-medium">AI Tokens</h3>
                  </div>
                  <Badge variant={getUsagePercentage(usageData.tokens.used, usageData.tokens.limit) > 80 ? "destructive" : "secondary"}>
                    {getUsagePercentage(usageData.tokens.used, usageData.tokens.limit)}%
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Used: {usageData.tokens.used.toLocaleString()}</span>
                    <span className="text-muted-foreground">Limit: {usageData.tokens.limit.toLocaleString()}</span>
                  </div>
                  <Progress 
                    value={getUsagePercentage(usageData.tokens.used, usageData.tokens.limit)} 
                    className={cn("h-2", getProgressColor(getUsagePercentage(usageData.tokens.used, usageData.tokens.limit)))}
                  />
                </div>
              </Card>
            </>
          )}

          {/* Concurrency Card */}
          <ConcurrencyCard 
            concurrency={concurrency}
            loading={usageLoading}
            onRefresh={refreshConcurrency}
          />
        </div>

        {/* Upgrade Promotion for Active Subscribers */}
        {billingStatus?.status === 'active' && (
          <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-2">Need More Resources?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upgrade to a higher tier for increased limits and advanced features.
                </p>
                <ul className="text-sm space-y-1">
                  <li>• Higher call volume limits</li>
                  <li>• Increased concurrency</li>
                  <li>• Priority support</li>
                  <li>• Advanced analytics</li>
                </ul>
              </div>
              <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                View Plans
              </Button>
            </div>
          </Card>
        )}

        {/* Usage History */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Usage History</h2>
            <Badge variant="secondary">
              {usageEvents.length} event{usageEvents.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usageEvents.length > 0 ? (
                usageEvents.map((event, index) => (
                  <TableRow key={event.id || index}>
                    <TableCell className="font-medium">
                      {format(new Date(event.created_at), "yyyy-MM-dd")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEventIcon(event.event_type)}
                        <span className="capitalize">{event.event_type.replace('_', ' ')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {event.resource_type && event.resource_id 
                        ? `${event.resource_type} operation (${event.resource_id.slice(0, 8)}...)`
                        : event.event_type}
                    </TableCell>
                    <TableCell className="font-mono">
                      ${(event.cost_cents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Qty: {event.quantity || 1}
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <div className="truncate mt-1">
                          {JSON.stringify(event.metadata).slice(0, 50)}...
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No usage events found for the selected period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}