import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, Clock, Phone, MessageSquare, Database, CreditCard, ExternalLink, Users, RefreshCw } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AdminChecklistBanner } from "@/components/admin/AdminChecklistBanner";
import { BillingTestPanel } from "@/components/dashboard/BillingTestPanel";
import { useUsageData } from "@/hooks/useUsageData";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { ConcurrencyCard } from "@/components/dashboard/widgets/ConcurrencyCard";

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
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [isLoadingBilling, setIsLoadingBilling] = useState(true);

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

  const handleUpgrade = async () => {
    try {
      setIsUpgrading(true);
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: { 
          orgId: organizationId,
          priceId: 'price_professional_monthly' // Dynamic based on plan selection
        }
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: "Failed to start upgrade process",
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
                <Button 
                  onClick={handleUpgrade}
                  disabled={isUpgrading}
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
              <Button onClick={handleUpgrade} disabled={isUpgrading}>
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