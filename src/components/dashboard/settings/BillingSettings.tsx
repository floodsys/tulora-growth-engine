import { useActivityLogger } from "@/hooks/useActivityLogger"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { ManualAccessBanner } from "@/components/ui/ManualAccessBanner"
import { CreditCard, ExternalLink, Calendar, Users, Phone, Bot, Loader2, Clock, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { useCanonicalUserRole } from "@/hooks/useCanonicalUserRole"
import { useEntitlements } from "@/lib/entitlements/ssot"
import { useUsageData } from "@/hooks/useUsageData"

export function BillingSettings() {
  const { logBillingAction } = useActivityLogger();
  const { user, session } = useAuth();
  const [organizationData, setOrganizationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  // Get role info for the current organization
  const { isOwner, isAdmin, loading: roleLoading } = useCanonicalUserRole(organizationData?.id);

  // Get entitlements (plan limits and features)
  const { entitlements, isLoading: entitlementsLoading } = useEntitlements(organizationData?.id || null);

  // Get usage data from usage_rollups
  const { currentUsage, loading: usageLoading } = useUsageData(organizationData?.id || null);

  // Show billing portal button only for owners and admins
  const canManageBilling = isOwner || isAdmin;

  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!user) return;

      try {
        // Get user's current organization
        const { data: profile } = await supabase
          .from('profiles')
          .select('current_org_id')
          .eq('user_id', user.id)
          .single();

        if (profile?.current_org_id) {
          // Get organization with entitlements
          const { data: org } = await supabase
            .from('organizations')
            .select('id, name, plan_key, billing_status, entitlements, stripe_subscription_id')
            .eq('id', profile.current_org_id)
            .single();

          setOrganizationData(org);
        }
      } catch (error) {
        console.error('Error fetching organization data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizationData();
  }, [user]);

  const handleManageSubscription = async () => {
    if (!organizationData?.id || !session?.access_token) {
      toast.error("Unable to open billing portal. Please try again or contact support.");
      return;
    }

    setPortalLoading(true);

    try {
      await logBillingAction('billing.portal_opened', 'subscription', {
        accessed_via: 'settings_panel',
        organization_id: organizationData.id
      });

      const response = await supabase.functions.invoke('org-customer-portal', {
        body: { orgId: organizationData.id },
      });

      if (response.error) {
        console.error('Error creating portal session:', response.error);
        toast.error("Unable to open billing portal. Please try again or contact support.");
        return;
      }

      const { url } = response.data;

      if (url) {
        // Redirect to Stripe Customer Portal
        window.location.href = url;
      } else {
        toast.error("Unable to open billing portal. Please try again or contact support.");
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      toast.error("Unable to open billing portal. Please try again or contact support.");
    } finally {
      setPortalLoading(false);
    }
  }

  const getUsagePercentage = (used: number, limit: number | null | undefined) => {
    if (limit === null || limit === undefined || limit === 0) return 0; // Unlimited or not enforced
    return Math.min((used / limit) * 100, 100);
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500"
    if (percentage >= 75) return "bg-yellow-500"
    return "bg-green-500"
  }

  const formatLimit = (limit: number | null | undefined) => {
    if (limit === null || limit === undefined) return "Unlimited";
    return limit.toLocaleString();
  }

  const isDataLoading = loading || entitlementsLoading || usageLoading;

  // Get billing status display
  const getBillingStatusDisplay = () => {
    if (!organizationData?.billing_status) return { label: 'Unknown', variant: 'secondary' as const };

    switch (organizationData.billing_status) {
      case 'active':
        return { label: 'Active', variant: 'default' as const };
      case 'trialing':
        return { label: 'Trial', variant: 'secondary' as const };
      case 'past_due':
        return { label: 'Past Due', variant: 'destructive' as const };
      case 'canceled':
        return { label: 'Canceled', variant: 'secondary' as const };
      default:
        return { label: organizationData.billing_status, variant: 'secondary' as const };
    }
  };

  const billingStatus = getBillingStatusDisplay();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and view usage</p>
      </div>

      {/* Manual Access Banner */}
      {!loading && organizationData?.entitlements?.manual_activation && (
        <ManualAccessBanner
          organizationId={organizationData.id}
          planKey={organizationData.plan_key}
          endsAt={organizationData.entitlements.manual_activation.ends_at}
          isActive={organizationData.entitlements.manual_activation.active}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Current Plan</span>
          </CardTitle>
          <CardDescription>Your subscription details and billing information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDataLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold">{entitlements.planName} Plan</h3>
                    <Badge variant={billingStatus.variant}>
                      {billingStatus.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {organizationData?.stripe_subscription_id
                      ? "Managed via Stripe"
                      : "Contact support for plan changes"}
                  </p>
                </div>
                {canManageBilling && (
                  <Button onClick={handleManageSubscription} disabled={portalLoading || roleLoading}>
                    {portalLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    {portalLoading ? "Opening..." : "Manage Subscription"}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div className="flex items-center space-x-3">
                  <Bot className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Agent Limit</p>
                    <p className="text-sm text-muted-foreground">{formatLimit(entitlements.limits.agents)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Number Limit</p>
                    <p className="text-sm text-muted-foreground">{formatLimit(entitlements.limits.numbers)}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage This Month</CardTitle>
          <CardDescription>Track your usage against plan limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isDataLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              {/* Monthly Calls */}
              {entitlements.limits.calls_per_month !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Monthly Calls</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {(currentUsage?.calls ?? 0).toLocaleString()} / {formatLimit(entitlements.limits.calls_per_month)}
                    </span>
                  </div>
                  {entitlements.limits.calls_per_month !== null && (
                    <Progress
                      value={getUsagePercentage(currentUsage?.calls ?? 0, entitlements.limits.calls_per_month)}
                      className="h-2"
                    />
                  )}
                </div>
              )}

              {/* Monthly Minutes */}
              {entitlements.limits.minutes_per_month !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Monthly Minutes</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {(currentUsage?.minutes ?? 0).toLocaleString()} / {formatLimit(entitlements.limits.minutes_per_month)}
                    </span>
                  </div>
                  {entitlements.limits.minutes_per_month !== null && (
                    <Progress
                      value={getUsagePercentage(currentUsage?.minutes ?? 0, entitlements.limits.minutes_per_month)}
                      className="h-2"
                    />
                  )}
                </div>
              )}

              {/* Monthly Messages (if applicable) */}
              {entitlements.limits.messages_per_month !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Monthly Messages</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {(currentUsage?.messages ?? 0).toLocaleString()} / {formatLimit(entitlements.limits.messages_per_month)}
                    </span>
                  </div>
                  {entitlements.limits.messages_per_month !== null && (
                    <Progress
                      value={getUsagePercentage(currentUsage?.messages ?? 0, entitlements.limits.messages_per_month)}
                      className="h-2"
                    />
                  )}
                </div>
              )}

              {/* Show general usage if no specific quotas are configured */}
              {entitlements.limits.calls_per_month === undefined &&
                entitlements.limits.minutes_per_month === undefined &&
                entitlements.limits.messages_per_month === undefined && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Calls This Month</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {(currentUsage?.calls ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Minutes This Month</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {(currentUsage?.minutes ?? 0).toLocaleString()}
                      </span>
                    </div>
                    {currentUsage?.messages !== undefined && currentUsage.messages > 0 && (
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Messages This Month</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {(currentUsage?.messages ?? 0).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground italic">
                      Your plan has unlimited usage quotas.
                    </p>
                  </div>
                )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>View and download your previous invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Billing history and invoices are managed through your Stripe Customer Portal.
            </p>
            {canManageBilling && (
              <Button variant="outline" className="mt-4" onClick={handleManageSubscription} disabled={portalLoading || roleLoading}>
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                {portalLoading ? "Opening..." : "View Billing History"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
