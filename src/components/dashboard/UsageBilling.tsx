import { useState } from "react"
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
  ExternalLink
} from "lucide-react"
import { DateRangePicker } from "./widgets/DateRangePicker"
import { DateRange } from "react-day-picker"
import { format } from "date-fns"

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Usage & Billing</h2>
          <p className="text-muted-foreground">
            Monitor your usage and manage your subscription
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-warning" />
              Current Plan: {mockUsageData.currentPlan}
            </CardTitle>
            <Button>
              <ExternalLink className="h-4 w-4 mr-2" />
              Manage Subscription
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Billing Cycle</p>
              <p className="font-medium capitalize">{mockUsageData.billingCycle}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Next Billing Date</p>
              <p className="font-medium">{format(mockUsageData.nextBillingDate, "MMM d, yyyy")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Month Spend</p>
              <p className="font-medium text-lg">${mockUsageData.currentSpend.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Upgrade CTA */}
      <Card className="bg-gradient-brand text-white">
        <CardContent className="p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold mb-2">Ready to scale up?</h3>
              <p className="text-white/90">
                Upgrade to Enterprise for unlimited calls, advanced AI features, and priority support.
              </p>
            </div>
            <Button variant="secondary" className="bg-white text-primary hover:bg-white/90">
              <Crown className="h-4 w-4 mr-2" />
              Upgrade Now
            </Button>
          </div>
        </CardContent>
      </Card>

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