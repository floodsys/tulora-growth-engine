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
import { useEntitlements } from "@/lib/entitlements/ssot";

// Helper for correlation ID extraction
const getCorrId = (err: any) => err?.correlationId ?? err?.corr ?? err?.traceId ?? null

// Local validation utilities for Stripe price IDs
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
  const { entitlements, refresh: refreshEntitlements } = useEntitlements(organizationId);

  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('leadgen_starter');

  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [isLoadingBilling, setIsLoadingBilling] = useState(true);
  const [checkoutError, setCheckoutError] = useState<any>(null);
  const [preflightError, setPreflightError] = useState<any>(null);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [preflightDebugOpen, setPreflightDebugOpen] = useState(false);
  const [preflightResults, setPreflightResults] = useState<any>(null);
  const [isRunningPreflight, setIsRunningPreflight] = useState(false);
  const [refreshStatusError, setRefreshStatusError] = useState<any>(null);
  const [reconcileError, setReconcileError] = useState<any>(null);
  const [refreshDebugOpen, setRefreshDebugOpen] = useState(false);
  const [reconcileDebugOpen, setReconcileDebugOpen] = useState(false);

  // Fetch available plans on component mount
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('plan_configs')
          .select('plan_key, display_name, stripe_price_id_monthly')
          .eq('is_active', true)
          .not('stripe_price_id_monthly', 'is', null);

        if (error) throw error;

        setAvailablePlans(data || []);
        // Set default to first available plan if current selection is not available
        if (data && data.length > 0 && !data.find(p => p.plan_key === selectedPlan)) {
          setSelectedPlan(data[0].plan_key);
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
        // Keep default fallback
      }
    };

    fetchPlans();
  }, []);

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

  // Convert usage rollup to expected format with SSOT limits
  const usageData: UsageData | null = currentUsage ? {
    minutes: {
      used: currentUsage.minutes,
      limit: entitlements.limits.agents ? (entitlements.limits.agents * 500) : 5000 // Rough estimation: 500 min per agent
    },
    calls: {
      used: currentUsage.calls,
      limit: entitlements.limits.agents ? (entitlements.limits.agents * 200) : 1000 // Rough estimation: 200 calls per agent
    },
    tokens: {
      used: currentUsage.messages * 100, // Estimate tokens from messages
      limit: entitlements.limits.agents ? (entitlements.limits.agents * 50000) : 250000 // Rough estimation: 50k tokens per agent
    },
    plan: {
      name: entitlements.planName || "Professional",
      billing_cycle: "monthly",
      next_billing_date: billingStatus?.current_period_end || "2024-02-15"
    },
    spend: {
      current: (currentUsage.calls * 0.12) + (currentUsage.minutes * 0.05), // Calculate from usage
      limit: entitlements.limits.agents ? (entitlements.limits.agents * 30) : 150 // Rough estimation: $30 per agent
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
      setRefreshStatusError(null);

      const { data, error } = await supabase.functions.invoke('admin-billing-overview', {
        body: { action: 'list_subscriptions', limit: 10 }
      });

      if (error) throw error;

      setBillingStatus(data);
    } catch (error: any) {
      console.error('Error fetching billing status:', error);

      // Try to parse structured error response
      let parsedError = null;
      try {
        if (error?.message && typeof error.message === 'string') {
          parsedError = JSON.parse(error.message);
        } else if (error && typeof error === 'object') {
          parsedError = error;
        }
      } catch (parseError) {
        parsedError = { message: error?.message || "Failed to fetch billing status" };
      }

      setRefreshStatusError(parsedError);
      setRefreshDebugOpen(true);

      toast({
        title: "Error",
        description: parsedError?.message || "Failed to fetch billing status",
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
      setPreflightError(null);

      const { data, error } = await supabase.functions.invoke('billing-preflight', {
        body: {
          orgId: organizationId,
          planKey: selectedPlan
        }
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Preflight check failed:', error);

      // Try to parse structured error response
      let parsedError = null;
      try {
        if (error?.message && typeof error.message === 'string') {
          parsedError = JSON.parse(error.message);
        } else if (error && typeof error === 'object') {
          parsedError = error;
        }
      } catch (parseError) {
        parsedError = { message: error?.message || "Preflight check failed" };
      }

      setPreflightError(parsedError);
      setPreflightDebugOpen(true);

      return {
        overallStatus: 'fail',
        canProceed: false,
        error: parsedError
      };
    } finally {
      setIsRunningPreflight(false);
    }
  };

  const handleUpgrade = async () => {
    // Check plan price validity before proceeding
    const selectedPlanConfig = availablePlans.find(p => p.plan_key === selectedPlan)
    const priceValidation = validatePlanPrices(selectedPlanConfig)

    if (!priceValidation.monthlyValid && !priceValidation.yearlyValid) {
      toast({
        title: "Plan Configuration Error",
        description: "This plan isn't fully configured with live Stripe prices. Please contact support for assistance.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsUpgrading(true);
      setCheckoutError(null);
      setPreflightError(null);
      setPreflightResults(null);

      // Run preflight check first
      const preflightResult = await runPreflightCheck();
      setPreflightResults(preflightResult);

      if (!preflightResult?.canProceed) {
        toast({
          title: "Checkout Blocked",
          description: "Please fix the issues identified in the preflight check",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-org-checkout', {
        body: {
          orgId: organizationId,
          planKey: selectedPlan
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
    if (!organizationId) {
      toast({
        title: "Error",
        description: "Organization not loaded. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

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
    if (!organizationId) {
      toast({
        title: "Error",
        description: "Organization not loaded. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

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
    if (!organizationId) {
      toast({
        title: "Error",
        description: "Organization not loaded. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsReconciling(true);
      setReconcileError(null);

      const { data, error } = await supabase.functions.invoke('admin-billing-reconcile', {
        body: { orgId: organizationId }
      });

      if (error) throw error;

      // Show detailed success information
      const details = [];
      if (data.customerId) details.push(`Customer: ${data.customerId}`);
      if (data.planKey) details.push(`Plan: ${data.planKey}`);
      if (data.subscriptionId) details.push(`Subscription: ${data.subscriptionId.substring(0, 12)}...`);
      if (data.sessionId) details.push(`Session: ${data.sessionId.substring(0, 12)}...`);

      toast({
        title: "Billing Reconciled Successfully",
        description: `Updated billing status. ${details.join(' | ')}${data.corr ? ` [${data.corr.substring(0, 8)}]` : ''}`,
      });

      // Also log the full reconciliation details for debugging
      console.log('Billing reconciliation successful:', {
        correlationId: data.corr,
        customerId: data.customerId,
        planKey: data.planKey,
        subscriptionId: data.subscriptionId,
        sessionId: data.sessionId,
        details: data.details
      });

      // Refresh billing status, usage data, and entitlements
      await fetchBillingStatus();
      await refreshUsage();
      await refreshEntitlements();
    } catch (error: any) {
      const corrId = getCorrId(error)
      console.error('Error reconciling billing:', { corrId, error });

      // Try to parse structured error response
      let parsedError = null;
      try {
        if (error?.message && typeof error.message === 'string') {
          parsedError = JSON.parse(error.message);
        } else if (error && typeof error === 'object') {
          parsedError = error;
        }
      } catch (parseError) {
        parsedError = { message: error?.message || "Failed to reconcile billing status" };
      }

      setReconcileError(parsedError);
      setReconcileDebugOpen(true);

      // Show specific error hint if available
      let description = parsedError?.message || "Failed to reconcile billing status";
      if (parsedError?.hint) {
        description += ` (${parsedError.hint})`;
      }
      if (corrId) {
        description += ` (Corr ID: ${corrId})`;
      }

      toast({
        title: "Reconciliation Failed",
        description,
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
      case 'NO_CHECKOUT_SESSIONS':
        return 'No completed Stripe checkout found for this organization. Complete a checkout first.';
      case 'INCOMPLETE_SESSION_DATA':
        return 'Checkout session is missing customer or subscription data.';
      case 'PLAN_KEY_MISSING':
        return 'Cannot determine plan from Stripe subscription. Check subscription metadata.';
      case 'INSUFFICIENT_STRIPE_PERMISSIONS':
        return 'Stripe API key lacks required permissions.';
      case 'NO_CUSTOMER':
        return 'No Stripe customer found for this organization. Complete a checkout first.';
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

  const renderDebugPanel = (error: any, isOpen: boolean, setIsOpen: (open: boolean) => void, title: string) => {
    if (!error) return null;

    return (
      <div className="space-y-2">
        {/* Inline Error Hint */}
        {error.code && getErrorHint(error.code) && (
          <Alert variant="destructive">
            <AlertDescription>
              {getErrorHint(error.code)}
            </AlertDescription>
          </Alert>
        )}

        {/* Collapsible Debug Panel */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              <span>{title}</span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-2 p-4 border rounded-lg bg-muted/50">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {error.code && (
                <div>
                  <label className="font-medium text-muted-foreground">Error Code</label>
                  <div className="mt-1">
                    <Badge variant="destructive">{error.code}</Badge>
                  </div>
                </div>
              )}

              {error.corr && (
                <div>
                  <label className="font-medium text-muted-foreground">Correlation ID</label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="text-xs bg-background px-2 py-1 rounded border">{error.corr}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(error.corr)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {error.hint && (
                <div className="col-span-2">
                  <label className="font-medium text-muted-foreground">Hint</label>
                  <div className="mt-1 p-3 bg-background border rounded text-sm text-orange-600">
                    💡 {error.hint}
                  </div>
                </div>
              )}
            </div>

            {error.message && (
              <div>
                <label className="font-medium text-muted-foreground">Error Message</label>
                <div className="mt-1 p-3 bg-background border rounded text-sm">
                  {error.message}
                </div>
              </div>
            )}

            {error.details && (
              <div>
                <label className="font-medium text-muted-foreground">Details</label>
                <div className="mt-1 p-3 bg-background border rounded text-xs font-mono">
                  {JSON.stringify(error.details, null, 2)}
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (title.includes('Refresh')) setRefreshStatusError(null);
                if (title.includes('Reconcile')) setReconcileError(null);
                if (title.includes('Checkout')) setCheckoutError(null);
                setIsOpen(false);
              }}
              className="w-full"
            >
              Dismiss Debug Info
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
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
              Refresh Usage
            </Button>
            <Button variant="outline" size="sm" onClick={fetchBillingStatus}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
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

        {/* Refresh Status Debug Panel */}
        {refreshStatusError && renderDebugPanel(
          refreshStatusError,
          refreshDebugOpen,
          setRefreshDebugOpen,
          'Billing Status Debug'
        )}

        {/* Reconcile Debug Panel */}
        {reconcileError && renderDebugPanel(
          reconcileError,
          reconcileDebugOpen,
          setReconcileDebugOpen,
          'Reconcile Debug'
        )}

        {/* Current Plan */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Current Plan</h2>
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  {entitlements.planName}
                  {billingStatus?.status === 'trialing' && billingStatus.trial_end && (
                    <span className="ml-2 text-warning">
                      (Trial ends {format(new Date(billingStatus.trial_end), "MMM dd, yyyy")})
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={entitlements.isActive ? "secondary" : "outline"}>
                    {entitlements.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {entitlements.features.scheduling && (
                    <Badge variant="outline">Scheduling</Badge>
                  )}
                  {entitlements.features.numbers && (
                    <Badge variant="outline">Numbers</Badge>
                  )}
                  {entitlements.features.sms && (
                    <Badge variant="outline">SMS</Badge>
                  )}
                  {entitlements.features.widgets && (
                    <Badge variant="outline">Widgets</Badge>
                  )}
                  {entitlements.features.advancedAnalytics && (
                    <Badge variant="outline">Advanced Analytics</Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Agents:</span>
                    <span className="ml-1 font-medium">
                      {entitlements.limits.agents === null ? "Unlimited" : entitlements.limits.agents}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Numbers:</span>
                    <span className="ml-1 font-medium">
                      {entitlements.limits.numbers === null ? "Unlimited" : entitlements.limits.numbers}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Widgets:</span>
                    <span className="ml-1 font-medium">
                      {entitlements.limits.widgets === null ? "Unlimited" : entitlements.limits.widgets}
                    </span>
                  </div>
                </div>
              </div>
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

                  {/* Plan Selection */}
                  {availablePlans.length > 1 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select Plan</label>
                      <select
                        value={selectedPlan}
                        onChange={(e) => setSelectedPlan(e.target.value)}
                        className="w-full p-2 border border-input bg-background rounded-md text-sm"
                      >
                        {availablePlans.map((plan) => (
                          <option key={plan.plan_key} value={plan.plan_key}>
                            {plan.display_name} ({plan.plan_key})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

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
                                <span className="font-medium">{check.message || check.id}</span>
                                <Badge variant="outline" className={getStatusColor(check.status)}>
                                  {check.status}
                                </Badge>
                              </div>
                              {check.message && check.message !== check.id && (
                                <p className="text-sm text-muted-foreground mt-1">{check.message}</p>
                              )}
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

                  {/* Preflight Debug Panel */}
                  {preflightError && renderDebugPanel(
                    preflightError,
                    preflightDebugOpen,
                    setPreflightDebugOpen,
                    'Preflight Debug'
                  )}

                  {/* Checkout Debug Panel */}
                  {checkoutError && renderDebugPanel(
                    checkoutError,
                    debugPanelOpen,
                    setDebugPanelOpen,
                    'Checkout Debug'
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
                      disabled={isUpgrading || !organizationId || !selectedPlan || (preflightResults && !preflightResults.canProceed) || (() => {
                        const selectedPlanConfig = availablePlans.find(p => p.plan_key === selectedPlan)
                        const priceValidation = validatePlanPrices(selectedPlanConfig)
                        return !priceValidation.monthlyValid && !priceValidation.yearlyValid
                      })()}
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
                          Upgrade Now {selectedPlan && `(${selectedPlan})`}
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
                disabled={isUpgrading || !organizationId || (() => {
                  const selectedPlanConfig = availablePlans.find(p => p.plan_key === selectedPlan)
                  const priceValidation = validatePlanPrices(selectedPlanConfig)
                  return !priceValidation.monthlyValid && !priceValidation.yearlyValid
                })()}
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