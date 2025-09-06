import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Crown, 
  Clock, 
  Phone, 
  Zap, 
  TrendingUp,
  CreditCard,
  ExternalLink,
  RefreshCw,
  AlertTriangle
} from "lucide-react"
import { DateRangePicker } from "./widgets/DateRangePicker"
import { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { BillingTestPanel } from "./BillingTestPanel"

interface UsageData {
  minutesUsed: number
  minutesLimit: number
  callsCount: number
  callsLimit: number
  tokensUsed: number
  tokensLimit: number
  currentPlan: string
  billingCycle: "monthly" | "annual"
  nextBillingDate: Date
  currentSpend: number
}

interface UsageEvent {
  id: string
  date: Date
  type: "call" | "ai_generation" | "storage"
  description: string
  cost: number
  details: {
    duration?: number
    tokens?: number
    minutes?: number
  }
}

interface BillingStatus {
  billing_status: string
  current_period_end: string | null
  price_id: string | null
  quantity: number
  plan_key: string | null
  billing_tier: string
}

const mockUsageData: UsageData = {
  minutesUsed: 1247,
  minutesLimit: 2000,
  callsCount: 89,
  callsLimit: 500,
  tokensUsed: 450000,
  tokensLimit: 1000000,
  currentPlan: "Professional",
  billingCycle: "monthly",
  nextBillingDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15),
  currentSpend: 127.50
}

const mockUsageEvents: UsageEvent[] = [
  {
    id: "1",
    date: new Date(Date.now() - 1000 * 60 * 60 * 2),
    type: "call",
    description: "Outbound call to John Smith",
    cost: 0.45,
    details: { duration: 180, minutes: 3 }
  },
  {
    id: "2",
    date: new Date(Date.now() - 1000 * 60 * 60 * 4),
    type: "ai_generation", 
    description: "AI response generation",
    cost: 0.08,
    details: { tokens: 1250 }
  },
  {
    id: "3",
    date: new Date(Date.now() - 1000 * 60 * 60 * 6),
    type: "call",
    description: "Outbound call to Jane Doe",
    cost: 0.32,
    details: { duration: 120, minutes: 2 }
  },
  {
    id: "4",
    date: new Date(Date.now() - 1000 * 60 * 60 * 8),
    type: "storage",
    description: "Knowledge base document processing",
    cost: 0.05,
    details: {}
  }
]

export function UsageBilling() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [usageEvents, setUsageEvents] = useState(mockUsageEvents)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [isOpeningPortal, setIsOpeningPortal] = useState(false)
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null)
  const [isLoadingBilling, setIsLoadingBilling] = useState(true)
  const { toast } = useToast()
  const { organizationId, loading: orgLoading } = useUserOrganization()

  
  // Load billing status when organization loads
  useEffect(() => {
    if (organizationId && !orgLoading) {
      fetchBillingStatus()
    }
  }, [organizationId, orgLoading])

  const fetchBillingStatus = async () => {
    if (!organizationId) {
      console.warn('No organization ID available for billing status')
      setIsLoadingBilling(false)
      return
    }

    try {
      setIsLoadingBilling(true)
      console.log('Fetching billing status for org:', organizationId)
      
      const { data, error } = await supabase.functions.invoke('check-org-billing', {
        body: { orgId: organizationId }
      })

      if (error) {
        console.error('Billing status error:', error)
        throw error
      }

      console.log('Billing status response:', data)
      setBillingStatus(data)
    } catch (error: any) {
      console.error('Error fetching billing status:', error)
      toast({
        title: "Error loading billing status",
        description: error.message || "Failed to load billing information",
        variant: "destructive",
      })
    } finally {
      setIsLoadingBilling(false)
    }
  }

  const getUsagePercentage = (used: number, limit: number) => {
    return (used / limit) * 100
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-destructive"
    if (percentage >= 75) return "bg-warning"
    return "bg-primary"
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-4 w-4 text-primary" />
      case "ai_generation":
        return <Zap className="h-4 w-4 text-warning" />
      case "storage":
        return <Clock className="h-4 w-4 text-success" />
      default:
        return <TrendingUp className="h-4 w-4 text-muted-foreground" />
    }
  }

  const formatEventDetails = (event: UsageEvent) => {
    switch (event.type) {
      case "call":
        return `${event.details.minutes} minutes`
      case "ai_generation":
        return `${event.details.tokens?.toLocaleString()} tokens`
      default:
        return ""
    }
  }

  const getBillingStatusBadge = () => {
    if (!billingStatus) return null
    
    switch (billingStatus.billing_status) {
      case 'active':
        return <Badge className="bg-green-500 text-white">{billingStatus.billing_tier || 'Active Plan'}</Badge>
      case 'trialing':
        return <Badge className="bg-blue-500 text-white">Trial</Badge>
      case 'past_due':
        return <Badge className="bg-yellow-500 text-white">Payment Required</Badge>
      case 'canceled':
      case 'inactive':
      default:
        return <Badge variant="outline">Free Plan</Badge>
    }
  }

  const shouldShowUpgradeCTA = () => {
    return !billingStatus || !['active', 'trialing'].includes(billingStatus.billing_status)
  }

  const handleUpgrade = async (planKey?: string) => {
    try {
      setIsUpgrading(true)
      
      // Use plan_configs as authoritative source - no more env variable fallbacks
      // If no planKey provided, default to a starter plan based on current plan or fallback
      const defaultPlanKey = planKey || (billingStatus?.plan_key?.startsWith('support') ? 'support_business' : 'leadgen_business')
      
      const { data, error } = await supabase.functions.invoke('create-org-checkout', {
        body: { 
          orgId: organizationId,
          planKey: defaultPlanKey,
          interval: 'monthly',
          seats: billingStatus?.quantity || 1
        }
      })

      if (error) throw error

      // Open Stripe Checkout in new tab
      window.open(data.url, '_blank')
      
      toast({
        title: "Redirecting to checkout",
        description: "Opening Stripe checkout in a new tab...",
      })
    } catch (error: any) {
      console.error('Upgrade error:', error)
      toast({
        title: "Error starting checkout",
        description: error.message || "Failed to start checkout process",
        variant: "destructive",
      })
    } finally {
      setIsUpgrading(false)
    }
  }

  const handleManageBilling = async () => {
    try {
      setIsOpeningPortal(true)
      
      const { data, error } = await supabase.functions.invoke('org-customer-portal', {
        body: { orgId: organizationId }
      })

      if (error) throw error

      // Open Stripe Customer Portal in new tab
      window.open(data.url, '_blank')
      
      toast({
        title: "Opening billing portal",
        description: "Redirecting to Stripe billing portal...",
      })
    } catch (error: any) {
      console.error('Portal error:', error)
      toast({
        title: "Error opening billing portal",
        description: error.message || "Failed to access billing portal",
        variant: "destructive",
      })
    } finally {
      setIsOpeningPortal(false)
    }
  }

  const handleSyncSeats = async () => {
    try {
      setIsSyncing(true)
      
      const { data, error } = await supabase.functions.invoke('org-update-seats', {
        body: { orgId: organizationId }
      })

      if (error) throw error

      toast({
        title: "Seats synced successfully",
        description: data.message,
      })
      
      // Refresh billing status after sync
      await fetchBillingStatus()
    } catch (error: any) {
      toast({
        title: "Error syncing seats",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Test Panel for Development */}
      <BillingTestPanel 
        currentOrgId={organizationId}
        billingStatus={billingStatus}
        onRefresh={fetchBillingStatus}
      />
      
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Usage & Billing</h2>
          <p className="text-muted-foreground">
            Monitor your usage and manage your subscription
          </p>
        </div>
        <div className="flex items-center gap-3">
          {getBillingStatusBadge()}
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-warning" />
              Current Plan: {billingStatus?.billing_tier || 'Free'}
              {isLoadingBilling && (
                <RefreshCw className="h-4 w-4 animate-spin ml-2" />
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSyncSeats} disabled={isSyncing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync Seats
              </Button>
              {billingStatus?.billing_status === 'active' ? (
                <Button onClick={handleManageBilling} disabled={isOpeningPortal}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {isOpeningPortal ? 'Opening...' : 'Manage Subscription'}
                </Button>
              ) : (
                <Button onClick={() => handleUpgrade()} disabled={isUpgrading}>
                  <Crown className="h-4 w-4 mr-2" />
                  {isUpgrading ? 'Processing...' : 'Upgrade Now'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Billing Status</p>
              <p className="font-medium capitalize">{billingStatus?.billing_status || 'Loading...'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Period End</p>
              <p className="font-medium">
                {billingStatus?.current_period_end 
                  ? format(new Date(billingStatus.current_period_end), "MMM d, yyyy")
                  : 'N/A'
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Seats</p>
              <p className="font-medium text-lg">{billingStatus?.quantity || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Paywall/Upgrade CTA */}
      {shouldShowUpgradeCTA() && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900">Upgrade Required</h3>
                <p className="text-yellow-700">
                  {billingStatus?.billing_status === 'past_due' 
                    ? 'Your payment is past due. Please update your billing information.'
                    : 'Upgrade to Pro to unlock unlimited features and remove restrictions.'
                  }
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleUpgrade('leadgen_starter')}
                  disabled={isUpgrading}
                >
                  Lead Gen Plans
                </Button>
                <Button 
                  onClick={() => handleUpgrade('support_starter')}
                  disabled={isUpgrading}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  Support Plans
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Minutes Used */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Call Minutes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-2xl font-bold">{mockUsageData.minutesUsed.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">
                  / {mockUsageData.minutesLimit.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(mockUsageData.minutesUsed, mockUsageData.minutesLimit)} 
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {Math.round(getUsagePercentage(mockUsageData.minutesUsed, mockUsageData.minutesLimit))}% used this month
              </p>
            </div>
          </CardContent>
        </Card>
        {/* Calls Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-2xl font-bold">{mockUsageData.callsCount}</span>
                <span className="text-sm text-muted-foreground">
                  / {mockUsageData.callsLimit}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(mockUsageData.callsCount, mockUsageData.callsLimit)} 
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {Math.round(getUsagePercentage(mockUsageData.callsCount, mockUsageData.callsLimit))}% used this month
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Token Usage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Tokens</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-2xl font-bold">{(mockUsageData.tokensUsed / 1000).toFixed(0)}K</span>
                <span className="text-sm text-muted-foreground">
                  / {(mockUsageData.tokensLimit / 1000)}K
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(mockUsageData.tokensUsed, mockUsageData.tokensLimit)} 
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {Math.round(getUsagePercentage(mockUsageData.tokensUsed, mockUsageData.tokensLimit))}% used this month
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade CTA - Only show if user has active subscription */}
      {billingStatus?.billing_status === 'active' && (
        <Card className="bg-gradient-brand text-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold mb-2">Ready to scale up?</h3>
                <p className="text-white/90">
                  Add more seats or upgrade to Enterprise for unlimited calls, advanced AI features, and priority support.
                </p>
              </div>
              <Button 
                variant="secondary" 
                className="bg-white text-primary hover:bg-white/90"
                onClick={() => handleUpgrade()}
              >
                <Crown className="h-4 w-4 mr-2" />
                Scale Up
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Events */}
      <Card>
        <CardHeader>
          <CardTitle>Usage History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usageEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="text-muted-foreground">
                    {format(event.date, "MMM d, h:mm a")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getEventIcon(event.type)}
                      <Badge variant="outline" className="capitalize">
                        {event.type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{event.description}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatEventDetails(event)}
                  </TableCell>
                  <TableCell className="font-medium">
                    ${event.cost.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}