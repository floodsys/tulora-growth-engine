import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CreditCard, ExternalLink, Calendar, Users, Phone, Bot } from "lucide-react"
import { toast } from "sonner"

const billingData = {
  plan: "Pro",
  status: "active",
  nextBilling: "2024-05-01",
  amount: "$99/month",
  seats: {
    used: 7,
    total: 10
  },
  usage: {
    calls: { used: 1250, limit: 2000 },
    agents: { used: 3, limit: 5 },
    storage: { used: 2.1, limit: 10 } // GB
  }
}

export function BillingSettings() {
  const handleManageSubscription = () => {
    // TODO: Implement Stripe Customer Portal redirect
    toast.success("Redirecting to billing portal...")
  }

  const getUsagePercentage = (used: number, limit: number) => {
    return (used / limit) * 100
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500"
    if (percentage >= 75) return "bg-yellow-500"
    return "bg-green-500"
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and view usage</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Current Plan</span>
          </CardTitle>
          <CardDescription>Your subscription details and billing information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold">{billingData.plan} Plan</h3>
                <Badge variant={billingData.status === "active" ? "default" : "secondary"}>
                  {billingData.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {billingData.amount} • Next billing: {new Date(billingData.nextBilling).toLocaleDateString()}
              </p>
            </div>
            <Button onClick={handleManageSubscription}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Manage Subscription
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Next Billing Date</p>
                <p className="text-sm text-muted-foreground">{new Date(billingData.nextBilling).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Seats Used</p>
                <p className="text-sm text-muted-foreground">{billingData.seats.used} of {billingData.seats.total}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage Limits</CardTitle>
          <CardDescription>Track your usage against plan limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Monthly Calls</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {billingData.usage.calls.used.toLocaleString()} / {billingData.usage.calls.limit.toLocaleString()}
              </span>
            </div>
            <Progress 
              value={getUsagePercentage(billingData.usage.calls.used, billingData.usage.calls.limit)}
              className="h-2"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Active Agents</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {billingData.usage.agents.used} / {billingData.usage.agents.limit}
              </span>
            </div>
            <Progress 
              value={getUsagePercentage(billingData.usage.agents.used, billingData.usage.agents.limit)}
              className="h-2"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Storage Used</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {billingData.usage.storage.used}GB / {billingData.usage.storage.limit}GB
              </span>
            </div>
            <Progress 
              value={getUsagePercentage(billingData.usage.storage.used, billingData.usage.storage.limit)}
              className="h-2"
            />
          </div>
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
            <Button variant="outline" className="mt-4" onClick={handleManageSubscription}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Billing History
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}